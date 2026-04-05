import { useEffect, useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";

interface TimeWheelPickerSlot {
  time: string;
  available: boolean;
}

interface TimeWheelPickerProps {
  value: string;
  onChange: (time: string) => void;
  timeSlots: TimeWheelPickerSlot[];
  loading?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}

const getHours = (times: string[]) =>
  Array.from(new Set(times.map((time) => time.split(":")[0])));

const getMinutesForHour = (times: string[], hour: string) =>
  Array.from(
    new Set(
      times
        .filter((time) => time.startsWith(`${hour}:`))
        .map((time) => time.split(":")[1]),
    ),
  );

const getDraftSelection = (currentValue: string, times: string[]) => {
  if (!times.length) {
    return { hour: "", minute: "" };
  }

  const fallbackTime = times.includes(currentValue) ? currentValue : times[0];
  const [hour = "", minute = ""] = fallbackTime.split(":");

  return { hour, minute };
};

interface NativeSelectFieldProps {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const NativeSelectField = ({
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: NativeSelectFieldProps) => (
  <label className="space-y-2">
    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </span>

    <div className="relative">
      <select
        value={value}
        disabled={disabled || !options.length}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  </label>
);

export const TimeWheelPicker = ({
  value,
  onChange,
  timeSlots,
  loading = false,
  placeholder = "Zeit wählen",
  emptyLabel = "Geschlossen",
  className,
}: TimeWheelPickerProps) => {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState("");
  const [draftMinute, setDraftMinute] = useState("");
  const [manualInput, setManualInput] = useState("");

  const availableTimes = timeSlots
    .filter((slot) => slot.available)
    .map((slot) => slot.time);
  const hourOptions = getHours(availableTimes);
  const minuteOptions = draftHour
    ? getMinutesForHour(availableTimes, draftHour)
    : [];
  const hasOptions = availableTimes.length > 0;

  useEffect(() => {
    const nextTimes = timeSlots
      .filter((slot) => slot.available)
      .map((slot) => slot.time);
    const { hour, minute } = getDraftSelection(value, nextTimes);

    setDraftHour(hour);
    setDraftMinute(minute);
    setManualInput(hour && minute ? `${hour}:${minute}` : "");
  }, [value, timeSlots]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const { hour, minute } = getDraftSelection(value, availableTimes);

      setDraftHour(hour);
      setDraftMinute(minute);
      setManualInput(hour && minute ? `${hour}:${minute}` : "");
    }

    setOpen(nextOpen);
  };

  const handleHourSelect = (hour: string) => {
    const nextMinutes = getMinutesForHour(availableTimes, hour);

    setDraftHour(hour);
    setDraftMinute((currentMinute) =>
      nextMinutes.includes(currentMinute) ? currentMinute : (nextMinutes[0] ?? ""),
    );
  };

  const handleManualInputChange = (nextValue: string) => {
    let formatted = nextValue.replace(/[^\d]/g, "");
    if (formatted.length > 4) formatted = formatted.slice(0, 4);
    if (formatted.length >= 3) {
      formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
    }

    setManualInput(formatted);

    const match = formatted.match(/^(\d{2}):(\d{2})$/);
    if (!match) return;

    const typed = `${match[1]}:${match[2]}`;
    if (!availableTimes.includes(typed)) return;

    setDraftHour(match[1]);
    setDraftMinute(match[2]);
  };

  const handleManualInputSubmit = () => {
    const match = manualInput.match(/^(\d{2}):(\d{2})$/);
    if (!match) return;

    const typed = `${match[1]}:${match[2]}`;
    if (!availableTimes.includes(typed)) return;

    onChange(typed);
    setOpen(false);
  };

  const handleApply = () => {
    if (!draftHour || !draftMinute) return;

    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  };

  const triggerLabel = loading
    ? "Laden..."
    : value || (hasOptions ? placeholder : emptyLabel);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !hasOptions}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Clock3 className="h-4 w-4 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[110] w-[320px] max-w-[calc(100vw-2rem)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-4 py-3 space-y-2">
          <p className="text-sm font-medium">Zeit auswählen</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualInput}
              inputMode="numeric"
              placeholder="HH:MM"
              maxLength={5}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleManualInputSubmit();
                }
              }}
              onChange={(e) => handleManualInputChange(e.target.value)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">oder wählen:</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <NativeSelectField
            label="Stunde"
            value={draftHour}
            options={hourOptions}
            placeholder="HH"
            onChange={handleHourSelect}
          />

          <NativeSelectField
            label="Minuten"
            value={draftMinute}
            options={minuteOptions}
            placeholder="MM"
            disabled={!draftHour}
            onChange={setDraftMinute}
          />
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Ausgewählt
            </p>
            <p className="text-xl font-semibold">
              {draftHour && draftMinute ? `${draftHour}:${draftMinute}` : "--:--"}
            </p>
          </div>

          <Button type="button" onClick={handleApply} disabled={!draftHour || !draftMinute}>
            Zeit übernehmen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
