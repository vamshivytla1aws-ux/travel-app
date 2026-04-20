"use client";

import { useId, useMemo, useState } from "react";

type BusOption = {
  id: number;
  busNumber: string;
  registrationNumber: string;
};

type Props = {
  name: string;
  id?: string;
  buses: BusOption[];
  required?: boolean;
};

export function BusSearchSelect({ name, id, buses, required = false }: Props) {
  const generatedId = useId();
  const inputId = id ?? `bus-search-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return buses.slice(0, 20);
    return buses
      .filter(
        (bus) =>
          bus.busNumber.toLowerCase().includes(term) ||
          bus.registrationNumber.toLowerCase().includes(term) ||
          String(bus.id).includes(term),
      )
      .slice(0, 30);
  }, [buses, query]);

  const highlightedOption = filtered[highlightedIndex] ?? null;

  function selectBus(bus: BusOption) {
    setSelectedId(bus.id);
    setQuery(`${bus.busNumber} (${bus.registrationNumber})`);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selectedId ?? ""} required={required} />
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded
        aria-activedescendant={highlightedOption ? `${inputId}-option-${highlightedOption.id}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId(null);
          setHighlightedIndex(0);
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
            setHighlightedIndex(0);
          }
        }}
        placeholder="Search bus number (e.g. 6686)"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <div id={listboxId} role="listbox" className="max-h-48 overflow-y-auto rounded-md border bg-background">
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
      <p className="text-xs text-muted-foreground">
        Type bus number and choose from the list.
      </p>
    </div>
  );
}

