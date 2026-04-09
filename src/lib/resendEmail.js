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
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${safeProjectTitle} is ready</title>
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
                    <td style="padding:20px 24px 22px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                        <tr>
                          <td valign="top" width="100%" style="display:block;width:100%;padding:0 0 18px;">
                            ${
                              safeCoverImageUrl
                                ? `
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:220px;">
                                    <tr>
                                      <td style="overflow:hidden;border-radius:18px;border:1px solid #252b38;background:#1a2230;">
                                        <img
                                          src="${safeCoverImageUrl}"
                                          alt="${safeProjectTitle} cover"
                                          width="218"
                                          style="display:block;width:100%;max-width:218px;height:auto;border:0;"
                                        />
                                      </td>
                                    </tr>
                                  </table>
                                `
                                : `
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:220px;">
                                    <tr>
                                      <td height="300" style="height:300px;border-radius:18px;border:1px solid #252b38;background:#1a2230;font-size:0;line-height:0;">&nbsp;</td>
                                    </tr>
                                  </table>
                                `
                            }
                          </td>
                        </tr>
                        <tr>
                          <td valign="top" width="100%" style="display:block;width:100%;padding:0;">
                            <p style="margin:0 0 14px;color:#d5dbe6;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">A Note From The Creator</p>
                            <div style="font-size:15px;line-height:1.8;color:#eef2f7;font-style:italic;">
                              ${safeShortMessage
                                .split(/\n+/)
                                .filter(Boolean)
                                .map((paragraph) => `<p style="margin:0 0 10px;font-style:italic;">${paragraph}</p>`)
                                .join("")}
                            </div>

                            <div style="margin:22px 0 18px;border-top:1px solid #252b38;font-size:0;line-height:0;">&nbsp;</div>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
                              <tr>
                                <td align="center" bgcolor="#ffffff" style="border-radius:16px;">
                                  <a
                                    href="${safeAccessUrl}"
                                    style="display:block;padding:16px 24px;border-radius:16px;background:#ffffff;color:#05070b;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;"
                                  >
                                    Open Your Copy
                                  </a>
                                </td>
                              </tr>
                            </table>
                            <p style="margin:0;color:#b8c1cf;font-size:14px;line-height:1.8;">
                              This will open in your browser. You can download or read it online anytime.
                            </p>
                          </td>
                        </tr>
                      </table>
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
