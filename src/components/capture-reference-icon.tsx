import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { colors } from "@/theme/colors";

export type CaptureReferenceIconName =
  | "back"
  | "play"
  | "pause"
  | "camera"
  | "chevron"
  | "quota"
  | "fullBody"
  | "sideAngle"
  | "phone"
  | "lighting"
  | "check"
  | "fullscreen"
  | "shieldCheck"
  | "list";

type CaptureReferenceIconProps = {
  name: CaptureReferenceIconName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
};

export function CaptureReferenceIcon({
  name,
  size = 24,
  color = colors.gold,
  accessibilityLabel,
}: CaptureReferenceIconProps) {
  const common = {
    fill: "none",
    stroke: color,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <Svg
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {name === "back" ? <Path {...common} d="M14.5 5 7.5 12l7 7" /> : null}
      {name === "play" ? <Path d="M8 5.5v13l10-6.5L8 5.5Z" fill={color} /> : null}
      {name === "pause" ? (
        <>
          <Rect fill={color} height="13" rx="1" width="3" x="7" y="5.5" />
          <Rect fill={color} height="13" rx="1" width="3" x="14" y="5.5" />
        </>
      ) : null}
      {name === "camera" ? (
        <>
          <Path {...common} d="M3 8.5h3.2l1.5-2.3h8.6l1.5 2.3H21v10.8H3V8.5Z" />
          <Circle {...common} cx="12" cy="13.8" r="4" />
        </>
      ) : null}
      {name === "chevron" ? <Path {...common} d="m9.5 5.5 6.5 6.5-6.5 6.5" /> : null}
      {name === "quota" ? (
        <>
          <Rect {...common} height="6" rx="1" width="3" x="3" y="15" />
          <Rect {...common} height="11" rx="1" width="3" x="10.5" y="10" />
          <Rect {...common} height="17" rx="1" width="3" x="18" y="4" />
        </>
      ) : null}
      {name === "fullBody" ? (
        <>
          <Circle {...common} cx="12" cy="3.5" r="1.7" />
          <Path {...common} d="M10.2 6.1 8 8.2 5.2 9.8M13.8 6.1 16 8.2l2.8 1.6M10 6.2l-.8 6.3L8 20.7M14 6.2l.8 6.3 1.2 8.2M9.2 12.5l2.8 2.2 2.8-2.2M12 7v7.7" />
        </>
      ) : null}
      {name === "sideAngle" ? (
        <>
          <Circle {...common} cx="10.5" cy="4" r="1.7" />
          <Path {...common} d="M10.3 6.2 9 11.2l2.2 3.1 3.8.2M9.1 11.2l-1.5 5.4 1.2 4M11.2 14.3l4.5 3.2 3 .2M8.8 7.7l4.5 2.1" />
        </>
      ) : null}
      {name === "phone" ? (
        <>
          <Rect {...common} height="12" rx="1.5" width="20" x="2" y="6" />
          <Line {...common} x1="5" x2="5" y1="8" y2="16" />
          <Line {...common} x1="19" x2="19" y1="8" y2="16" />
          <Circle cx="20.5" cy="12" fill={color} r="0.7" />
        </>
      ) : null}
      {name === "lighting" ? (
        <>
          <Circle {...common} cx="12" cy="12" r="4.2" />
          <Line {...common} x1="12" x2="12" y1="2" y2="5" />
          <Line {...common} x1="12" x2="12" y1="19" y2="22" />
          <Line {...common} x1="2" x2="5" y1="12" y2="12" />
          <Line {...common} x1="19" x2="22" y1="12" y2="12" />
          <Line {...common} x1="4.9" x2="7" y1="4.9" y2="7" />
          <Line {...common} x1="17" x2="19.1" y1="17" y2="19.1" />
          <Line {...common} x1="17" x2="19.1" y1="7" y2="4.9" />
          <Line {...common} x1="4.9" x2="7" y1="19.1" y2="17" />
        </>
      ) : null}
      {name === "check" ? <Path {...common} d="m6.7 12.2 3.4 3.4 7.2-8" strokeWidth="2.2" /> : null}
      {name === "fullscreen" ? (
        <>
          <Path {...common} d="M8.5 4H4v4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5" />
        </>
      ) : null}
      {name === "shieldCheck" ? (
        <>
          <Path {...common} d="M12 2.8 19 5.5v5.8c0 4.7-2.8 7.9-7 9.9-4.2-2-7-5.2-7-9.9V5.5L12 2.8Z" />
          <Path {...common} d="m8.7 12 2.1 2.1 4.5-5" strokeWidth="2" />
        </>
      ) : null}
      {name === "list" ? (
        <>
          <Circle cx="5" cy="7" fill={color} r="1" />
          <Circle cx="5" cy="12" fill={color} r="1" />
          <Circle cx="5" cy="17" fill={color} r="1" />
          <Line {...common} x1="9" x2="20" y1="7" y2="7" />
          <Line {...common} x1="9" x2="20" y1="12" y2="12" />
          <Line {...common} x1="9" x2="20" y1="17" y2="17" />
        </>
      ) : null}
    </Svg>
  );
}
