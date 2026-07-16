export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function resendIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function buildDeliveryEmail({
  projectTitle,
  creatorName,
  accessUrl,
}) {
  const safeProjectTitle = escapeHtml(projectTitle);
  const safeCreatorName = escapeHtml(creatorName);
  const safeAccessUrl = escapeHtml(accessUrl);

  return {
    subject: `${projectTitle} is ready`,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${safeProjectTitle} is ready</title>
          <style>
            @media only screen and (max-width: 620px) {
              .delivery-body td {
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;background:#0b0f16;font-family:Arial,sans-serif;color:#f2f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;padding:0;background:#0b0f16;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;margin:0 auto;background:#10131c;border:1px solid #252b38;border-radius:24px;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td style="padding:28px 24px 18px;">
                      <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid #303746;border-radius:999px;background:#171c27;color:#d5dbe6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                        Digital Delivery
                      </div>
                      <h1 style="margin:0 0 10px;font-size:30px;line-height:1.12;font-weight:700;color:#ffffff;">${safeProjectTitle}</h1>
                      <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">
                        Delivered by <span style="color:#ffffff;font-weight:700;">${safeCreatorName}</span>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>

                  <tr>
                    <td class="delivery-body" align="center" style="padding:28px 24px 30px;text-align:center;">
                      <p style="margin:0 0 18px;color:#f2f4f8;font-size:16px;line-height:1.6;text-align:center;">Your digital package is ready for download!</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                        <tr>
                          <td align="center" bgcolor="#ffffff" style="border-radius:16px;">
                            <a
                              href="${safeAccessUrl}"
                              style="display:block;padding:16px 28px;border-radius:16px;background:#ffffff;color:#05070b;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;"
                            >
                              Access Here
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#b8c1cf;font-size:14px;line-height:1.8;text-align:center;">
                        This will open in your browser. You can download or read it online anytime.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 24px 18px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #252b38;border-radius:18px;background:#171c27;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                              <tr>
                                <td valign="top" style="display:block;width:100%;padding:0 0 12px;">
                                  <div style="width:32px;height:32px;border-radius:999px;background:#242c39;color:#ffffff;font-size:18px;line-height:32px;text-align:center;">?</div>
                                </td>
                              </tr>
                              <tr>
                                <td valign="top" style="display:block;width:100%;padding:0;">
                                  <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:700;">Having trouble?</p>
                                  <p style="margin:0 0 10px;color:#b6becc;font-size:13px;line-height:1.6;">
                                    If the button doesn&apos;t work, copy and paste this link:
                                  </p>
                                  <div style="padding:12px 14px;border-radius:12px;background:#1c2330;color:#f2f4f8;font-size:12px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere;">
                                    <a href="${safeAccessUrl}" style="color:#f2f4f8;text-decoration:none;word-break:break-word;overflow-wrap:anywhere;">${safeAccessUrl}</a>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 24px 22px;border-top:1px solid #252b38;text-align:center;color:#b6becc;font-size:13px;line-height:1.6;">
                      Keep this email. You can always return to your copy with this link.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `${projectTitle} is ready\n\nAccess your copy here:\n${accessUrl}\n`,
  };
}

export function buildOrderDeliveryEmail({ itemList, accessUrl, creatorName }) {
  const safeItemList = escapeHtml(itemList);
  const safeAccessUrl = escapeHtml(accessUrl);
  const safeCreatorName = escapeHtml(creatorName);

  return {
    subject: `Your order is ready — ${itemList}`,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>Your order is ready</title>
        </head>
        <body style="margin:0;padding:0;background:#0b0f16;font-family:Arial,sans-serif;color:#f2f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;padding:0;background:#0b0f16;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;margin:0 auto;background:#10131c;border:1px solid #252b38;border-radius:24px;border-collapse:separate;">
                  <tr>
                    <td style="padding:28px 24px 18px;">
                      <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid #303746;border-radius:999px;background:#171c27;color:#d5dbe6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                        Order Confirmed
                      </div>
                      <h1 style="margin:0 0 10px;font-size:28px;line-height:1.12;font-weight:700;color:#ffffff;">Your download is ready.</h1>
                      <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">
                        From <span style="color:#ffffff;font-weight:700;">${safeCreatorName}</span> &mdash; ${safeItemList}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:28px 24px 30px;text-align:center;">
                      <p style="margin:0 0 18px;color:#f2f4f8;font-size:16px;line-height:1.6;">Click below to access everything you purchased.</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                        <tr>
                          <td align="center" bgcolor="#ffffff" style="border-radius:16px;">
                            <a href="${safeAccessUrl}" style="display:block;padding:16px 28px;border-radius:16px;background:#ffffff;color:#05070b;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                              Access Your Order
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#b8c1cf;font-size:14px;line-height:1.8;">Keep this email — this link is yours to use anytime.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 18px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #252b38;border-radius:18px;background:#171c27;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:700;">Having trouble?</p>
                            <p style="margin:0 0 10px;color:#b6becc;font-size:13px;line-height:1.6;">Copy and paste this link into your browser:</p>
                            <div style="padding:12px 14px;border-radius:12px;background:#1c2330;color:#f2f4f8;font-size:12px;line-height:1.6;word-break:break-word;">
                              <a href="${safeAccessUrl}" style="color:#f2f4f8;text-decoration:none;word-break:break-word;">${safeAccessUrl}</a>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 22px;border-top:1px solid #252b38;text-align:center;color:#b6becc;font-size:13px;line-height:1.6;">
                      This is a one-time purchase link. No account required.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Your order is ready — ${itemList}\n\nAccess your download here:\n${accessUrl}\n\nKeep this email — this link is yours to use anytime.\n`,
  };
}

export function buildLibraryLinkEmail({ accessUrl, creatorName }) {
  const safeAccessUrl = escapeHtml(accessUrl);
  const safeCreatorName = escapeHtml(creatorName);

  return {
    subject: "Your library sign-in link",
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>Your library sign-in link</title>
        </head>
        <body style="margin:0;padding:0;background:#0b0f16;font-family:Arial,sans-serif;color:#f2f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;padding:0;background:#0b0f16;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;margin:0 auto;background:#10131c;border:1px solid #252b38;border-radius:24px;border-collapse:separate;">
                  <tr>
                    <td style="padding:28px 24px 18px;">
                      <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid #303746;border-radius:999px;background:#171c27;color:#d5dbe6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                        Your Library
                      </div>
                      <h1 style="margin:0 0 10px;font-size:28px;line-height:1.12;font-weight:700;color:#ffffff;">Here's your sign-in link.</h1>
                      <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">
                        From <span style="color:#ffffff;font-weight:700;">${safeCreatorName}</span> &mdash; no password needed.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:28px 24px 30px;text-align:center;">
                      <p style="margin:0 0 18px;color:#f2f4f8;font-size:16px;line-height:1.6;">Click below to open your library — everything you own, ready to read or download.</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                        <tr>
                          <td align="center" bgcolor="#ffffff" style="border-radius:16px;">
                            <a href="${safeAccessUrl}" style="display:block;padding:16px 28px;border-radius:16px;background:#ffffff;color:#05070b;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                              Open My Library
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#b8c1cf;font-size:14px;line-height:1.8;">This link works once and expires in 30 minutes. You can always request a new one.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 22px;border-top:1px solid #252b38;text-align:center;color:#b6becc;font-size:13px;line-height:1.6;">
                      Didn't request this? You can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Your library sign-in link\n\nOpen your library here (works once, expires in 30 minutes):\n${accessUrl}\n\nDidn't request this? You can safely ignore this email.\n`,
  };
}

function formatShippingAddressLines(shippingAddress) {
  if (!shippingAddress) {
    return [];
  }
  const { line1, line2, city, state, postal_code: postalCode, country } = shippingAddress;
  return [
    line1,
    line2,
    [city, state, postalCode].filter(Boolean).join(", "),
    country,
  ].filter(Boolean);
}

export function buildPhysicalOrderEmail({ itemList, creatorName, shippingAddress }) {
  const safeItemList = escapeHtml(itemList);
  const safeCreatorName = escapeHtml(creatorName);
  const addressLines = formatShippingAddressLines(shippingAddress).map(escapeHtml);
  const addressHtml = addressLines.length
    ? addressLines.join("<br />")
    : "We'll confirm your shipping details shortly.";
  const addressText = addressLines.length
    ? addressLines.join("\n")
    : "We'll confirm your shipping details shortly.";

  return {
    subject: `Your order is confirmed — ${itemList}`,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>Your order is confirmed</title>
        </head>
        <body style="margin:0;padding:0;background:#0b0f16;font-family:Arial,sans-serif;color:#f2f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;padding:0;background:#0b0f16;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;margin:0 auto;background:#10131c;border:1px solid #252b38;border-radius:24px;border-collapse:separate;">
                  <tr>
                    <td style="padding:28px 24px 18px;">
                      <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid #303746;border-radius:999px;background:#171c27;color:#d5dbe6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                        Order Confirmed
                      </div>
                      <h1 style="margin:0 0 10px;font-size:28px;line-height:1.12;font-weight:700;color:#ffffff;">Your order is confirmed.</h1>
                      <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">
                        From <span style="color:#ffffff;font-weight:700;">${safeCreatorName}</span> &mdash; ${safeItemList}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 22px;">
                      <p style="margin:0 0 12px;color:#f2f4f8;font-size:16px;line-height:1.6;">We'll get this in the mail soon. Shipping to:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #252b38;border-radius:18px;background:#171c27;">
                        <tr>
                          <td style="padding:14px 16px;color:#f2f4f8;font-size:14px;line-height:1.6;">
                            ${addressHtml}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 22px;border-top:1px solid #252b38;text-align:center;color:#b6becc;font-size:13px;line-height:1.6;">
                      Questions about your order? Just reply to this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Your order is confirmed — ${itemList}\n\nWe'll get this in the mail soon. Shipping to:\n${addressText}\n\nQuestions about your order? Just reply to this email.\n`,
  };
}

export function buildAdminSaleNotificationEmail({ itemsSummary, totalPaidDisplay, customerEmail, hasPhysical, shippingAddress }) {
  const safeItemsSummary = escapeHtml(itemsSummary);
  const safeTotalPaidDisplay = escapeHtml(totalPaidDisplay);
  const safeCustomerEmail = escapeHtml(customerEmail || "—");
  const addressLines = formatShippingAddressLines(shippingAddress).map(escapeHtml);

  const subject = hasPhysical
    ? `New physical order to fulfill — ${itemsSummary}`
    : `New sale — ${itemsSummary}`;

  const fulfillmentHtml = hasPhysical
    ? `
      <tr>
        <td style="padding:20px 24px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #3a2a1a;border-radius:18px;background:#241c14;">
            <tr>
              <td style="padding:14px 16px;color:#f2f4f8;font-size:14px;line-height:1.6;">
                <p style="margin:0 0 8px;color:#ffb877;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Ships to</p>
                ${addressLines.length ? addressLines.join("<br />") : "No shipping address on file."}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";
  const fulfillmentText = hasPhysical
    ? `\nShips to:\n${addressLines.length ? addressLines.join("\n") : "No shipping address on file."}\n`
    : "";

  return {
    subject,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${escapeHtml(subject)}</title>
        </head>
        <body style="margin:0;padding:0;background:#0b0f16;font-family:Arial,sans-serif;color:#f2f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;padding:0;background:#0b0f16;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:24px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;margin:0 auto;background:#10131c;border:1px solid #252b38;border-radius:24px;border-collapse:separate;">
                  <tr>
                    <td style="padding:28px 24px 18px;">
                      <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid #303746;border-radius:999px;background:#171c27;color:#d5dbe6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                        ${hasPhysical ? "Action needed" : "New sale"}
                      </div>
                      <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;font-weight:700;color:#ffffff;">${hasPhysical ? "A physical order needs fulfillment." : "You made a sale."}</h1>
                      <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">${safeItemsSummary}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px;">
                      <div style="border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 4px;color:#f2f4f8;font-size:14px;line-height:1.8;">
                      <p style="margin:0;"><strong style="color:#ffffff;">Paid:</strong> ${safeTotalPaidDisplay}</p>
                      <p style="margin:0;"><strong style="color:#ffffff;">Customer:</strong> ${safeCustomerEmail}</p>
                    </td>
                  </tr>
                  ${fulfillmentHtml}
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `${hasPhysical ? "A physical order needs fulfillment." : "You made a sale."}\n\n${itemsSummary}\n\nPaid: ${totalPaidDisplay}\nCustomer: ${customerEmail || "—"}\n${fulfillmentText}`,
  };
}

// Resend allows 5 requests/second. We stay conservatively under that by
// serializing every outbound request and enforcing a minimum gap between the
// start of one request and the next. This gates ALL call sites (batch delivery,
// test sends, reader correspondence) through a single promise chain, so even
// concurrent callers are spaced out rather than bursting past the limit.
const nodeEnv = typeof process !== "undefined" ? process.env : undefined;
const RESEND_MIN_INTERVAL_MS = Number(nodeEnv?.RESEND_MIN_INTERVAL_MS) || 250; // ~4 req/s
const RESEND_MAX_RETRIES = Number(nodeEnv?.RESEND_MAX_RETRIES) || 3;

let lastRequestAt = 0;
let throttleChain = Promise.resolve();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reserve the next send slot, waiting until at least RESEND_MIN_INTERVAL_MS has
// elapsed since the previous reservation. Returns once it's safe to fire.
function reserveResendSlot() {
  throttleChain = throttleChain.then(async () => {
    const wait = lastRequestAt + RESEND_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await delay(wait);
    }
    lastRequestAt = Date.now();
  });
  return throttleChain;
}

export async function sendResendEmail({ to, subject, html, text, attachments }) {
  const payload = JSON.stringify({
    from: process.env.RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html,
    text,
    reply_to: process.env.RESEND_REPLY_TO || undefined,
    attachments: attachments || undefined,
  });

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await reserveResendSlot();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (response.ok) {
      return response.json();
    }

    // 429 (rate limited) and 402 are transient — back off and retry, honoring
    // Resend's Retry-After header when present, so a brief burst past the cap
    // doesn't drop someone's delivery.
    const isRateLimited = response.status === 429 || response.status === 402;
    if (isRateLimited && attempt < RESEND_MAX_RETRIES) {
      attempt += 1;
      const retryAfter = Number(response.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : RESEND_MIN_INTERVAL_MS * Math.pow(2, attempt);
      await delay(backoff);
      continue;
    }

    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || "Resend email request failed.");
  }
}
