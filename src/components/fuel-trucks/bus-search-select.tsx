"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type BusOption = {
  id: number;
  busNumber: string;
  registrationNumber: string;
  latestOdometerKm?: number | null;
};

type Props = {
  name: string;
  id?: string;
  buses: BusOption[];
  required?: boolean;
  oldOdometerTargetId?: string;
};

export function BusSearchSelect({ name, id, buses, required = false, oldOdometerTargetId }: Props) {
  const generatedId = useId();
  const inputId = id ?? `bus-search-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const normalizedTerm = term.replace(/[^a-z0-9]/g, "");
    const termParts = term.split(/\s+/).filter(Boolean);
    if (!term) return buses.slice(0, 20);
    return buses
      .filter((bus) => {
        const busNumber = bus.busNumber.toLowerCase();
        const registration = bus.registrationNumber.toLowerCase();
        const combined = `${bus.busNumber} ${bus.registrationNumber}`.toLowerCase();
        const normalizedCombined = combined.replace(/[^a-z0-9]/g, "");
        if (
          busNumber.includes(term) ||
          registration.includes(term) ||
          combined.includes(term) ||
          String(bus.id).includes(term)
        ) {
          return true;
        }
        if (normalizedTerm && normalizedCombined.includes(normalizedTerm)) {
          return true;
        }
        if (termParts.length > 1) {
          return termParts.every(
            (part) => busNumber.includes(part) || registration.includes(part) || combined.includes(part),
          );
        }
        return false;
      })
      .slice(0, 30);
  }, [buses, query]);

  const highlightedOption = filtered[highlightedIndex] ?? null;

  function selectBus(bus: BusOption) {
    setSelectedId(bus.id);
    setQuery(`${bus.busNumber} (${bus.registrationNumber})`);
    if (textInputRef.current) textInputRef.current.setCustomValidity("");
    if (oldOdometerTargetId && bus.latestOdometerKm != null) {
      const target = document.getElementById(oldOdometerTargetId) as HTMLInputElement | null;
      if (target) target.value = String(bus.latestOdometerKm);
    }
  }

  useEffect(() => {
    const inputEl = textInputRef.current;
    if (!inputEl) return;
    const formEl = inputEl.closest("form");
    if (!formEl) return;
    const onSubmit = (event: Event) => {
      if (required && !selectedId) {
        event.preventDefault();
        inputEl.setCustomValidity("Please select a bus from the dropdown list.");
        inputEl.reportValidity();
      } else {
        inputEl.setCustomValidity("");
      }
    };
    formEl.addEventListener("submit", onSubmit);
    return () => formEl.removeEventListener("submit", onSubmit);
  }, [required, selectedId]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selectedId ?? ""} />
      <input
        ref={textInputRef}
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={highlightedOption ? `${inputId}-option-${highlightedOption.id}` : undefined}
        aria-describedby={`${inputId}-hint`}
        value={query}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
          }, 100);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId(null);
          if (textInputRef.current) textInputRef.current.setCustomValidity("");
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (!filtered.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % filtered.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const match = filtered[highlightedIndex];
            if (match) selectBus(match);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setQuery("");
            setSelectedId(null);
            if (textInputRef.current) textInputRef.current.setCustomValidity("");
            setHighlightedIndex(0);
          }
        }}
        placeholder="Search registration number (e.g. TG15T9386)"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <div
        id={listboxId}
        role="listbox"
        className={`max-h-48 overflow-y-auto rounded-md border bg-background ${isOpen ? "block" : "hidden"}`}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No matching buses found.</p>
        ) : (
          filtered.map((bus, index) => (
            <button
              type="button"
              key={bus.id}
              id={`${inputId}-option-${bus.id}`}
              role="option"
              aria-selected={selectedId === bus.id}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectBus(bus)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                selectedId === bus.id || highlightedIndex === index ? "bg-muted" : ""
              }`}
            >
              {bus.busNumber} ({bus.registrationNumber})
            </button>
          ))
        )}
      </div>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        Type registration number and choose from the list.
      </p>
    </div>
  );
}

