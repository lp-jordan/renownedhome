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
        <div style="max-width:640px;margin:0 auto;padding:28px;border:1px solid rgba(255,255,255,0.1);border-radius:24px;background:#101621;box-shadow:0 24px 60px rgba(0,0,0,0.32);">
          <p style="margin:0 0 16px;color:#b6becc;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;">Digital Delivery</p>
          <h1 style="margin:0 0 8px;font-size:40px;line-height:1.05;font-weight:700;color:#ffffff;">${safeProjectTitle}</h1>
          <p style="margin:0 0 24px;color:#c7ccd6;font-size:15px;line-height:1.6;">Delivered by ${safeCreatorName}</p>
          ${
            safeCoverImageUrl
              ? `
                <div style="margin:0 0 24px;">
                  <div style="width:260px;max-width:100%;overflow:hidden;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:#1a2230;box-shadow:0 18px 40px rgba(0,0,0,0.28);">
                    <img
                      src="${safeCoverImageUrl}"
                      alt="${safeProjectTitle} cover"
                      style="display:block;width:100%;height:auto;"
                    />
                  </div>
                </div>
              `
              : ""
          }
          <div style="margin:0 0 28px;">
            <p style="margin:0 0 8px;color:#b6becc;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">A note from the creator</p>
            <p style="margin:0;font-size:16px;line-height:1.75;color:#f2f4f8;">${safeShortMessage}</p>
          </div>
          <div style="margin:0 0 28px;">
            <a
              href="${safeAccessUrl}"
              style="display:inline-block;padding:14px 24px;border-radius:12px;background:#ffffff;color:#0b0f16;text-decoration:none;font-size:15px;font-weight:700;box-shadow:0 8px 30px rgba(255,255,255,0.08);"
            >
              Open Your Copy
            </a>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
            <p style="margin:0 0 8px;color:#b6becc;font-size:13px;line-height:1.5;">If the button doesn&apos;t work, use this direct link:</p>
            <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-word;">
              <a href="${safeAccessUrl}" style="color:#f2f4f8;text-decoration:underline;text-underline-offset:2px;">${safeAccessUrl}</a>
            </p>
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
