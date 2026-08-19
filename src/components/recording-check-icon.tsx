import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { colors } from "@/theme/colors";

export type RecordingCheckIconName = "distance" | "body" | "movement" | "stable" | "blocked" | "samePosition";

export function RecordingCheckIcon({ name, size = 42, color = colors.gold }: { name: RecordingCheckIconName; size?: number; color?: string }) {
  const stroke = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.7 };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
      {name === "distance" ? <>
        <Rect {...stroke} x="8" y="13" width="32" height="22" rx="3" />
        <Circle {...stroke} cx="24" cy="23" r="6" />
        <Path {...stroke} d="M4 39h40M8 9h32" />
        <Path {...stroke} d="M4 39l4-4m-4 4 4 4M44 39l-4-4m4 4-4 4" />
      </> : null}
      {name === "body" ? <>
        <Circle {...stroke} cx="24" cy="8" r="3" />
        <Path {...stroke} d="M24 12v13m0-8-8 7m8-7 8 7M24 25l-7 13m7-13 7 13M17 38h-4m18 0h4" />
      </> : null}
      {name === "movement" ? <>
        <Circle {...stroke} cx="15" cy="12" r="3" />
        <Path {...stroke} d="M15 16v13m0-8 8-6m-8 6-7 6m7 2-5 10m5-10 9 8" />
        <Path {...stroke} d="M30 11h10m-4-4 4 4-4 4M30 37h10m-4-4 4 4-4 4" />
      </> : null}
      {name === "stable" ? <>
        <Path {...stroke} d="M8 34h32M13 34V19m22 15V19M10 19h28" />
        <Path {...stroke} d="M17 19v-5h14v5" />
        <Path {...stroke} d="M8 40c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 8 0" />
      </> : null}
      {name === "blocked" ? <>
        <Circle {...stroke} cx="24" cy="24" r="15" />
        <Path {...stroke} d="m14 14 20 20" />
        <Circle {...stroke} cx="24" cy="17" r="2" />
        <Path {...stroke} d="M24 20v10m-6 6h12" />
      </> : null}
      {name === "samePosition" ? <>
        <Rect {...stroke} x="8" y="11" width="32" height="26" rx="3" />
        <Circle {...stroke} cx="18" cy="22" r="3" />
        <Circle {...stroke} cx="30" cy="22" r="3" />
        <Path {...stroke} d="M18 25v7m12-7v7M14 32h8m4 0h8" />
        <Line {...stroke} x1="24" x2="24" y1="15" y2="33" />
      </> : null}
    </Svg>
  );
}
