import "server-only";

export async function sendMail(
  to: string,
  subject: string,
  text: string,
) {
  const key = process.env.RESEND_API_KEY;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const from = process.env.RESEND_FROM?.trim();
  if (!key || key.includes("dummy") || !from) {
    throw new Error("Email delivery requires RESEND_API_KEY and RESEND_FROM in production");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}`);
  }
}
