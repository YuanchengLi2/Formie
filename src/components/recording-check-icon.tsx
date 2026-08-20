import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "@/theme/colors";

export type RecordingCheckIconName = "distance" | "body" | "movement" | "stable" | "blocked" | "samePosition";

export function RecordingCheckIcon({ name, size = 42, color = colors.gold }: { name: RecordingCheckIconName; size?: number; color?: string }) {
  const stroke = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {name === "distance" ? <>
        <Rect {...stroke} x="3" y="5" width="18" height="12" rx="2" />
        <Circle {...stroke} cx="12" cy="11" r="3" />
        <Path {...stroke} d="M4 21h16M6 19l-2 2 2 2M18 19l2 2-2 2" />
      </> : null}
      {name === "body" ? <>
        <Circle {...stroke} cx="12" cy="3.5" r="1.8" />
        <Path {...stroke} d="M12 6.5v7m0-4-5 4m5-4 5 4m-5 0-4 7m4-7 4 7" />
      </> : null}
      {name === "movement" ? <>
        <Circle {...stroke} cx="7" cy="5" r="1.8" />
        <Path {...stroke} d="M7 8v6m0-3 5-3m-5 6-3 6m3-6 6 5M14 4h7m-2-2 2 2-2 2M15 13h6m-2-2 2 2-2 2" />
      </> : null}
      {name === "stable" ? <>
        <Path {...stroke} d="M4 17h16M7 17V8h10v9M9 8V5h6v3M4 21h16" />
      </> : null}
      {name === "blocked" ? <>
        <Rect {...stroke} x="4" y="4" width="16" height="16" rx="3" />
        <Path {...stroke} d="M7 17 17 7M8 8h3M13 16h3" />
      </> : null}
      {name === "samePosition" ? <>
        <Rect {...stroke} x="4" y="5" width="16" height="14" rx="2" />
        <Path {...stroke} d="M12 5v14M7 9h2M15 9h2M7 15h2M15 15h2" />
        <Circle {...stroke} cx="12" cy="12" r="2" />
      </> : null}
    </Svg>
  );
}
