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

// Outlined bell with an unread dot in its top-right corner (`dot={false}` for the plain bell).
export function BellIcon({
  width = 20,
  color = INK,
  dot = true,
  dotColor = "#D9485A",
}: IconProps & { dot?: boolean; dotColor?: string }) {
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
      {dot ? <Circle cx={19} cy={4.6} r={3.4} fill={dotColor} stroke="#F9F9FB" strokeWidth={1.2} /> : null}
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

// Filled paper plane, the send button of the assistant (Material "send").
export function SendIcon({ width = 22, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24">
      <Path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={color} />
    </Svg>
  );
}

// Three dots in a row, the "more" button.
export function MoreIcon({ width = 20, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24">
      <Circle cx={5} cy={12} r={2.2} fill={color} />
      <Circle cx={12} cy={12} r={2.2} fill={color} />
      <Circle cx={19} cy={12} r={2.2} fill={color} />
    </Svg>
  );
}

// Icons of the Profil tab, after design/profile-ui-design-1-top.png and -2-scrolled.png.

// Filled aeroplane seen from above, the "Voyages" figure.
export function PlaneIcon({ width = 15, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24">
      <Path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill={color} />
    </Svg>
  );
}

// Outlined globe with its equator and one meridian, the "Destinations" figure.
export function GlobeIcon({ width = 15, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path
        d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Three sliders, the "Préférences de voyage" row.
export function TuneIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h9.6M17.4 6H21M3 12h3.6M11.4 12H21M3 18h9.6M17.4 18H21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={15} cy={6} r={2.2} stroke={color} strokeWidth={1.8} />
      <Circle cx={9} cy={12} r={2.2} stroke={color} strokeWidth={1.8} />
      <Circle cx={15} cy={18} r={2.2} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// Outlined ticket with its side notches and perforation, the "Quota mensuel" row.
export function TicketIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M15 6.5v1.5M15 11v2M15 16v1.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Outlined crescent moon, the "Apparence" row.
export function MoonIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

// A latin "A" beside an ideograph, the "Langue" row.
export function TranslateIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h9M7.5 4v2M10.5 6c-.7 3.8-3.4 6.9-7.5 8.6M5.3 9.4c1 2.3 2.9 4.1 5.4 5.2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12.5 20l3.8-9.5 3.8 9.5M13.9 16.5h4.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Question mark in a circle, the "Aide et support" row.
export function HelpIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M9.3 9.5a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.2 1-1.2 1.8v.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={17.2} r={1} fill={color} />
    </Svg>
  );
}

// Outlined shield with a check mark, the "Politique de confidentialité" row.
export function ShieldIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7.5 2.8v5.4c0 4.5-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5.3-7.5-9.8V5.8z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9 12l2.1 2.1L15 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Outlined sheet with a folded corner and two lines, the "Conditions d'utilisation" row.
export function DocumentIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v5h5M9 13h6M9 17h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Outlined five-point star, the "Noter Tripagent" row.
export function StarIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Outlined gift box with its bow, the "Inviter des amis" row.
export function GiftIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM3 7h18v4H3zM12 7v14" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path
        d="M12 7c-.8-2.4-3.6-2.6-3.6-.9 0 1.1 2 1 3.6.9zm0 0c.8-2.4 3.6-2.6 3.6-.9 0 1.1-2 1-3.6.9z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Door frame with an arrow leaving it, the "Se déconnecter" button.
export function LogoutIcon({ width = 18, color = INK }: IconProps) {
  return (
    <Svg width={width} height={width} viewBox="0 0 24 24" fill="none">
      <Path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M15 8l4 4-4 4M19 12H9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
