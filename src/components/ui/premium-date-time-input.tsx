"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

type PremiumDateTimeInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  type: "date" | "time";
};

function initialCalendarMonth(value: string) {
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : new Date();
}

function displayValue(type: "date" | "time", value: string) {
  if (!value) return type === "date" ? "Select date" : "Select time";
  if (type === "date") {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? format(parsed, "dd MMM yyyy") : value;
  }
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date(2000, 0, 1, hour, minute);
  return format(date, "hh:mm a");
}

export function PremiumDateTimeInput({
  type,
  className,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  disabled,
  id,
  name,
  min,
  max,
  ...props
}: PremiumDateTimeInputProps) {
  const isControlled = controlledValue !== undefined;
  const defaultString = String(defaultValue ?? "");
  const [internalValue, setInternalValue] = React.useState(defaultString);
  const value = String(isControlled ? controlledValue ?? "" : internalValue);
  const [month, setMonth] = React.useState(() => initialCalendarMonth(value));
  const [open, setOpen] = React.useState(false);
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const input = hiddenInputRef.current;
    const form = input?.form;
    if (!form || isControlled) return;
    const reset = () => setInternalValue(defaultString);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultString, isControlled]);

  const commit = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    if (onChange) {
      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as React.ChangeEvent<HTMLInputElement>);
    }
    requestAnimationFrame(() => {
      hiddenInputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  const selectedDate = type === "date" && value ? parse(value, "yyyy-MM-dd", new Date()) : null;
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const [selectedHour = "", selectedMinute = ""] = value.split(":");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input
        {...props}
        ref={hiddenInputRef}
        id={id}
        name={name}
        value={value}
        onChange={() => undefined}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onInvalid={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
          setOpen(true);
        }}
      />
      <Popover.Trigger
        ref={triggerRef}
        data-slot="premium-date-time-input"
        data-picker-type={type}
        type="button"
        disabled={disabled}
        aria-required={required || undefined}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between rounded-lg border border-white/10 bg-[#06111d]/70 px-3 text-left text-sm text-[#eee9dd] shadow-[inset_0_1px_rgba(255,255,255,.025)] transition outline-none hover:border-[#d9b966]/30 hover:bg-[#0a1928] focus-visible:border-[#d9b966]/55 focus-visible:ring-2 focus-visible:ring-[#d9b966]/15 disabled:pointer-events-none disabled:opacity-50",
          !value && "text-[#627184]",
          className,
        )}
      >
        <span>{displayValue(type, value)}</span>
        {type === "date" ? <CalendarDays className="size-4 text-[#d9b966]" /> : <Clock3 className="size-4 text-[#d9b966]" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-[100]">
          <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#d9b966]/25 bg-[#071421] p-3 text-[#eee9dd] shadow-[0_24px_80px_rgba(0,0,0,.65)] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            {type === "date" ? (
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <button type="button" aria-label="Previous month" onClick={() => setMonth((current) => addMonths(current, -1))} className="rounded-lg p-2 hover:bg-white/10">
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="font-semibold tracking-wide">{format(month, "MMMM yyyy")}</p>
                  <button type="button" aria-label="Next month" onClick={() => setMonth((current) => addMonths(current, 1))} className="rounded-lg p-2 hover:bg-white/10">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-[#d9b966]">
                  {['Mo','Tu','We','Th','Fr','Sa','Su'].map((day) => <span key={day} className="py-1">{day}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const iso = format(day, "yyyy-MM-dd");
                    const outsideRange = (min && iso < String(min)) || (max && iso > String(max));
                    const selected = selectedDate && isValid(selectedDate) && isSameDay(day, selectedDate);
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={Boolean(outsideRange)}
                        onClick={() => { commit(iso); setOpen(false); }}
                        className={cn(
                          "relative grid aspect-square place-items-center rounded-lg text-sm transition hover:bg-[#d9b966]/15 disabled:cursor-not-allowed disabled:opacity-25",
                          !isSameMonth(day, month) && "text-[#627184]",
                          selected && "bg-[#d9b966] font-bold text-[#07111c] hover:bg-[#e6ca80]",
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  {!required ? <button type="button" onClick={() => { commit(""); setOpen(false); }} className="text-[#93a0b1] hover:text-white">Clear</button> : <span />}
                  <button type="button" onClick={() => { const today = new Date(); setMonth(today); commit(format(today, "yyyy-MM-dd")); setOpen(false); }} className="rounded-lg border border-[#d9b966]/25 px-3 py-1.5 text-[#e6ca80] hover:bg-[#d9b966]/10">Today</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[.18em] text-[#d9b966]">Select time</p>
                    <p className="mt-1 text-2xl font-semibold">{displayValue("time", value)}</p>
                  </div>
                  <Clock3 className="size-5 text-[#d9b966]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#93a0b1]">Hour</p>
                    <div className="premium-time-scroll grid max-h-56 grid-cols-3 gap-1 overflow-y-auto pr-1">
                      {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")).map((hour) => (
                        <button key={hour} type="button" onClick={() => commit(`${hour}:${selectedMinute || "00"}`)} className={cn("rounded-lg px-2 py-2 text-sm hover:bg-[#d9b966]/15", selectedHour === hour && "bg-[#d9b966] font-bold text-[#07111c]")}>{hour}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#93a0b1]">Minute</p>
                    <div className="premium-time-scroll grid max-h-56 grid-cols-3 gap-1 overflow-y-auto pr-1">
                      {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map((minute) => (
                        <button key={minute} type="button" onClick={() => commit(`${selectedHour || "00"}:${minute}`)} className={cn("rounded-lg px-2 py-2 text-sm hover:bg-[#d9b966]/15", selectedMinute === minute && "bg-[#d9b966] font-bold text-[#07111c]")}>{minute}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end border-t border-white/10 pt-3">
                  <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 rounded-lg bg-[#d9b966] px-4 py-2 text-sm font-bold text-[#07111c]">
                    <Check className="size-4" /> Done
                  </button>
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
