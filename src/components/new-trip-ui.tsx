import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon } from "@/components/icons";

// Building blocks of the "Nouveau voyage" screen (src/app/(app)/new-trip.tsx), sized after
// design/new-trip-ui-design-1-top.jpg (1 px = 0.679 dp) and design/new-trip-ui-design-2-scrolled.jpg
// (1 px = 0.536 dp). The first mockup sets the palette; the second only adds the lower sections.

export const NEW_TRIP_COLORS = {
  page: "#EBEDF2",
  field: "#EEF0F5",
  border: "#CDD0D9",
  accent: "#4C97F7",
  accentSoft: "#C4DAF8",
  ink: "#1A1A1A",
  icon: "#5B6068",
  muted: "#6B7079",
  disabled: "#B5B9C2",
} as const;

export const SOFT_SHADOW = { boxShadow: "0 3px 10px rgba(20, 30, 60, 0.10)" } as const;
const GLOW = { boxShadow: "0 0 10px rgba(76, 151, 247, 0.45)" } as const;

export function SectionLabel({ children, right, className = "" }: { children: string; right?: ReactNode; className?: string }) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text className="font-sans-bold text-[18px] leading-[24px] text-[#111111]">{children}</Text>
      {right}
    </View>
  );
}

/** Rounded input-like container: a border on a slightly lighter background. */
export function Field({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`h-[47px] flex-row items-center rounded-[10px] border border-[#CDD0D9] bg-[#EEF0F5] pl-[15px] pr-[8px] ${className}`}
    >
      {children}
    </View>
  );
}

type PillProps = { label: string; icon?: ReactNode; selected: boolean; onPress?: () => void };

/** One option of a single-choice row: soft blue fill and glow when selected. */
export function Pill({ label, icon, selected, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`h-[40px] flex-1 flex-row items-center justify-center rounded-full border-[1.5px] ${
        selected ? "border-[#4C97F7] bg-[#C4DAF8]" : "border-[#C9CCD3] bg-[#EEF0F5]"
      }`}
      style={selected ? GLOW : undefined}
    >
      {icon ? <View className="mr-[8px]">{icon}</View> : null}
      <Text
        numberOfLines={1}
        className={`font-sans-medium text-[16px] leading-[20px] ${selected ? "text-[#1E3F6E]" : "text-[#2A2D33]"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** One option of a multiple-choice wrap: filled with the accent when selected. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`h-[31px] justify-center rounded-full px-[12px] ${selected ? "bg-[#4C97F7]" : "bg-[#E2E5EB]"}`}
    >
      <Text className={`font-sans text-[15px] leading-[19px] ${selected ? "text-white" : "text-[#2A2D33]"}`}>{label}</Text>
    </Pressable>
  );
}

function RoundButton({ icon, onPress, label }: { icon: ReactNode; onPress?: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#DFE2E8]"
    >
      {icon}
    </Pressable>
  );
}

export function Stepper({
  onDecrement,
  onIncrement,
  labels,
}: {
  onDecrement?: () => void;
  onIncrement?: () => void;
  labels: { decrement: string; increment: string };
}) {
  return (
    <View className="flex-row items-center gap-[12px]">
      <RoundButton icon={<MinusIcon />} onPress={onDecrement} label={labels.decrement} />
      <RoundButton icon={<PlusIcon />} onPress={onIncrement} label={labels.increment} />
    </View>
  );
}

// --- Calendar ---------------------------------------------------------------------------------

/** A trip's dates: a single day while `to` is null, otherwise an inclusive range. */
export type DateRange = { from: Date; to: Date | null };

/** The same calendar day at midnight, so days compare by time value. */
export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Number of calendar days covered by the range, inclusive. */
export function rangeDays({ from, to }: DateRange) {
  if (!to) return 1;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1;
}

type CalendarProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** First selectable day; earlier days are shown but disabled. */
  minDate: Date;
  /** Twelve month names, January first, as displayed in the header. */
  months: readonly string[];
  /** Seven one-letter weekday headers, Sunday first. */
  weekdays: readonly string[];
  rangeLabel: string;
  labels: { previousMonth: string; nextMonth: string };
  /** Longest range allowed, in days. A tap further away starts a new range instead of closing this one. */
  maxDays?: number;
};

function MonthButton({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="h-[36px] w-[36px] items-center justify-center"
    >
      {children}
    </Pressable>
  );
}

/**
 * Month grid with a selectable range. The first tap starts a range, a tap on a later day closes it
 * (within `maxDays`), any other tap starts over. Days before `minDate` cannot be chosen, nor can
 * the months before it.
 */
export function Calendar({ value, onChange, minDate, months, weekdays, rangeLabel, labels, maxDays }: CalendarProps) {
  const [visible, setVisible] = useState(() => ({ year: value.from.getFullYear(), month: value.from.getMonth() }));
  const min = startOfDay(minDate);
  const from = startOfDay(value.from);
  const to = value.to ? startOfDay(value.to) : null;

  const firstWeekday = new Date(visible.year, visible.month, 1).getDay();
  const daysInMonth = new Date(visible.year, visible.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const canGoBack = visible.year > min.getFullYear() || (visible.year === min.getFullYear() && visible.month > min.getMonth());
  const shiftMonth = (delta: number) =>
    setVisible(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const select = (day: Date) => {
    const closesRange =
      to === null && day.getTime() > from.getTime() && (maxDays === undefined || rangeDays({ from, to: day }) <= maxDays);
    if (closesRange) onChange({ from, to: day });
    else onChange({ from: day, to: null });
  };

  const monthName = months[visible.month];
  const title = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${visible.year}`;

  return (
    <View className="rounded-[12px] bg-[#E7E9EE] px-[8px] pb-[10px] pt-[8px]" style={SOFT_SHADOW}>
      <View className="h-[44px] flex-row items-center justify-between px-[6px]">
        <MonthButton label={labels.previousMonth} disabled={!canGoBack} onPress={() => shiftMonth(-1)}>
          <ChevronLeftIcon width={9} color={canGoBack ? "#2A2D33" : NEW_TRIP_COLORS.disabled} />
        </MonthButton>
        <Text className="font-sans-bold text-[17.5px] leading-[22px] text-[#111111]">{title}</Text>
        <MonthButton label={labels.nextMonth} disabled={false} onPress={() => shiftMonth(1)}>
          <ChevronRightIcon width={9} color="#2A2D33" />
        </MonthButton>
      </View>

      <View className="mt-[9px] h-[20px] flex-row">
        {weekdays.map((day, i) => (
          <Text key={i} className="flex-1 text-center font-sans-medium text-[14px] leading-[20px] text-[#8E9299]">
            {day}
          </Text>
        ))}
      </View>

      <View className="mt-[11px]">
        {weeks.map((week, w) => (
          <View key={w} className="h-[44px] flex-row">
            {week.map((day, d) => {
              if (day === null) return <View key={d} className="flex-1" />;
              const date = new Date(visible.year, visible.month, day);
              const time = date.getTime();
              const disabled = time < min.getTime();
              const isStart = time === from.getTime();
              const isEnd = to !== null && time === to.getTime();
              const inRange = to !== null && time >= from.getTime() && time <= to.getTime();
              const single = isStart && to === null;
              const endpoint = (isStart || isEnd) && to !== null;
              return (
                <Pressable
                  key={d}
                  onPress={disabled ? undefined : () => select(date)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: isStart || isEnd }}
                  className="flex-1 items-center justify-center"
                >
                  {inRange ? (
                    <View
                      className={`absolute top-[3px] h-[38px] bg-[#D3E2F7] ${isStart ? "left-1/2 right-0" : isEnd ? "left-0 right-1/2" : "left-0 right-0"}`}
                    />
                  ) : null}
                  {/* Keyed by state: on Android a disc that gains its fill or border after mounting keeps square
                      corners (verified on RN 0.86), so a state change remounts it with its full style. */}
                  <View
                    key={endpoint ? "endpoint" : single ? "single" : "plain"}
                    className={`h-[38px] w-[38px] items-center justify-center rounded-[19px] ${
                      endpoint ? "bg-[#4C97F7]" : single ? "border-2 border-[#4C97F7] bg-[#E5EDF8]" : ""
                    }`}
                    style={single ? GLOW : undefined}
                  >
                    <Text
                      className={`text-[17px] leading-[22px] ${
                        endpoint
                          ? "font-sans-medium text-white"
                          : single
                            ? "font-sans-medium text-[#1E3F6E]"
                            : disabled
                              ? "font-sans text-[#B5B9C2]"
                              : "font-sans text-[#1A1A1A]"
                      }`}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Text className="mt-[4px] pr-[8px] text-right font-sans text-[14px] leading-[18px] text-[#6B7079]">{rangeLabel}</Text>
    </View>
  );
}
