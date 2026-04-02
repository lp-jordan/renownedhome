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
        <div style="max-width:640px;margin:0 auto;padding:28px;border:1px solid rgba(255,255,255,0.12);border-radius:24px;background:#101621;">
          <p style="margin:0 0 12px;color:#c7ccd6;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Digital Delivery</p>
          <h1 style="margin:0 0 10px;font-size:36px;line-height:1.05;">${safeProjectTitle}</h1>
          <p style="margin:0 0 18px;color:#c7ccd6;">from ${safeCreatorName}</p>
          ${
            safeCoverImageUrl
              ? `<img src="${safeCoverImageUrl}" alt="${safeProjectTitle} cover" style="display:block;width:100%;max-width:260px;margin:0 0 20px;border-radius:18px;" />`
              : ""
          }
          <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">${safeShortMessage}</p>
          <p style="margin:0 0 22px;">
            <a href="${safeAccessUrl}" style="display:inline-block;padding:14px 18px;border-radius:14px;background:#ffffff;color:#0b0f16;text-decoration:none;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Access Your Comic</a>
          </p>
          <p style="margin:0 0 8px;color:#c7ccd6;font-size:14px;">If the button above does not work, use this link:</p>
          <p style="margin:0;font-size:14px;word-break:break-word;"><a href="${safeAccessUrl}" style="color:#f2f4f8;">${safeAccessUrl}</a></p>
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
