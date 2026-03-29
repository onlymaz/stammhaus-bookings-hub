import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const formatKeyboardTime = (rawValue: string) => {
  const sanitized = rawValue.replace(/[^\d:]/g, "").slice(0, 5);

  if (sanitized.includes(":")) {
    const [hour = "", minute = ""] = sanitized.split(":");
    return `${hour.slice(0, 2)}${sanitized.includes(":") ? ":" : ""}${minute.slice(0, 2)}`;
  }

  const digits = sanitized.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const parseKeyboardTime = (rawValue: string) => {
  const cleaned = rawValue.trim();

  if (!cleaned) return null;

  if (cleaned.includes(":")) {
    const [hour = "", minute = ""] = cleaned.split(":");
    if (!hour || minute.length !== 2) return null;

    return `${hour.padStart(2, "0").slice(-2)}:${minute}`;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 3) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }

  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  return null;
};

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
  const [keyboardValue, setKeyboardValue] = useState("");
  const [keyboardError, setKeyboardError] = useState("");
  const [popoverContainer, setPopoverContainer] = useState<HTMLElement | null>(null);
  const pickerRootRef = useRef<HTMLDivElement | null>(null);
  const selectedHourRef = useRef<HTMLButtonElement | null>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement | null>(null);

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
    setKeyboardValue(hour && minute ? `${hour}:${minute}` : "");
    setKeyboardError("");
  }, [value, timeSlots]);

  useEffect(() => {
    setPopoverContainer(
      pickerRootRef.current?.closest('[role="dialog"]') as HTMLElement | null,
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    selectedHourRef.current?.scrollIntoView({ block: "center" });
    selectedMinuteRef.current?.scrollIntoView({ block: "center" });
  }, [open, draftHour, draftMinute]);

  const updateDraftTime = (nextTime: string) => {
    const [hour = "", minute = ""] = nextTime.split(":");
    setDraftHour(hour);
    setDraftMinute(minute);
    setKeyboardValue(nextTime);
    setKeyboardError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const { hour, minute } = getDraftSelection(value, availableTimes);

      setDraftHour(hour);
      setDraftMinute(minute);
      setKeyboardValue(hour && minute ? `${hour}:${minute}` : "");
      setKeyboardError("");
    }

    setOpen(nextOpen);
  };

  const handleHourSelect = (hour: string) => {
    const nextMinutes = getMinutesForHour(availableTimes, hour);
    const nextMinute = nextMinutes.includes(draftMinute) ? draftMinute : (nextMinutes[0] ?? "");

    setDraftHour(hour);
    setDraftMinute(nextMinute);
    setKeyboardValue(hour && nextMinute ? `${hour}:${nextMinute}` : hour);
    setKeyboardError("");
  };

  const handleApply = () => {
    if (!draftHour || !draftMinute) return;

    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  };

  const handleKeyboardChange = (rawValue: string) => {
    const formattedValue = formatKeyboardTime(rawValue);
    const parsedTime = parseKeyboardTime(formattedValue);

    setKeyboardValue(formattedValue);

    if (!parsedTime) {
      setKeyboardError("");
      return;
    }

    if (!availableTimes.includes(parsedTime)) {
      setKeyboardError("Diese Zeit ist nicht verfuegbar.");
      return;
    }

    updateDraftTime(parsedTime);
  };

  const handleKeyboardApply = () => {
    const parsedTime = parseKeyboardTime(keyboardValue);

    if (!parsedTime || !availableTimes.includes(parsedTime)) {
      setKeyboardError("Bitte eine verfuegbare Zeit wie 11:15 eingeben.");
      return;
    }

    onChange(parsedTime);
    setOpen(false);
  };

  const triggerLabel = loading
    ? "Laden..."
    : value || (hasOptions ? placeholder : emptyLabel);

  return (
    <div ref={pickerRootRef}>
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
        container={popoverContainer}
        align="start"
        sideOffset={6}
        className="z-[110] w-[320px] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="border-b px-4 py-3 space-y-3">
          <div>
          <p className="text-sm font-medium">Zeit auswählen</p>
          <p className="text-xs text-muted-foreground">
            Wie beim Handy-Wecker: Stunde und Minuten getrennt wählen.
          </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Mit Tastatur eingeben
            </p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="11:15"
              value={keyboardValue}
              onChange={(event) => handleKeyboardChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleKeyboardApply();
                }
              }}
              className="h-10"
            />
            <p className={cn(
              "text-xs",
              keyboardError ? "text-destructive" : "text-muted-foreground",
            )}>
              {keyboardError || "Tipp: 11:15 eingeben und Enter druecken."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2">
          <div className="border-r px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Stunde
            </p>
            <div
              className="h-52 overflow-y-auto overscroll-contain pr-2"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="space-y-1">
                {hourOptions.map((hour) => (
                  <Button
                    key={hour}
                    ref={draftHour === hour ? selectedHourRef : null}
                    type="button"
                    variant={draftHour === hour ? "default" : "ghost"}
                    className={cn(
                      "h-11 w-full justify-center text-lg font-semibold touch-pan-y",
                      draftHour === hour && "shadow-sm",
                    )}
                    style={{ touchAction: "pan-y" }}
                    onClick={() => handleHourSelect(hour)}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Minuten
            </p>
            <div
              className="h-52 overflow-y-auto overscroll-contain pr-2"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="space-y-1">
                {minuteOptions.map((minute) => (
                  <Button
                    key={minute}
                    ref={draftMinute === minute ? selectedMinuteRef : null}
                    type="button"
                    variant={draftMinute === minute ? "default" : "ghost"}
                    className={cn(
                      "h-11 w-full justify-center text-lg font-semibold touch-pan-y",
                      draftMinute === minute && "shadow-sm",
                    )}
                    style={{ touchAction: "pan-y" }}
                    onClick={() => setDraftMinute(minute)}
                  >
                    {minute}
                  </Button>
                ))}
              </div>
            </div>
          </div>
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
    </div>
  );
};
