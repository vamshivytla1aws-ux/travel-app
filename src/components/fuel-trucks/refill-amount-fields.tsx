"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  quantityId: string;
  rateId: string;
  totalId: string;
  quantityName: string;
  rateName: string;
  totalName: string;
  initialQuantity?: string;
  initialRate?: string;
  initialTotal?: string;
};

function parsePositive(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function RefillAmountFields({
  quantityId,
  rateId,
  totalId,
  quantityName,
  rateName,
  totalName,
  initialQuantity = "",
  initialRate = "",
  initialTotal = "",
}: Props) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [rate, setRate] = useState(initialRate);
  const [manualTotal, setManualTotal] = useState(initialTotal);
  const [manualOverride, setManualOverride] = useState(false);

  const autoTotal = useMemo(() => {
    const computed = parsePositive(quantity) * parsePositive(rate);
    return computed > 0 ? computed.toFixed(2) : "";
  }, [quantity, rate]);

  const totalValue = manualOverride ? manualTotal : autoTotal;

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <div className="grid gap-1">
        <Label htmlFor={quantityId}>Quantity (L)</Label>
        <Input
          id={quantityId}
          name={quantityName}
          type="number"
          step="0.01"
          required
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            if (!manualOverride) setManualTotal("");
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={rateId}>Rate / Liter</Label>
        <Input
          id={rateId}
          name={rateName}
          type="number"
          step="0.01"
          required
          value={rate}
          onChange={(event) => {
            setRate(event.target.value);
            if (!manualOverride) setManualTotal("");
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={totalId}>Total Amount</Label>
        <Input
          id={totalId}
          name={totalName}
          type="number"
          step="0.01"
          required
          value={totalValue}
          onChange={(event) => {
            setManualOverride(true);
            setManualTotal(event.target.value);
          }}
          onBlur={() => {
            if (!manualTotal.trim()) setManualOverride(false);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Auto-calculated from quantity and rate. Edit manually if bill amount differs.
        </p>
      </div>
    </div>
  );
}

