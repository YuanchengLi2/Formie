import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { EvidenceFocusOverlay, focusVideoStyle, zoomedFocusRegion } from "@/components/evidence-focus-overlay";
import type { ReviewFrame, ReviewPurpose } from "@/features/analysis/review-frames";
import type { CoachingFinding, EvidenceMoment, RepTimelineItem, VisualFocusRegion } from "@/features/analysis/result-schema";
import { formatPointAdvice } from "@/features/analysis/evidence-timestamp";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export type PlaybackCoachingMoment = {
  id: string;
  finding: CoachingFinding;
  evidence: EvidenceMoment;
  timeMs: number;
};

export function timelineMarkerPercent(peakMs: number, durationMs: number): number {
  return Math.min(98, Math.max(2, (peakMs / Math.max(1, durationMs)) * 100));
}

export function timelineSeekMs(positionX: number, width: number, durationMs: number): number {
  const ratio = Math.min(1, Math.max(0, positionX / Math.max(1, width)));
  return Math.round(ratio * Math.max(0, durationMs));
}

export function formatPlaybackTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function clampPlaybackZoom(value: number): number {
  return Math.min(2.5, Math.max(1, value));
}

export type FocusMode = "auto" | "manual" | "full";

export function nextFrameIndex(index: number, length: number, direction: -1 | 1): number {
  if (length <= 0) return 0;
  return (index + direction + length) % length;
}

export function reviewPurposeLabel(purpose: ReviewPurpose): string {
  return purpose === "observed" ? "What happened" : purpose === "why" ? "Why it matters" : "What to do next";
}

export function focusPresentation(focus: VisualFocusRegion | null | undefined, mode: FocusMode, manualZoom = 1) {
  const validFocus = focus && focus.confidence >= 0.8 ? focus : null;
  const zoom = mode === "auto" ? 1.7 : mode === "manual" ? clampPlaybackZoom(manualZoom) : 1;
  return {
    focus: validFocus,
    zoom,
    showCircle: Boolean(validFocus),
    transformFocus: Boolean(validFocus) && mode !== "full",
  };
}

export function buildPlaybackCoachingMoments(findings: CoachingFinding[]): PlaybackCoachingMoment[] {
  return findings
    .flatMap((finding) => finding.evidence.map((evidence, index) => ({ id: `${finding.id}-${index}-${evidence.peakMs ?? evidence.startMs}`, finding, evidence, timeMs: evidence.peakMs ?? evidence.startMs })))
    .sort((left, right) => left.timeMs - right.timeMs);
}

type FullRecordingProps = {
  videoUrl: string;
  reps: RepTimelineItem[];
  durationMs: number;
  coachingFindings?: CoachingFinding[];
  reviewFrames?: ReviewFrame[];
  selectedReviewFrame?: ReviewFrame | null;
  onSelectReviewFrame?: (frame: ReviewFrame) => void;
  onOpenFinding?: (finding: CoachingFinding) => void;
};

export function FullRecording({ videoUrl, reps, durationMs, coachingFindings = [], reviewFrames, selectedReviewFrame, onSelectReviewFrame, onOpenFinding }: FullRecordingProps) {
  const player = useVideoPlayer(videoUrl);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(1);
  const [videoLayout, setVideoLayout] = useState({ width: 320, height: 480 });
  const [manualZoom, setManualZoom] = useState(1);
  const [focusMode, setFocusMode] = useState<FocusMode>("full");
  const [internalSelectedFrame, setInternalSelectedFrame] = useState<ReviewFrame | null>(null);
  const scaleRef = useRef(1);
  const pinchStartRef = useRef(1);
  const coachingMoments = useMemo(() => buildPlaybackCoachingMoments(coachingFindings), [coachingFindings]);
  const timelineFrames = useMemo<ReviewFrame[]>(() => reviewFrames
    ? reviewFrames.filter((frame) => frame.purpose === "observed")
    : coachingMoments.map((moment) => ({
      id: moment.id,
      purpose: "observed",
      title: moment.finding.title,
      body: formatPointAdvice(moment.evidence),
      findingId: moment.finding.id,
      finding: moment.finding,
      evidence: moment.evidence,
      timeMs: moment.timeMs,
    })), [coachingMoments, reviewFrames]);
  const controlled = selectedReviewFrame !== undefined;
  const activeFrame = controlled ? selectedReviewFrame ?? null : internalSelectedFrame;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentMs(Math.min(durationMs, Math.max(0, Number(player.currentTime ?? 0) * 1_000)));
      setPlaying(Boolean(player.playing));
    }, 150);
    return () => clearInterval(timer);
  }, [durationMs, player]);

  useEffect(() => {
    if (!activeFrame) return;
    player.currentTime = activeFrame.timeMs / 1_000;
    player.pause();
    setCurrentMs(activeFrame.timeMs);
    const hasConfidentFocus = Boolean(activeFrame.evidence.focusRegion && activeFrame.evidence.focusRegion.confidence >= 0.8);
    setFocusMode(hasConfidentFocus ? "auto" : "full");
    scaleRef.current = 1;
    setManualZoom(1);
  }, [activeFrame, player]);

  const pinch = useMemo(() => Gesture.Pinch().runOnJS(true).onBegin(() => {
    pinchStartRef.current = scaleRef.current;
    setFocusMode("manual");
  }).onUpdate((event) => {
    const next = clampPlaybackZoom(pinchStartRef.current * event.scale);
    scaleRef.current = next;
    setManualZoom(next);
  }), []);

  const seekTo = (nextMs: number, pause = false) => {
    player.currentTime = nextMs / 1_000;
    if (pause) player.pause();
    setCurrentMs(nextMs);
  };
  const seek = (positionX: number) => {
    if (!controlled) setInternalSelectedFrame(null);
    setFocusMode("full");
    seekTo(timelineSeekMs(positionX, timelineWidth, durationMs));
  };
  const selectReviewFrame = (frame: ReviewFrame) => {
    scaleRef.current = 1;
    setManualZoom(1);
    if (!controlled) setInternalSelectedFrame(frame);
    onSelectReviewFrame?.(frame);
    const hasConfidentFocus = Boolean(frame.evidence.focusRegion && frame.evidence.focusRegion.confidence >= 0.8);
    setFocusMode(hasConfidentFocus ? "auto" : "full");
    seekTo(frame.timeMs, true);
  };
  const showFullFrame = () => {
    scaleRef.current = 1;
    setManualZoom(1);
    setFocusMode("full");
  };
  const onVideoLayout = (event: LayoutChangeEvent) => setVideoLayout(event.nativeEvent.layout);
  const focus = focusPresentation(activeFrame?.evidence.focusRegion, focusMode, manualZoom);
  const videoStyle = focus.focus && focusMode !== "full"
    ? focusVideoStyle(videoLayout, focus.focus, focus.zoom)
    : { width: "100%" as const, height: "100%" as const, backgroundColor: colors.cameraBlack, transform: [{ scale: focusMode === "manual" ? focus.zoom : 1 }] };
  const overlayFocus = focus.focus && focus.showCircle
    ? focus.transformFocus ? zoomedFocusRegion(focus.focus, focus.zoom) : focus.focus
    : null;
  const progress = Math.min(100, Math.max(0, (currentMs / Math.max(1, durationMs)) * 100));

  return (
    <View style={{ overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View onLayout={onVideoLayout} style={{ overflow: "hidden", width: "100%", aspectRatio: 9 / 16, maxHeight: 480, backgroundColor: colors.cameraBlack }}>
        <GestureDetector gesture={pinch}>
          <View accessibilityLabel="Pinch recording to zoom" collapsable={false} style={{ flex: 1 }}>
            <VideoView accessibilityLabel="Full exercise recording" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls={false} player={player} style={videoStyle} />
          </View>
        </GestureDetector>
        {overlayFocus ? <EvidenceFocusOverlay focus={overlayFocus} layout={videoLayout} /> : null}
        <Pressable accessibilityLabel={playing ? "Pause recording" : "Play recording"} accessibilityRole="button" onPress={() => playing ? player.pause() : player.play()} style={{ position: "absolute", left: spacing.md, bottom: spacing.md, width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.72)" }}>
          <Text style={{ color: colors.text, fontSize: 18 }}>{playing ? "Ⅱ" : "▶"}</Text>
        </Pressable>
        {focusMode !== "full" ? <Pressable accessibilityLabel="Show full video frame" onPress={showFullFrame} style={{ position: "absolute", right: spacing.md, top: spacing.md, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.72)" }}><Text style={[typography.caption, { color: colors.gold }]}>Full Frame</Text></Pressable> : null}
        {focusMode === "full" && focus.focus ? <Pressable accessibilityLabel="Restore AI focus" onPress={() => setFocusMode("auto")} style={{ position: "absolute", right: spacing.md, top: spacing.md, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: "rgba(0,0,0,0.72)" }}><Text style={[typography.caption, { color: colors.gold }]}>Restore AI Focus</Text></Pressable> : null}
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text selectable style={[typography.caption, { width: 38, color: colors.textSecondary, fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(currentMs)}</Text>
          <View onLayout={(event) => setTimelineWidth(event.nativeEvent.layout.width)} style={{ flex: 1, height: 38, justifyContent: "center" }}>
            <Pressable accessibilityLabel="Recording timeline" accessibilityRole="adjustable" onPress={(event) => seek(event.nativeEvent.locationX)} style={{ position: "absolute", left: 0, right: 0, top: 4, bottom: 4, justifyContent: "center" }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                <View style={{ width: `${progress}%`, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
                <View style={{ position: "absolute", left: `${progress}%`, top: -6, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: colors.gold }} />
                {reps.map((rep) => <View key={`${rep.repNumber}-${rep.peakMs}`} style={{ position: "absolute", left: `${timelineMarkerPercent(rep.peakMs, durationMs)}%`, top: -3, width: 2, height: 10, backgroundColor: rep.assessment === "breakdown" ? colors.danger : colors.textSecondary }} />)}
              </View>
            </Pressable>
            {timelineFrames.map((frame, index) => (
              <Pressable
                accessibilityLabel={`Coaching point: ${frame.title} at ${formatPlaybackTime(frame.timeMs)}`}
                accessibilityRole="button"
                hitSlop={4}
                key={frame.id}
                onPress={() => selectReviewFrame(frame)}
                style={{ position: "absolute", left: `${timelineMarkerPercent(frame.timeMs, durationMs)}%`, top: index % 2 === 0 ? -3 : 17, width: 44, height: 44, marginLeft: -22, alignItems: "center", justifyContent: "center" }}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.background, backgroundColor: activeFrame?.id === frame.id ? colors.text : colors.gold }} />
              </Pressable>
            ))}
          </View>
          <Text selectable style={[typography.caption, { width: 38, color: colors.textSecondary, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(durationMs)}</Text>
        </View>
        {activeFrame ? (
          <Pressable accessibilityRole={onOpenFinding ? "button" : undefined} onPress={onOpenFinding ? () => onOpenFinding(activeFrame.finding) : undefined} style={{ gap: 3, padding: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.caption, { color: colors.gold }]}>{formatPlaybackTime(activeFrame.timeMs)}</Text><Text selectable style={[typography.label, { flex: 1, color: colors.text }]}>{activeFrame.title}</Text>{onOpenFinding ? <Text style={{ color: colors.gold, fontSize: 20 }}>›</Text> : null}</View>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{activeFrame.body}</Text>
          </Pressable>
        ) : null}
        {reps.length > 0 ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{reps.map((rep) => <Pressable accessibilityLabel={`Jump to rep ${rep.repNumber}: ${rep.note}`} accessibilityRole="button" key={`${rep.repNumber}-button`} onPress={() => { if (!controlled) setInternalSelectedFrame(null); setFocusMode("full"); seekTo(rep.peakMs, true); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: rep.assessment === "breakdown" ? colors.gold : colors.border }}><Text style={[typography.caption, { color: rep.assessment === "breakdown" ? colors.gold : colors.textSecondary }]}>Rep {rep.repNumber}</Text></Pressable>)}</View> : null}
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Pinch out to zoom · pinch in to return to full frame</Text>
      </View>
    </View>
  );
}
