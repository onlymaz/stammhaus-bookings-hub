import { useEffect, useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  }, [value, timeSlots]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const { hour, minute } = getDraftSelection(value, availableTimes);

      setDraftHour(hour);
      setDraftMinute(minute);
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
      >
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Zeit auswählen</p>
          <p className="text-xs text-muted-foreground">
            Wie beim Handy-Wecker: Stunde und Minuten getrennt wählen.
          </p>
        </div>

        <div className="grid grid-cols-2">
          <div className="border-r px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Stunde
            </p>
            <ScrollArea className="h-52 pr-2">
              <div className="space-y-1">
                {hourOptions.map((hour) => (
                  <Button
                    key={hour}
                    type="button"
                    variant={draftHour === hour ? "default" : "ghost"}
                    className={cn(
                      "h-11 w-full justify-center text-lg font-semibold",
                      draftHour === hour && "shadow-sm",
                    )}
                    onClick={() => handleHourSelect(hour)}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Minuten
            </p>
            <ScrollArea className="h-52 pr-2">
              <div className="space-y-1">
                {minuteOptions.map((minute) => (
                  <Button
                    key={minute}
                    type="button"
                    variant={draftMinute === minute ? "default" : "ghost"}
                    className={cn(
                      "h-11 w-full justify-center text-lg font-semibold",
                      draftMinute === minute && "shadow-sm",
                    )}
                    onClick={() => setDraftMinute(minute)}
                  >
                    {minute}
                  </Button>
                ))}
              </div>
            </ScrollArea>
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
  );
};
