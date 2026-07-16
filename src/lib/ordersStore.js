import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Order + library persistence behind one interface with two backends:
// PgOrdersStore (production — the existing orders / order_items /
// order_deliveries / stripe_events tables, plus new library tables) and
// FileOrdersStore (local dev — runtime JSON, same as the content store).
// Before this existed, orders lived only in Postgres, so none of the
// checkout/return/library flow was exercisable in local dev.
//
// Both backends speak the same shapes:
// - order rows use the admin endpoint's existing snake_case field names
//   (id, stripe_session_id, customer_email, status, created_at,
//   shipping_address, items[{issueId, issueTitle, format, pricePaid}])
// - library sessions/tokens are { token, email, expiresAt }.

const LIBRARY_TOKEN_TTL_MS = 30 * 60 * 1000;
export const LIBRARY_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

export class PgOrdersStore {
  constructor(pool) {
    this.pool = pool;
  }

  // Order tables (orders/order_items/order_deliveries/stripe_events) are
  // created by PgRepository.init(); this only owns the library tables.
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS library_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS library_sessions (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
  }

  async hasProcessedStripeEvent(eventId) {
    const existing = await this.pool.query(
      "SELECT event_id FROM stripe_events WHERE event_id = $1",
      [eventId]
    );
    return existing.rows.length > 0;
  }

  async markStripeEventProcessed(eventId) {
    await this.pool.query(
      "INSERT INTO stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [eventId]
    );
  }

  async insertOrder({ id, stripeSessionId, customerEmail, status, shippingAddress, items, deliveryToken }) {
    const fulfillmentStatus = items.some((item) => item.format === "physical") ? "pending" : "n/a";
    await this.pool.query(
      "INSERT INTO orders (id, stripe_session_id, customer_email, status, shipping_address, fulfillment_status) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, stripeSessionId, customerEmail, status, shippingAddress ? JSON.stringify(shippingAddress) : null, fulfillmentStatus]
    );
    for (const item of items) {
      await this.pool.query(
        "INSERT INTO order_items (id, order_id, issue_id, issue_title, format, price_paid) VALUES ($1, $2, $3, $4, $5, $6)",
        [item.id, id, item.issueId, item.issueTitle, item.format, item.pricePaid]
      );
    }
    await this.pool.query(
      "INSERT INTO order_deliveries (token, order_id) VALUES ($1, $2)",
      [deliveryToken, id]
    );
  }

  async getDeliveryTokenBySessionId(stripeSessionId) {
    const row = await this.pool.query(
      `SELECT d.token
         FROM order_deliveries d
         JOIN orders o ON o.id = d.order_id
        WHERE o.stripe_session_id = $1`,
      [stripeSessionId]
    );
    return row.rows[0]?.token || null;
  }

  async getOrderStatusBySessionId(stripeSessionId) {
    const row = await this.pool.query("SELECT status FROM orders WHERE stripe_session_id = $1", [stripeSessionId]);
    return row.rows[0]?.status || null;
  }

  async updateOrderStatusBySessionId(stripeSessionId, status) {
    await this.pool.query("UPDATE orders SET status = $1 WHERE stripe_session_id = $2", [status, stripeSessionId]);
  }

  async getOrderByDeliveryToken(token) {
    const deliveryRow = await this.pool.query(
      "SELECT order_id FROM order_deliveries WHERE token = $1",
      [token]
    );
    if (deliveryRow.rows.length === 0) {
      return null;
    }

    const orderId = deliveryRow.rows[0].order_id;
    const [orderRow, itemRows] = await Promise.all([
      this.pool.query("SELECT customer_email, created_at FROM orders WHERE id = $1 AND status != 'refunded'", [orderId]),
      this.pool.query("SELECT issue_id, issue_title, format, price_paid FROM order_items WHERE order_id = $1", [orderId]),
    ]);
    if (orderRow.rows.length === 0) {
      return null;
    }

    return {
      id: orderId,
      customer_email: orderRow.rows[0].customer_email,
      created_at: orderRow.rows[0].created_at,
      items: itemRows.rows.map((row) => ({
        issueId: row.issue_id,
        issueTitle: row.issue_title,
        format: row.format,
        pricePaid: row.price_paid,
      })),
    };
  }

  async listOrders(limit = 200) {
    const result = await this.pool.query(
      `
      SELECT
        o.id,
        o.stripe_session_id,
        o.customer_email,
        o.status,
        o.created_at,
        o.shipping_address,
        o.fulfillment_status,
        json_agg(json_build_object(
          'issueId', oi.issue_id,
          'issueTitle', oi.issue_title,
          'format', oi.format,
          'pricePaid', oi.price_paid
        ) ORDER BY oi.issue_title) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  }

  async updateFulfillmentStatus(orderId, status) {
    await this.pool.query("UPDATE orders SET fulfillment_status = $1 WHERE id = $2", [status, orderId]);
  }

  async getDashboardStats() {
    const [revenueRow, unitsResult, orderCountResult, physicalPendingResult] = await Promise.all([
      this.pool.query(`
        SELECT
          COALESCE(SUM(oi.price_paid) FILTER (WHERE o.created_at >= date_trunc('week', NOW())), 0) AS revenue_week,
          COALESCE(SUM(oi.price_paid) FILTER (WHERE o.created_at >= date_trunc('month', NOW())), 0) AS revenue_month
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status != 'refunded'
      `),
      this.pool.query(`
        SELECT issue_id, issue_title, COUNT(*) AS units
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'refunded'
        GROUP BY issue_id, issue_title
        ORDER BY units DESC
      `),
      this.pool.query(`SELECT COUNT(DISTINCT customer_email) AS paying_customers FROM orders WHERE status != 'refunded'`),
      this.pool.query(`
        SELECT
          o.id, o.customer_email, o.created_at, o.shipping_address, o.fulfillment_status,
          json_agg(json_build_object(
            'issueId', oi.issue_id,
            'issueTitle', oi.issue_title,
            'format', oi.format,
            'pricePaid', oi.price_paid
          ) ORDER BY oi.issue_title) AS items
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.fulfillment_status = 'pending' AND o.status != 'refunded'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `),
    ]);

    return {
      revenueWeek: Number(revenueRow.rows[0]?.revenue_week || 0),
      revenueMonth: Number(revenueRow.rows[0]?.revenue_month || 0),
      unitsByIssue: unitsResult.rows.map((row) => ({
        issueId: row.issue_id,
        issueTitle: row.issue_title,
        units: Number(row.units),
      })),
      payingCustomers: Number(orderCountResult.rows[0]?.paying_customers || 0),
      physicalPending: physicalPendingResult.rows,
    };
  }

  async listCustomers() {
    const result = await this.pool.query(`
      SELECT
        customer_email AS email,
        COUNT(*) AS order_count,
        COALESCE(SUM(oi.total), 0) AS lifetime_value,
        MIN(o.created_at) AS first_order_at,
        MAX(o.created_at) AS last_order_at
      FROM orders o
      JOIN LATERAL (
        SELECT COALESCE(SUM(price_paid), 0) AS total FROM order_items WHERE order_id = o.id
      ) oi ON true
      GROUP BY customer_email
      ORDER BY last_order_at DESC
    `);
    return result.rows.map((row) => ({
      email: row.email,
      orderCount: Number(row.order_count),
      lifetimeValue: Number(row.lifetime_value),
      firstOrderAt: row.first_order_at,
      lastOrderAt: row.last_order_at,
    }));
  }

  async listOrdersByEmail(email) {
    const result = await this.pool.query(
      `
      SELECT
        o.id,
        o.created_at,
        o.status,
        json_agg(json_build_object(
          'issueId', oi.issue_id,
          'issueTitle', oi.issue_title,
          'format', oi.format,
          'pricePaid', oi.price_paid
        )) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE LOWER(o.customer_email) = LOWER($1)
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `,
      [email]
    );
    return result.rows;
  }

  async createLibraryToken(email) {
    const token = newToken();
    const expiresAt = new Date(Date.now() + LIBRARY_TOKEN_TTL_MS);
    await this.pool.query(
      "INSERT INTO library_tokens (token, email, expires_at) VALUES ($1, $2, $3)",
      [token, email, expiresAt.toISOString()]
    );
    return token;
  }

  // Single-use: the row is deleted whether or not it was still valid.
  async consumeLibraryToken(token) {
    const result = await this.pool.query(
      "DELETE FROM library_tokens WHERE token = $1 RETURNING email, expires_at",
      [token]
    );
    const row = result.rows[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }
    return row.email;
  }

  async createLibrarySession(email) {
    const token = newToken();
    const expiresAt = new Date(Date.now() + LIBRARY_SESSION_TTL_MS);
    await this.pool.query(
      "INSERT INTO library_sessions (token, email, expires_at) VALUES ($1, $2, $3)",
      [token, email, expiresAt.toISOString()]
    );
    return { token, expiresAt: expiresAt.getTime() };
  }

  async readLibrarySession(token) {
    if (!token) {
      return null;
    }
    const result = await this.pool.query(
      "SELECT email, expires_at FROM library_sessions WHERE token = $1",
      [token]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await this.deleteLibrarySession(token);
      return null;
    }
    return { email: row.email };
  }

  async deleteLibrarySession(token) {
    await this.pool.query("DELETE FROM library_sessions WHERE token = $1", [token]);
  }
}

export class FileOrdersStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({ orders: [], stripeEvents: [], libraryTokens: [], librarySessions: [] });
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const data = JSON.parse(raw);
    return {
      orders: data.orders || [],
      stripeEvents: data.stripeEvents || [],
      libraryTokens: data.libraryTokens || [],
      librarySessions: data.librarySessions || [],
    };
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async hasProcessedStripeEvent(eventId) {
    const data = await this.read();
    return data.stripeEvents.includes(eventId);
  }

  async markStripeEventProcessed(eventId) {
    const data = await this.read();
    if (!data.stripeEvents.includes(eventId)) {
      data.stripeEvents.push(eventId);
      await this.write(data);
    }
  }

  async insertOrder({ id, stripeSessionId, customerEmail, status, shippingAddress, items, deliveryToken }) {
    const data = await this.read();
    data.orders.unshift({
      id,
      stripe_session_id: stripeSessionId,
      customer_email: customerEmail,
      status,
      fulfillment_status: items.some((item) => item.format === "physical") ? "pending" : "n/a",
      shipping_address: shippingAddress || null,
      created_at: new Date().toISOString(),
      delivery_token: deliveryToken,
      items: items.map((item) => ({
        issueId: item.issueId,
        issueTitle: item.issueTitle,
        format: item.format,
        pricePaid: item.pricePaid,
      })),
    });
    await this.write(data);
  }

  async getDeliveryTokenBySessionId(stripeSessionId) {
    const data = await this.read();
    return data.orders.find((order) => order.stripe_session_id === stripeSessionId)?.delivery_token || null;
  }

  async getOrderStatusBySessionId(stripeSessionId) {
    const data = await this.read();
    return data.orders.find((order) => order.stripe_session_id === stripeSessionId)?.status || null;
  }

  async updateOrderStatusBySessionId(stripeSessionId, status) {
    const data = await this.read();
    const order = data.orders.find((entry) => entry.stripe_session_id === stripeSessionId);
    if (order) {
      order.status = status;
      await this.write(data);
    }
  }

  async getOrderByDeliveryToken(token) {
    const data = await this.read();
    const order = data.orders.find((entry) => entry.delivery_token === token);
    if (!order || order.status === "refunded") {
      return null;
    }
    return {
      id: order.id,
      customer_email: order.customer_email,
      created_at: order.created_at,
      items: order.items,
    };
  }

  async listOrders(limit = 200) {
    const data = await this.read();
    return data.orders.slice(0, limit).map(({ delivery_token: _token, ...order }) => order);
  }

  async listOrdersByEmail(email) {
    const data = await this.read();
    return data.orders
      .filter((order) => (order.customer_email || "").toLowerCase() === String(email).toLowerCase())
      .map((order) => ({ id: order.id, created_at: order.created_at, status: order.status, items: order.items }));
  }

  async updateFulfillmentStatus(orderId, status) {
    const data = await this.read();
    const order = data.orders.find((entry) => entry.id === orderId);
    if (order) {
      order.fulfillment_status = status;
      await this.write(data);
    }
  }

  async getDashboardStats() {
    const data = await this.read();
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = (startOfWeek.getDay() + 6) % 7; // Monday-start week
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let revenueWeek = 0;
    let revenueMonth = 0;
    const unitsByIssueMap = new Map();
    const payingCustomers = new Set();
    const physicalPending = [];

    for (const order of data.orders) {
      const isRefunded = order.status === "refunded";
      const createdAt = new Date(order.created_at);
      const orderTotal = (order.items || []).reduce((sum, item) => sum + (item.pricePaid || 0), 0);
      if (!isRefunded) {
        if (createdAt >= startOfWeek) revenueWeek += orderTotal;
        if (createdAt >= startOfMonth) revenueMonth += orderTotal;
      }

      if (order.customer_email && !isRefunded) {
        payingCustomers.add(order.customer_email.toLowerCase());
      }

      if (!isRefunded) {
        for (const item of order.items || []) {
          if (!item.issueId) continue;
          const existing = unitsByIssueMap.get(item.issueId) || { issueId: item.issueId, issueTitle: item.issueTitle, units: 0 };
          existing.units += 1;
          unitsByIssueMap.set(item.issueId, existing);
        }
      }

      if (order.fulfillment_status === "pending" && !isRefunded) {
        physicalPending.push({
          id: order.id,
          customer_email: order.customer_email,
          created_at: order.created_at,
          shipping_address: order.shipping_address,
          fulfillment_status: order.fulfillment_status,
          items: order.items,
        });
      }
    }

    return {
      revenueWeek,
      revenueMonth,
      unitsByIssue: [...unitsByIssueMap.values()].sort((a, b) => b.units - a.units),
      payingCustomers: payingCustomers.size,
      physicalPending,
    };
  }

  async listCustomers() {
    const data = await this.read();
    const byEmail = new Map();

    for (const order of data.orders) {
      const email = order.customer_email;
      if (!email) continue;
      const orderTotal = (order.items || []).reduce((sum, item) => sum + (item.pricePaid || 0), 0);
      const existing = byEmail.get(email) || {
        email,
        orderCount: 0,
        lifetimeValue: 0,
        firstOrderAt: order.created_at,
        lastOrderAt: order.created_at,
      };
      existing.orderCount += 1;
      existing.lifetimeValue += orderTotal;
      if (new Date(order.created_at) < new Date(existing.firstOrderAt)) existing.firstOrderAt = order.created_at;
      if (new Date(order.created_at) > new Date(existing.lastOrderAt)) existing.lastOrderAt = order.created_at;
      byEmail.set(email, existing);
    }

    return [...byEmail.values()].sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
  }

  async createLibraryToken(email) {
    const data = await this.read();
    const token = newToken();
    data.libraryTokens.push({ token, email, expiresAt: Date.now() + LIBRARY_TOKEN_TTL_MS });
    await this.write(data);
    return token;
  }

  async consumeLibraryToken(token) {
    const data = await this.read();
    const entry = data.libraryTokens.find((candidate) => candidate.token === token);
    if (!entry) {
      return null;
    }
    data.libraryTokens = data.libraryTokens.filter((candidate) => candidate.token !== token);
    await this.write(data);
    return entry.expiresAt >= Date.now() ? entry.email : null;
  }

  async createLibrarySession(email) {
    const data = await this.read();
    const token = newToken();
    const expiresAt = Date.now() + LIBRARY_SESSION_TTL_MS;
    data.librarySessions.push({ token, email, expiresAt });
    await this.write(data);
    return { token, expiresAt };
  }

  async readLibrarySession(token) {
    if (!token) {
      return null;
    }
    const data = await this.read();
    const entry = data.librarySessions.find((candidate) => candidate.token === token);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      await this.deleteLibrarySession(token);
      return null;
    }
    return { email: entry.email };
  }

  async deleteLibrarySession(token) {
    const data = await this.read();
    data.librarySessions = data.librarySessions.filter((candidate) => candidate.token !== token);
    await this.write(data);
  }
}
