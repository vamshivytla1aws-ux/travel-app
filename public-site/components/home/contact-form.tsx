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

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [ready, setReady] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!result.success) {
      const nextErrors: Errors = {};
      result.error.issues.forEach((issue) => { nextErrors[issue.path[0] as keyof Errors] = issue.message; });
      setErrors(nextErrors);
      setReady(false);
      return;
    }
    setErrors({});
    setReady(true);
    const { name, company, phone, email, requirement, message } = result.data;
    const subject = encodeURIComponent(`Corporate transport enquiry — ${company}`);
    const body = encodeURIComponent(`Name: ${name}\nCompany: ${company}\nPhone: ${phone}\nEmail: ${email}\nRequirement: ${requirement}\n\nMessage:\n${message}`);
    window.location.href = `mailto:jaibhavanitravels9@gmail.com?subject=${subject}&body=${body}`;
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
      <div className="form-heading"><span>Corporate enquiry</span><h3>Request a callback</h3><p>Tell us what your workforce needs. Your details open in your email app—nothing is stored on this website.</p></div>
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
      <button className="button button-gold form-submit" type="submit" data-magnetic>Request a callback <ArrowUpRight /></button>
      {ready && <p className="form-ready" role="status"><CheckCircle2 /> Your enquiry is ready in your email app.</p>}
    </form>
  );
}
