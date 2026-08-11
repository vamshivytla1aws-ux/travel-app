"use client";

import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  company: z.string().trim().min(2, "Please enter your company name."),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,14}$/, "Please enter a valid phone number."),
  email: z.string().trim().email("Please enter a valid email address."),
  requirement: z.string().trim().min(2, "Please tell us about the transport requirement."),
  message: z.string().trim().min(10, "Please add a little more detail (at least 10 characters)."),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!result.success) {
      const nextErrors: Errors = {};
      result.error.issues.forEach((issue) => { nextErrors[issue.path[0] as keyof Errors] = issue.message; });
      setErrors(nextErrors);
      setStatus("idle");
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, website: new FormData(form).get("website") }),
      });

      if (!response.ok) throw new Error("Enquiry delivery failed");

      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const fields = [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    { name: "company", label: "Company name", type: "text", autoComplete: "organization" },
    { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "requirement", label: "Approx. employees / transport requirement", type: "text", autoComplete: "off", wide: true },
  ] as const;

  return (
    <form className="enquiry-form" data-premium-card noValidate onSubmit={handleSubmit}>
      <div className="form-heading"><span>Corporate enquiry</span><h3>Request a callback</h3><p>Tell us what your workforce needs and our team will contact you shortly.</p></div>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="form-grid">
        {fields.map((field) => (
          <div className={`field ${"wide" in field && field.wide ? "wide" : ""}`} key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>
            <input id={field.name} name={field.name} type={field.type} autoComplete={field.autoComplete} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${field.name}-error` : undefined} />
            {errors[field.name] && <span className="field-error" id={`${field.name}-error`}>{errors[field.name]}</span>}
          </div>
        ))}
        <div className="field wide">
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={4} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "message-error" : undefined} />
          {errors.message && <span className="field-error" id="message-error">{errors.message}</span>}
        </div>
      </div>
      <button className="button button-gold form-submit" type="submit" data-magnetic disabled={status === "submitting"}>
        {status === "submitting" ? "Sending enquiry…" : "Request a callback"} <ArrowUpRight />
      </button>
      <div aria-live="polite">
        {status === "success" && <p className="form-ready" role="status"><CheckCircle2 /> Your enquiry has been sent successfully.</p>}
        {status === "error" && <p className="form-error" role="alert">We couldn&apos;t send your enquiry. Please try again or contact us directly.</p>}
      </div>
    </form>
  );
}
