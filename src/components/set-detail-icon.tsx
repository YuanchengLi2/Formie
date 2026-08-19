import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { colors } from "@/theme/colors";

export type SetDetailIconName = "dumbbell" | "hash" | "weight" | "scale" | "hand" | "machine" | "chevron";

export function SetDetailIcon({ name, size = 22, color = colors.gold }: { name: SetDetailIconName; size?: number; color?: string }) {
  const common = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {name === "dumbbell" ? <>
        <Path {...common} d="M4 9v6m3-8v10m10-10v10m3-8v6M7 12h10M2 10v4m20-4v4" />
      </> : null}
      {name === "hash" ? <>
        <Line {...common} x1="9" x2="7" y1="3" y2="21" /><Line {...common} x1="17" x2="15" y1="3" y2="21" /><Line {...common} x1="4" x2="20" y1="9" y2="9" /><Line {...common} x1="3" x2="19" y1="15" y2="15" />
      </> : null}
      {name === "weight" ? <>
        <Path {...common} d="M7 7h10l2 13H5L7 7Z" /><Path {...common} d="M9 7a3 3 0 0 1 6 0" /><Line {...common} x1="12" x2="12" y1="11" y2="15" />
      </> : null}
      {name === "scale" ? <>
        <Rect {...common} x="4" y="4" width="16" height="16" rx="3" /><Path {...common} d="M8 9a5 5 0 0 1 8 0M12 9v4m0 0 2-1" />
      </> : null}
      {name === "hand" ? <Path {...common} d="M7 12V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7l1-2a1.5 1.5 0 0 1 2.7 1.2l-2 5A5 5 0 0 1 13 20h-1a5 5 0 0 1-5-5v-3Z" /> : null}
      {name === "machine" ? <>
        <Rect {...common} x="5" y="4" width="14" height="16" rx="2" /><Line {...common} x1="9" x2="15" y1="8" y2="8" /><Circle {...common} cx="12" cy="13" r="2" /><Line {...common} x1="9" x2="15" y1="17" y2="17" />
      </> : null}
      {name === "chevron" ? <Path {...common} d="m9 5 7 7-7 7" /> : null}
    </Svg>
  );
}
