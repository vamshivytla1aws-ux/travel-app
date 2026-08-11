import { z } from "zod";

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(150),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,14}$/),
  email: z.string().trim().email().max(254),
  requirement: z.string().trim().min(2).max(250),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(0).optional(),
});

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const requestLog = new Map<string, number[]>();

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const recentRequests = (requestLog.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);

  if (recentRequests.length >= MAX_REQUESTS) {
    requestLog.set(ip, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestLog.set(ip, recentRequests);
  return false;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) {
    return Response.json({ message: "Request is too large." }, { status: 413 });
  }

  const origin = request.headers.get("origin");
  const expectedHost = request.headers.get("x-forwarded-host")
    ?? request.headers.get("host")
    ?? new URL(request.url).host;
  if (origin && (!URL.canParse(origin) || new URL(origin).host !== expectedHost)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  if (isRateLimited(getClientIp(request))) {
    return Response.json({ message: "Please wait before sending another enquiry." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }

  const result = enquirySchema.safeParse(payload);
  if (!result.success) {
    return Response.json({ message: "Please check the enquiry details." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  const to = process.env.ENQUIRY_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.error("Enquiry email configuration is incomplete.");
    return Response.json({ message: "Email service is temporarily unavailable." }, { status: 503 });
  }

  const { name, company, phone, email, requirement, message } = result.data;
  const subject = `Corporate transport enquiry — ${company}`;
  const text = [
    `Name: ${name}`,
    `Company: ${company}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Requirement: ${requirement}`,
    "",
    "Message:",
    message,
  ].join("\n");

  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        text,
        html: `
          <h2>New corporate transport enquiry</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Company:</strong> ${escapeHtml(company)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Requirement:</strong> ${escapeHtml(requirement)}</p>
          <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });
  } catch {
    console.error("Resend could not be reached for an enquiry email.");
    return Response.json({ message: "Email delivery failed. Please try again." }, { status: 502 });
  }

  if (!resendResponse.ok) {
    console.error("Resend rejected an enquiry email.", { status: resendResponse.status });
    return Response.json({ message: "Email delivery failed. Please try again." }, { status: 502 });
  }

  return Response.json({ message: "Your enquiry has been sent successfully." });
}
