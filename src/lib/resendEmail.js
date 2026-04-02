function escapeHtml(value) {
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
  shortMessage,
  accessUrl,
  coverImageUrl,
}) {
  const safeProjectTitle = escapeHtml(projectTitle);
  const safeCreatorName = escapeHtml(creatorName);
  const safeShortMessage = escapeHtml(shortMessage || "Your digital copy is ready.");
  const safeAccessUrl = escapeHtml(accessUrl);
  const safeCoverImageUrl = escapeHtml(coverImageUrl || "");

  return {
    subject: `${projectTitle} is ready`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#0b0f16;color:#f2f4f8;font-family:Arial,sans-serif;">
        <div style="max-width:720px;margin:0 auto;border:1px solid rgba(255,255,255,0.1);border-radius:28px;background:#10131c;box-shadow:0 28px 70px rgba(0,0,0,0.34);overflow:hidden;">
          <div style="padding:28px 28px 18px;">
            <div style="display:inline-block;margin:0 0 14px;padding:7px 12px;border:1px solid rgba(255,255,255,0.12);border-radius:999px;background:rgba(255,255,255,0.03);color:#d5dbe6;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;">
              Digital Delivery
            </div>
            <h1 style="margin:0 0 10px;font-size:31px;line-height:1.08;font-weight:700;color:#ffffff;">${safeProjectTitle}</h1>
            <p style="margin:0;color:#aeb7c5;font-size:14px;line-height:1.6;">
              Delivered by <span style="color:#ffffff;font-weight:700;">${safeCreatorName}</span>
            </p>
          </div>

          <div style="margin:0 28px;border-top:1px solid rgba(255,255,255,0.08);"></div>

          <div style="padding:18px 28px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="top" style="width:220px;padding:0 18px 0 0;">
                  ${
                    safeCoverImageUrl
                      ? `
                        <div style="width:200px;max-width:100%;overflow:hidden;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:#1a2230;box-shadow:0 18px 40px rgba(0,0,0,0.22);">
                          <img
                            src="${safeCoverImageUrl}"
                            alt="${safeProjectTitle} cover"
                            style="display:block;width:100%;height:auto;"
                          />
                        </div>
                      `
                      : `
                        <div style="width:200px;max-width:100%;height:300px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:#1a2230;"></div>
                      `
                  }
                </td>
                <td valign="top" style="padding:0;">
                  <p style="margin:0 0 14px;color:#d5dbe6;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">A Note From The Creator</p>
                  <div style="font-size:15px;line-height:1.9;color:#eef2f7;">
                    ${safeShortMessage
                      .split(/\n+/)
                      .filter(Boolean)
                      .map((paragraph) => `<p style="margin:0 0 10px;">${paragraph}</p>`)
                      .join("")}
                  </div>

                  <div style="margin:22px 0 18px;border-top:1px solid rgba(255,255,255,0.08);"></div>

                  <div style="margin:0 0 12px;">
                    <a
                      href="${safeAccessUrl}"
                      style="display:inline-block;padding:16px 28px;border-radius:16px;background:#ffffff;color:#0b0f16;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;"
                    >
                      Open Your Copy
                    </a>
                  </div>
                  <p style="margin:0;color:#b8c1cf;font-size:14px;line-height:1.8;">
                    This will open in your browser. You can download or read it online anytime.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin:0 28px;border-top:1px solid rgba(255,255,255,0.08);"></div>

          <div style="padding:20px 28px 18px;">
            <div style="padding:14px 16px;border:1px solid rgba(255,255,255,0.06);border-radius:18px;background:rgba(255,255,255,0.04);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="top" style="width:40px;padding:0 12px 0 0;">
                    <div style="width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,0.08);color:#ffffff;font-size:18px;line-height:32px;text-align:center;">?</div>
                  </td>
                  <td valign="top" style="padding:0;">
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:700;">Having trouble?</p>
                    <p style="margin:0 0 10px;color:#b6becc;font-size:13px;line-height:1.6;">
                      If the button doesn&apos;t work, copy and paste this link:
                    </p>
                    <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.05);color:#f2f4f8;font-size:12px;line-height:1.6;word-break:break-word;">
                      <a href="${safeAccessUrl}" style="color:#f2f4f8;text-decoration:none;">${safeAccessUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <div style="padding:18px 28px 22px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#b6becc;font-size:13px;line-height:1.6;">
            Keep this email. You can always return to your copy with this link.
          </div>
        </div>
      </div>
    `,
    text: `${projectTitle} is ready\n\n${shortMessage || "Your digital copy is ready."}\n\nAccess your copy here:\n${accessUrl}\n`,
  };
}

export async function sendResendEmail({ to, subject, html, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
      reply_to: process.env.RESEND_REPLY_TO || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || "Resend email request failed.");
  }

  return response.json();
}
