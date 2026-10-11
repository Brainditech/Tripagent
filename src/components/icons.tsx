import Svg, { Circle, Path, Rect } from "react-native-svg";

// Small vector icons shared by the screens, drawn after the mockups in design/.

type IconProps = { width?: number; color?: string };

const INK = "#111111";

// Outlined calendar with two posts. Aspect ratio 19:21 like the reference.
export function CalendarIcon({ width = 12, color = INK, strokeWidth = 2 }: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={width} height={(width * 21) / 19} viewBox="2.5 2 19 21" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined map pin with a hollow dot.
export function PinIcon({ width = 13, color = INK }: IconProps) {
  return (
    <Svg width={width} height={(width * 24) / 20} viewBox="2 0 20 24" fill="none">
      <Path
        d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.8} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

// Outlined wallet with its flap and side pocket.
export function WalletIcon({ width = 14, color = INK }: IconProps) {
  return (
    <Svg width={width} height={(width * 20) / 22} viewBox="1 2 22 20" fill="none">
      <Path
        d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Thin chevron pointing right. Aspect ratio 1:1.9 like the reference.
export function ChevronRightIcon({ width = 5, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width * 1.9} viewBox="0 0 10 19" fill="none">
      <Path d="M1.5 1.5l7 8-7 8" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Arrow for the "Nouveau voyage" button.
export function ArrowRightIcon({ width = 15, color = "#1C4C82" }: IconProps) {
  return (
    <Svg width={width} height={(width * 22) / 24} viewBox="0 0 24 22" fill="none">
      <Path d="M2.5 11h19M13.5 3l8 8-8 8" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Four-point star with concave sides, used for the sparkles.
function star(cx: number, cy: number, r: number) {
  const k = r * 0.22;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

// "Planificateur IA" sparkles: one large star with three small ones.
export function SparkleIcon({ width = 18, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24">
      <Path d={star(10, 13.5, 9.5)} fill={color} />
      <Path d={star(19.5, 4.5, 3.6)} fill={color} />
      <Path d={star(21, 18.5, 2.6)} fill={color} />
      <Path d={star(3.5, 3, 1.8)} fill={color} />
    </Svg>
  );
}

// Outline of a cog with `teeth` rounded teeth, centred on (12, 12).
function gearPath(teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [angle, r] of [
      [a - step * 0.2, outer],
      [a + step * 0.2, outer],
      [a + step * 0.3, inner],
      [a + step * 0.7, inner],
    ]) {
      points.push(`${(12 + r * Math.cos(angle)).toFixed(2)} ${(12 + r * Math.sin(angle)).toFixed(2)}`);
    }
  }
  return `M${points.join("L")}Z`;
}

const GEAR = gearPath(8, 10.6, 8.1);

// Outlined cog for the settings button.
export function GearIcon({ width = 21, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d={GEAR} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// Outlined bell with an unread dot in its top-right corner.
export function BellIcon({ width = 20, color = INK, dotColor = "#D9485A" }: IconProps & { dotColor?: string }) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M10.3 21a2 2 0 0 0 3.4 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={19} cy={4.6} r={3.4} fill={dotColor} stroke="#F9F9FB" strokeWidth={1.2} />
    </Svg>
  );
}

// Thin chevron pointing left, the back button.
export function ChevronLeftIcon({ width = 9, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width * 1.9} viewBox="0 0 10 19" fill="none">
      <Path d="M8.5 1.5l-7 8 7 8" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Two outlined people, for the travellers field.
export function PeopleIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={(width * 20) / 22} viewBox="1 2 22 20" fill="none">
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={2} />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined armchair, the "Confort" budget.
export function SeatIcon({ width = 19, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="1 3 22 18" fill="none">
      <Path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M5 18v2M19 18v2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined gem, the "Luxe" budget.
export function DiamondIcon({ width = 19, color = INK }: IconProps) {
  return (
    <Svg width={width} height={(width * 20) / 22} viewBox="1 2 22 20" fill="none">
      <Path d="M6 3h12l4 6-10 13L2 9z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M11 3L8 9l4 13 4-13-3-6M2 9h20" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function MinusIcon({ width = 12, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ width = 12, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4v16M4 12h16" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined camera, the "change the cover" button of the trip detail. Aspect ratio 24:20.
export function CameraIcon({ width = 20, color = INK }: IconProps) {
  return (
    <Svg width={width} height={(width * 20) / 24} viewBox="0 0 24 20" fill="none">
      <Path
        d="M8.5 1.5h7l1.8 3H20a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2.7z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11} r={3.6} stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

// Robot face in a speech bubble, for the assistant button of the trip detail.
export function BotIcon({ width = 28, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2v2.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={2.4} r={1.3} fill={color} />
      <Path
        d="M8 5.5h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-3.5 2.6v-2.7A3 3 0 0 1 5 14.5v-6a3 3 0 0 1 3-3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={9.6} cy={11.2} r={1.3} fill={color} />
      <Circle cx={14.4} cy={11.2} r={1.3} fill={color} />
      <Path d="M9.8 14.6h4.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined bin, for the "delete" menu item.
export function TrashIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M10 11v6M14 11v6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path
        d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Outlined magnifier, the "Repérage des lieux" stage.
export function SearchIcon({ width = 22, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={2.2} />
      <Path d="M15.5 15.5l5 5" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

// Dotted route between two pins, the "Création de l'itinéraire" stage. `endColor` tints the arrival pin.
export function RouteIcon({ width = 22, color = INK, endColor = color }: IconProps & { endColor?: string }) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 16.5c4.5 0 3-7 7.5-8.5 1.5-.5 2.5-.5 4-.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2.6 2.6"
      />
      <Circle cx={5} cy={18} r={3} fill={color} />
      <Circle cx={19.5} cy={6} r={3} fill={endColor} />
    </Svg>
  );
}

// Check mark of a finished stage.
export function CheckIcon({ width = 20, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
