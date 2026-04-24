"use client";

import { useEffect, useRef } from "react";

type Props = {
  message?: string;
};

const DEFAULT_MESSAGE =
  "You have unsaved changes. If you leave now, those changes will be lost.";

export function FormDirtyGuard({ message = DEFAULT_MESSAGE }: Props) {
  const markerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const form = marker.closest("form");
    if (!form) return;

    let dirty = false;

    const markDirty = () => {
      dirty = true;
    };

    const markClean = () => {
      dirty = false;
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = message;
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", markClean);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", markClean);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [message]);

  return <span ref={markerRef} className="hidden" aria-hidden="true" />;
}

