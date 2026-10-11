import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { CheckIcon } from "@/components/icons";
import type { StageState } from "@/lib/trip-progress";

// Building blocks of the progress screen (src/app/(app)/trips/[id]/progress.tsx), after
// design/trip-generating-ui-design.jpg (1 px = 0.6 dp): the illustration, a stepper of
// three stages joined by lines, and a bar that fills while the generation runs.

export const PROGRESS_COLORS = {
  page: "#EBEDF2",
  ink: "#1A1A1A",
  muted: "#5B6068",
  accent: "#4C97F7",
  accentSoft: "#C4DAF8",
  accentDeep: "#1E3F6E",
  pendingDisc: "#E2E5EB",
  pendingInk: "#9AA0AA",
  track: "#D8DDE6",
  error: "#D9485A",
} as const;

const DISC = 52;
const GLOW = { boxShadow: "0 0 12px rgba(76, 151, 247, 0.45)" } as const;

/** The 3D map with its landmarks (design/trip-generating-illustration.png), as wide as its container. */
export function Illustration() {
  return (
    <Image
      source={require("@/assets/images/trip-generating-illustration.webp")}
      className="w-full"
      style={{ aspectRatio: 1200 / 816 }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export type StepperStage = { key: string; icon: ReactNode; label: string; state: StageState };

/** The three stages side by side, joined by a line that lights up once the stage before it is done. */
export function Stepper({ stages }: { stages: StepperStage[] }) {
  return (
    <View className="flex-row">
      {stages.map((stage, index) => {
        const previous = stages[index - 1];
        return (
          <View key={stage.key} className="flex-1 items-center">
            {previous ? <Connector side="left" lit={previous.state === "done"} /> : null}
            {index < stages.length - 1 ? <Connector side="right" lit={stage.state === "done"} /> : null}
            <Disc state={stage.state}>{stage.icon}</Disc>
            <Text
              className={`mt-[8px] text-center font-sans-medium text-[13px] leading-[17px] ${
                stage.state === "pending" ? "text-[#9AA0AA]" : "text-[#1A1A1A]"
              }`}
            >
              {stage.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Half of the line between two discs, from this disc's edge to the column's edge, where the other half meets it. */
function Connector({ side, lit }: { side: "left" | "right"; lit: boolean }) {
  return (
    <View
      className={`absolute h-[2px] rounded-full ${lit ? "bg-[#4C97F7]" : "bg-[#D8DDE6]"}`}
      style={
        side === "left"
          ? { top: DISC / 2 - 1, left: 0, right: "50%", marginRight: DISC / 2 + 8 }
          : { top: DISC / 2 - 1, left: "50%", marginLeft: DISC / 2 + 8, right: 0 }
      }
    />
  );
}

/** The icon of a stage in a disc: grey while pending, glowing and pulsing while current, a check once done. */
function Disc({ state, children }: { state: StageState; children: ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value =
      state === "current"
        ? withRepeat(withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true)
        : withTiming(1, { duration: 200 });
  }, [state, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const background =
    state === "done" ? PROGRESS_COLORS.accent : state === "current" ? PROGRESS_COLORS.accentSoft : PROGRESS_COLORS.pendingDisc;
  return (
    <Animated.View
      style={[
        { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: "center", justifyContent: "center", backgroundColor: background },
        state === "current" ? GLOW : undefined,
        pulse,
      ]}
    >
      {state === "done" ? <CheckIcon width={24} /> : children}
    </Animated.View>
  );
}

type ProgressBarProps = {
  /** Where the fill heads to, from 0 to 1. */
  target: number;
  /** How long it takes to get there: long for a long step, so the bar never looks stuck. */
  durationMs: number;
  /** A failure freezes the fill where the generation stopped and turns it red. */
  failed: boolean;
};

/** The bar under the stepper: a glowing blue gradient that eases towards each step's share of the work. */
export function ProgressBar({ target, durationMs, failed }: ProgressBarProps) {
  const fill = useSharedValue(0);
  useEffect(() => {
    if (failed) return;
    fill.value = withTiming(target, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [target, durationMs, failed, fill]);
  const width = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View
      className="h-[10px] w-full rounded-full bg-[#D8DDE6]"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
    >
      <Animated.View style={[{ height: "100%", borderRadius: 5, overflow: "hidden" }, failed ? undefined : GLOW, width]}>
        <LinearGradient
          colors={failed ? [PROGRESS_COLORS.error, PROGRESS_COLORS.error] : ["#9CC6FF", PROGRESS_COLORS.accent]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          className="h-full w-full"
        />
      </Animated.View>
    </View>
  );
}
