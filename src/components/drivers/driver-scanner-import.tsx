"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, WandSparkles, X } from "lucide-react";
import { DRIVER_REQUIRED_FIELDS, DRIVER_SECTION_FIELDS, type DriverIntakeFieldKey } from "@/lib/driver-intake-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OCRResponse = {
  prefill?: Partial<Record<DriverIntakeFieldKey, string>>;
  confidence?: Partial<Record<DriverIntakeFieldKey, number>>;
  unmappedText?: string;
  error?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.65;
const HIGHLIGHT_CLASS_NAMES = ["ring-2", "ring-amber-300", "bg-amber-50"];

function getFieldElement(form: HTMLFormElement, field: DriverIntakeFieldKey) {
  return form.querySelector(
    `[name="${field}"]`,
  ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
}

function toPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}%`;
}

export function DriverScannerImport({ aiEnabled }: { aiEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExtracted, setLastExtracted] = useState<OCRResponse | null>(null);
  const [appliedFields, setAppliedFields] = useState<DriverIntakeFieldKey[]>([]);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lowConfidenceFields = useMemo(() => {
    const confidence = lastExtracted?.confidence ?? {};
    return Object.entries(confidence)
      .filter(([, score]) => typeof score === "number" && score < LOW_CONFIDENCE_THRESHOLD)
      .map(([key]) => key as DriverIntakeFieldKey);
  }, [lastExtracted]);

  const missingRequiredFields = useMemo(() => {
    const prefill = lastExtracted?.prefill ?? {};
    return DRIVER_REQUIRED_FIELDS.filter((field) => !String(prefill[field] ?? "").trim());
  }, [lastExtracted]);

  const sectionScores = useMemo(() => {
    const confidence = lastExtracted?.confidence ?? {};
    return Object.entries(DRIVER_SECTION_FIELDS)
      .map(([section, fields]) => {
        const scored = fields
          .map((field) => confidence[field])
          .filter((value): value is number => typeof value === "number");
        if (scored.length === 0) return { section, score: null as number | null };
        const avg = scored.reduce((sum, value) => sum + value, 0) / scored.length;
        return { section, score: avg };
      })
      .filter((entry) => entry.score != null);
  }, [lastExtracted]);

  function resolveForm() {
    const marker = markerRef.current;
    return marker?.closest("form") as HTMLFormElement | null;
  }

  function clearHighlights(form: HTMLFormElement) {
    for (const field of appliedFields) {
      const element = getFieldElement(form, field);
      if (!element) continue;
      HIGHLIGHT_CLASS_NAMES.forEach((className) => element.classList.remove(className));
    }
  }

  function applyHighlights(form: HTMLFormElement) {
    for (const field of lowConfidenceFields) {
      const element = getFieldElement(form, field);
      if (!element) continue;
      HIGHLIGHT_CLASS_NAMES.forEach((className) => element.classList.add(className));
    }
  }

  function applyExtractedValues() {
    const form = resolveForm();
    if (!form || !lastExtracted?.prefill) return;
    clearHighlights(form);
    const nextApplied: DriverIntakeFieldKey[] = [];
    const prefill = lastExtracted.prefill;
    for (const [field, value] of Object.entries(prefill)) {
      const key = field as DriverIntakeFieldKey;
      const element = getFieldElement(form, key);
      if (!element) continue;
      const finalValue = String(value ?? "");
      element.value = finalValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      nextApplied.push(key);
    }
    setAppliedFields(nextApplied);
    applyHighlights(form);
  }

  function clearPrefillValues() {
    const form = resolveForm();
    if (!form) return;
    clearHighlights(form);
    for (const field of appliedFields) {
      const element = getFieldElement(form, field);
      if (!element) continue;
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setAppliedFields([]);
    setLastExtracted(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onExtract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a scanner file first.");
      return;
    }

    setLoading(true);
    setError(null);
    const payload = new FormData();
    payload.set("file", file);

    try {
      const response = await fetch("/api/drivers/intake/ocr", {
        method: "POST",
        body: payload,
      });
      const data = (await response.json()) as OCRResponse;
      if (!response.ok) {
        setError(data.error ?? "Scanner extraction failed.");
        return;
      }
      setLastExtracted(data);
      setTimeout(() => applyExtractedValues(), 0);
    } catch {
      setError("Scanner extraction failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={markerRef} className="rounded-md border border-dashed bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Import Driver Scanner Data</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button type="button" variant="outline" size="sm" className="gap-2" disabled={!aiEnabled}>
                <Upload className="h-4 w-4" />
                Import Scanner
              </Button>
            }
          />
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Scanner (PDF/JPG)</DialogTitle>
              <DialogDescription>
                Upload one scanner document. We extract fields and prefill this form for your review.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={onExtract}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
              ) : null}
              {lastExtracted ? (
                <div className="space-y-2 rounded-md border bg-muted/40 p-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Section Confidence</p>
                  <div className="flex flex-wrap gap-2">
                    {sectionScores.map((entry) => (
                      <span
                        key={entry.section}
                        className="rounded border px-2 py-1 text-[11px]"
                      >
                        {entry.section}: {toPercent(entry.score ?? undefined) ?? "-"}
                      </span>
                    ))}
                  </div>
                  {missingRequiredFields.length > 0 ? (
                    <p className="text-xs text-amber-700">
                      Missing required fields: {missingRequiredFields.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-700">All required fields were detected.</p>
                  )}
                  {lastExtracted.unmappedText ? (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Unmapped text</p>
                      <textarea
                        readOnly
                        className="h-28 w-full rounded-md border bg-background px-2 py-1 text-xs"
                        value={lastExtracted.unmappedText}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <DialogFooter className="mt-3" showCloseButton>
                <Button type="submit" disabled={loading} className="gap-2">
                  <WandSparkles className="h-4 w-4" />
                  {loading ? "Extracting..." : "Extract & Prefill"}
                </Button>
                <Button type="button" variant="outline" onClick={applyExtractedValues} disabled={!lastExtracted}>
                  Apply all
                </Button>
                <Button type="button" variant="ghost" onClick={clearPrefillValues} disabled={!lastExtracted}>
                  <X className="mr-1 h-4 w-4" />
                  Clear prefill
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <p className={`mt-1 text-xs ${aiEnabled ? "text-emerald-700" : "text-amber-700"}`}>
        {aiEnabled ? "AI is enabled" : "AI is disabled"}
      </p>
      {aiEnabled ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Low-confidence extracted fields are highlighted in the form. Please review before save.
        </p>
      ) : null}
    </div>
  );
}
