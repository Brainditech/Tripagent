import Svg, { Path } from "react-native-svg";

type Props = { width?: number; color?: string };

// Tripagent mark: two outlined mountains with a small "x" between their bases.
export function TripagentLogo({ width = 48, color = "#FFFFFF" }: Props) {
  return (
    <Svg width={width} height={(width * 83) / 110} viewBox="6 7 110 83">
      <Path d="M7.4 84 L41 28 L61.4 62 L49.3 66 L41.5 53 L30.1 72 L48 72 L48 84 Z" fill={color} />
      <Path
        d="M69 8 L114.6 84 L82 84 L77.6 73 L92.9 73 L69.5 34 L61.55 47.25 L53.5 33.83 Z"
        fill={color}
      />
      <Path
        d="M54.5 69.5 C60 69 63 72 65 76 S69 84 71.5 86.5 M74.5 66.5 L54 88"
        stroke={color}
        strokeWidth={5.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
