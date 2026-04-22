"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FinanceBusOption = {
  id: number;
  busNumber: string;
  registrationNumber: string;
  vehicleLabel: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelectBus: (bus: FinanceBusOption) => void;
  options: FinanceBusOption[];
};

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function FinanceRegistrationSelect({ value, onChange, onSelectBus, options }: Props) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = value.trim();
    if (!term) return options.slice(0, 20);

    const normalizedTerm = normalize(term);
    return options
      .filter((option) => {
        const registration = option.registrationNumber.toLowerCase();
        const busNumber = option.busNumber.toLowerCase();
        const vehicle = option.vehicleLabel.toLowerCase();
        const normalizedRegistration = normalize(option.registrationNumber);
        return (
          registration.includes(term.toLowerCase()) ||
          busNumber.includes(term.toLowerCase()) ||
          vehicle.includes(term.toLowerCase()) ||
          normalizedRegistration.includes(normalizedTerm)
        );
      })
      .slice(0, 30);
  }, [options, value]);

  return (
    <div className="grid gap-1">
      <Label htmlFor="registrationNo">Registration</Label>
      <Input
        id="registrationNo"
        name="registrationNo"
        required
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder="Type registration or last digits (e.g. 6686)"
        autoComplete="off"
      />
      <div className={`max-h-48 overflow-y-auto rounded-md border bg-background ${open ? "block" : "hidden"}`}>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No bus matched. You can continue with manual registration.
          </p>
        ) : (
          filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelectBus(option);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <div className="font-medium">
                {option.registrationNumber} - {option.busNumber}
              </div>
              <div className="text-xs text-muted-foreground">{option.vehicleLabel}</div>
            </button>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">Select from bus records or type a new registration manually.</p>
    </div>
  );
}
