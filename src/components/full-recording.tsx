import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { ReviewFrame, ReviewPurpose } from "@/features/analysis/review-frames";
import type { CoachingFinding, EvidenceMoment } from "@/features/analysis/result-schema";
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

export function timelineSeekFromPageX(pageX: number, trackPageX: number, width: number, durationMs: number): number {
  return timelineSeekMs(pageX - trackPageX, width, durationMs);
}

export function isTimelineDrag(dx: number, dy: number, threshold = 6): boolean {
  return Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy);
}

export function stepPlaybackMs(currentMs: number, durationMs: number, direction: -1 | 1): number {
  return Math.min(durationMs, Math.max(0, currentMs + direction * 5_000));
}

export function formatPlaybackTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function nextFrameIndex(index: number, length: number, direction: -1 | 1): number {
  if (length <= 0) return 0;
  return (index + direction + length) % length;
}

export function reviewPurposeLabel(purpose: ReviewPurpose): string {
  return purpose === "observed" ? "What happened" : purpose === "why" ? "Why it matters" : "What to do next";
}

function TimelineEvidenceMarker({ selected }: { selected: boolean }) {
  const scale = useSharedValue(selected ? 1.12 : 1);
  useEffect(() => {
    scale.value = withTiming(selected ? 1.18 : 1, { duration: 160 });
  }, [scale, selected]);
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: "45deg" }, { scale: scale.value }] }));

  return (
    <Animated.View
      layout={LinearTransition.duration(160)}
      style={[
        {
          width: selected ? 14 : 12,
          height: selected ? 24 : 20,
          borderRadius: 3,
          borderWidth: 2,
          borderColor: colors.surface,
          backgroundColor: selected ? colors.gold : colors.textSecondary,
        },
        markerStyle,
      ]}
    />
  );
}

export function buildPlaybackCoachingMoments(findings: CoachingFinding[]): PlaybackCoachingMoment[] {
  return findings
    .flatMap((finding) => finding.evidence.map((evidence, index) => ({ id: `${finding.id}-${index}-${evidence.peakMs ?? evidence.startMs}`, finding, evidence, timeMs: evidence.peakMs ?? evidence.startMs })))
    .sort((left, right) => left.timeMs - right.timeMs);
}

type FullRecordingProps = {
  videoUrl: string;
  durationMs: number;
  coachingFindings?: CoachingFinding[];
  reviewFrames?: ReviewFrame[];
  selectedReviewFrame?: ReviewFrame | null;
  onSelectReviewFrame?: (frame: ReviewFrame) => void;
  onOpenFinding?: (finding: CoachingFinding) => void;
  showActiveFrameCard?: boolean;
};

export function FullRecording({ videoUrl, durationMs, coachingFindings = [], reviewFrames, selectedReviewFrame, onSelectReviewFrame, onOpenFinding, showActiveFrameCard = true }: FullRecordingProps) {
  const player = useVideoPlayer(videoUrl);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timelineRef = useRef<View>(null);
  const timelineWidthRef = useRef(1);
  const timelinePageXRef = useRef(0);
  const draggingRef = useRef(false);
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
  const activeFrame = selectedReviewFrame ?? null;

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
    const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (draggingRef.current) return;
      setCurrentMs(Math.min(durationMs, Math.max(0, currentTime * 1_000)));
    });
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying));
    return () => {
      timeSubscription.remove();
      playingSubscription.remove();
      player.timeUpdateEventInterval = 0;
    };
  }, [durationMs, player]);

  useEffect(() => {
    if (!activeFrame) return;
    player.currentTime = activeFrame.timeMs / 1_000;
    player.pause();
    setCurrentMs(activeFrame.timeMs);
  }, [activeFrame, player]);

  const seekTo = useCallback((nextMs: number, pause = false) => {
    const clamped = Math.min(durationMs, Math.max(0, nextMs));
    player.currentTime = clamped / 1_000;
    if (pause) player.pause();
    setCurrentMs(clamped);
  }, [durationMs, player]);
  const previewFromPageX = useCallback((pageX: number) => {
    setCurrentMs(timelineSeekFromPageX(pageX, timelinePageXRef.current, timelineWidthRef.current, durationMs));
  }, [durationMs]);
  const commitFromPageX = useCallback((pageX: number) => {
    seekTo(timelineSeekFromPageX(pageX, timelinePageXRef.current, timelineWidthRef.current, durationMs), true);
  }, [durationMs, seekTo]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gestureState) => isTimelineDrag(gestureState.dx, gestureState.dy),
    onPanResponderGrant: (event) => {
      draggingRef.current = true;
      player.pause();
      setPlaying(false);
      previewFromPageX(event.nativeEvent.pageX);
    },
    onPanResponderMove: (event) => previewFromPageX(event.nativeEvent.pageX),
    onPanResponderRelease: (event) => {
      commitFromPageX(event.nativeEvent.pageX);
      draggingRef.current = false;
    },
    onPanResponderTerminate: () => { draggingRef.current = false; },
    onPanResponderTerminationRequest: () => true,
  }), [commitFromPageX, player, previewFromPageX]);
  const onTimelineLayout = (event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    timelineWidthRef.current = width;
    timelineRef.current?.measureInWindow((pageX, _pageY, measuredWidth) => {
      timelinePageXRef.current = pageX;
      timelineWidthRef.current = Math.max(1, measuredWidth);
    });
  };
  const progress = Math.min(100, Math.max(0, (currentMs / Math.max(1, durationMs)) * 100));
  const hasFrameContext = Boolean(activeFrame && timelineFrames.some((frame) => frame.id === activeFrame.id));

  return (
    <View style={{ overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View testID="recording-video-frame" style={{ overflow: "hidden", width: "100%", maxHeight: 460, aspectRatio: 4 / 5, backgroundColor: colors.cameraBlack }}>
        <VideoView accessibilityLabel="Full exercise recording" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls={false} player={player} style={{ width: "100%", height: "100%", backgroundColor: colors.cameraBlack }} />
        <Pressable
          accessibilityLabel={playing ? "Pause recording in video" : "Play recording in video"}
          accessibilityRole="button"
          onPress={() => playing ? player.pause() : player.play()}
          style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
        >
          {!playing ? <View style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, borderWidth: 1, borderColor: "rgba(255,255,255,0.36)", backgroundColor: "rgba(8,8,8,0.72)" }}><Text style={{ marginLeft: 3, color: colors.gold, fontSize: 24 }}>▶</Text></View> : null}
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text selectable style={[typography.label, { width: 45, color: colors.text, fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(currentMs)}</Text>
          <View style={{ flex: 1, height: 44, justifyContent: "center" }}>
            <Pressable
              {...panResponder.panHandlers}
              ref={timelineRef}
              accessibilityActions={[{ name: "decrement", label: "Back five seconds" }, { name: "increment", label: "Forward five seconds" }]}
              accessibilityLabel="Recording timeline"
              accessibilityRole="adjustable"
              accessibilityValue={{ min: 0, max: Math.round(durationMs / 1_000), now: Math.round(currentMs / 1_000), text: `${formatPlaybackTime(currentMs)} of ${formatPlaybackTime(durationMs)}` }}
              onAccessibilityAction={(event) => seekTo(stepPlaybackMs(currentMs, durationMs, event.nativeEvent.actionName === "decrement" ? -1 : 1), true)}
              onLayout={onTimelineLayout}
              onPress={(event) => seekTo(timelineSeekMs(event.nativeEvent.locationX, timelineWidthRef.current, durationMs), true)}
              style={{ position: "absolute", inset: 0, justifyContent: "center" }}
            >
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                <View style={{ width: `${progress}%`, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
                <View style={{ position: "absolute", left: `${progress}%`, top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.gold }} />
              </View>
            </Pressable>
            {timelineFrames.map((frame) => {
              const selected = activeFrame?.id === frame.id;
              return (
                <Pressable
                  key={frame.id}
                  accessibilityLabel={`Review ${frame.title} at ${formatPlaybackTime(frame.timeMs)}`}
                  accessibilityRole="button"
                  onPress={() => {
                    seekTo(frame.timeMs, true);
                    onSelectReviewFrame?.(frame);
                  }}
                  testID={`timeline-evidence-marker-${frame.id}`}
                  style={{ position: "absolute", left: `${timelineMarkerPercent(frame.timeMs, durationMs)}%`, top: 0, width: 36, height: 44, marginLeft: -18, alignItems: "center", justifyContent: "center" }}
                >
                  <TimelineEvidenceMarker selected={selected} />
                </Pressable>
              );
            })}
          </View>
          <Text selectable style={[typography.label, { width: 45, color: colors.textSecondary, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(durationMs)}</Text>
        </View>

        {showActiveFrameCard && hasFrameContext && activeFrame ? (
          <Pressable accessibilityRole={onOpenFinding ? "button" : undefined} onPress={onOpenFinding ? () => onOpenFinding(activeFrame.finding) : undefined} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.label, { color: colors.gold }]}>{formatPlaybackTime(activeFrame.timeMs)}</Text><Text selectable style={[typography.heading, { flex: 1, color: colors.text }]}>{activeFrame.title}</Text>{onOpenFinding ? <Text style={{ color: colors.gold, fontSize: 22 }}>›</Text> : null}</View>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{activeFrame.body}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
