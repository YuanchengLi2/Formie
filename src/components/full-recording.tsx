import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { ReviewFrame, ReviewPurpose } from "@/features/analysis/review-frames";
import type { CoachingFinding, EvidenceMoment } from "@/features/analysis/result-schema";
import { formatPointAdvice } from "@/features/analysis/evidence-timestamp";
import {
  clipDurationMs,
  clipToSourceMs,
  resolvePlaybackWindow,
  sourceToClipMs,
  type PlaybackWindow,
} from "@/features/analysis/playback-window";
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
    .flatMap((finding) => finding.evidence.map((evidence, index) => ({
      id: `${finding.id}-${index}-${evidence.peakMs ?? evidence.startMs}`,
      finding,
      evidence,
      timeMs: evidence.peakMs ?? evidence.startMs,
    })))
    .sort((left, right) => left.timeMs - right.timeMs);
}

type FullRecordingProps = {
  videoUrl: string;
  durationMs: number;
  playbackWindow?: PlaybackWindow | null;
  coachingFindings?: CoachingFinding[];
  reviewFrames?: ReviewFrame[];
  selectedReviewFrame?: ReviewFrame | null;
  onSelectReviewFrame?: (frame: ReviewFrame) => void;
  onOpenFinding?: (finding: CoachingFinding) => void;
  showActiveFrameCard?: boolean;
  seekToMs?: number | null;
  seekRequestId?: number;
};

export function FullRecording({
  videoUrl,
  durationMs,
  playbackWindow = null,
  coachingFindings = [],
  reviewFrames,
  selectedReviewFrame,
  onSelectReviewFrame,
  onOpenFinding,
  showActiveFrameCard = true,
  seekToMs = null,
  seekRequestId = 0,
}: FullRecordingProps) {
  const player = useVideoPlayer(videoUrl, (createdPlayer) => {
    createdPlayer.timeUpdateEventInterval = 0.25;
  });
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const timelineRef = useRef<View>(null);
  const timelineWidthRef = useRef(1);
  const timelinePageXRef = useRef(0);
  const draggingRef = useRef(false);
  const completedRef = useRef(false);
  const initializedWindowKeyRef = useRef<string | null>(null);
  const lastAppliedFrameKeyRef = useRef<string | null>(null);
  const resolvedWindow = useMemo(
    () => resolvePlaybackWindow(durationMs, playbackWindow),
    [durationMs, playbackWindow],
  );
  const playbackDurationMs = clipDurationMs(resolvedWindow);
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
    const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (draggingRef.current) return;
      const sourceMs = currentTime * 1_000;
      if (sourceMs >= resolvedWindow.sourceEndMs) {
        if (!completedRef.current) {
          player.currentTime = resolvedWindow.sourceEndMs / 1_000;
          player.pause();
        }
        completedRef.current = true;
        setCurrentMs(playbackDurationMs);
        return;
      }
      completedRef.current = false;
      setCurrentMs(sourceToClipMs(sourceMs, resolvedWindow));
    });
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying));
    const statusSubscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") {
        setPlayerStatus("error");
        setPlayerError(error?.message ?? "This recording could not be played.");
      } else if (status === "readyToPlay") {
        setPlayerStatus("ready");
        setPlayerError(null);
        const windowKey = `${resolvedWindow.sourceStartMs}:${resolvedWindow.sourceEndMs}`;
        if (initializedWindowKeyRef.current !== windowKey) {
          initializedWindowKeyRef.current = windowKey;
          completedRef.current = false;
          player.currentTime = resolvedWindow.sourceStartMs / 1_000;
          setCurrentMs(0);
        }
      } else {
        setPlayerStatus("loading");
      }
    });
    return () => {
      timeSubscription.remove();
      playingSubscription.remove();
      statusSubscription.remove();
    };
  }, [playbackDurationMs, player, resolvedWindow]);

  useEffect(() => {
    if (!activeFrame || playerStatus !== "ready") return;
    const frameKey = `${activeFrame.id}:${activeFrame.timeMs}`;
    if (lastAppliedFrameKeyRef.current === frameKey) return;
    lastAppliedFrameKeyRef.current = frameKey;
    const sourceMs = clipToSourceMs(sourceToClipMs(activeFrame.timeMs, resolvedWindow), resolvedWindow);
    player.currentTime = sourceMs / 1_000;
    player.pause();
    completedRef.current = sourceMs >= resolvedWindow.sourceEndMs;
    setCurrentMs(sourceToClipMs(sourceMs, resolvedWindow));
  }, [activeFrame, player, playerStatus, resolvedWindow]);

  useEffect(() => {
    if (seekToMs === null || !Number.isFinite(seekToMs)) return;
    const sourceMs = clipToSourceMs(sourceToClipMs(seekToMs, resolvedWindow), resolvedWindow);
    player.currentTime = sourceMs / 1_000;
    player.pause();
    completedRef.current = sourceMs >= resolvedWindow.sourceEndMs;
    setCurrentMs(sourceToClipMs(sourceMs, resolvedWindow));
  }, [player, resolvedWindow, seekRequestId, seekToMs]);

  const seekToClip = useCallback((nextMs: number, pause = false) => {
    const clamped = Math.min(playbackDurationMs, Math.max(0, nextMs));
    player.currentTime = clipToSourceMs(clamped, resolvedWindow) / 1_000;
    if (pause) player.pause();
    completedRef.current = clamped >= playbackDurationMs;
    setCurrentMs(clamped);
  }, [playbackDurationMs, player, resolvedWindow]);
  const seekToSource = useCallback((sourceMs: number, pause = false) => {
    seekToClip(sourceToClipMs(sourceMs, resolvedWindow), pause);
  }, [resolvedWindow, seekToClip]);
  const play = useCallback(() => {
    const sourceMs = player.currentTime * 1_000;
    if (completedRef.current || sourceMs < resolvedWindow.sourceStartMs || sourceMs >= resolvedWindow.sourceEndMs) {
      player.currentTime = resolvedWindow.sourceStartMs / 1_000;
      completedRef.current = false;
      setCurrentMs(0);
    }
    player.play();
  }, [player, resolvedWindow]);
  const previewFromPageX = useCallback((pageX: number) => {
    setCurrentMs(timelineSeekFromPageX(pageX, timelinePageXRef.current, timelineWidthRef.current, playbackDurationMs));
  }, [playbackDurationMs]);
  const commitFromPageX = useCallback((pageX: number) => {
    seekToClip(timelineSeekFromPageX(pageX, timelinePageXRef.current, timelineWidthRef.current, playbackDurationMs), true);
  }, [playbackDurationMs, seekToClip]);
  const timelineGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-8, 8])
    .onStart((event) => {
      draggingRef.current = true;
      player.pause();
      setPlaying(false);
      previewFromPageX(event.absoluteX);
    })
    .onUpdate((event) => previewFromPageX(event.absoluteX))
    .onEnd((event) => {
      commitFromPageX(event.absoluteX);
      draggingRef.current = false;
    })
    .onFinalize(() => { draggingRef.current = false; })
    .runOnJS(true), [commitFromPageX, player, previewFromPageX]);
  const onTimelineLayout = (event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    timelineWidthRef.current = width;
    timelineRef.current?.measureInWindow((pageX, _pageY, measuredWidth) => {
      if (Number.isFinite(pageX)) timelinePageXRef.current = pageX;
      if (Number.isFinite(measuredWidth) && measuredWidth > 0) timelineWidthRef.current = measuredWidth;
    });
  };
  const progress = Math.min(100, Math.max(0, (currentMs / Math.max(1, playbackDurationMs)) * 100));
  const hasFrameContext = Boolean(activeFrame && timelineFrames.some((frame) => frame.id === activeFrame.id));

  return (
    <View style={{ overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View testID="recording-video-frame" style={{ overflow: "hidden", width: "100%", maxHeight: 460, aspectRatio: 4 / 5, backgroundColor: colors.cameraBlack }}>
        <VideoView accessibilityLabel="Exercise recording" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls={false} player={player} style={{ width: "100%", height: "100%", backgroundColor: colors.cameraBlack }} />
        {playerStatus !== "error" ? (
          <Pressable
            accessibilityLabel={playing ? "Pause recording in video" : "Play recording in video"}
            accessibilityRole="button"
            onPress={() => playing ? player.pause() : play()}
            style={{ position: "absolute", top: "50%", left: "50%", width: 60, height: 60, marginTop: -30, marginLeft: -30, alignItems: "center", justifyContent: "center", borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.42)", backgroundColor: "rgba(8,8,8,0.78)" }}
          >
            <Text style={{ marginLeft: playing ? 0 : 3, color: colors.text, fontSize: playing ? 19 : 23 }}>{playing ? "Ⅱ" : "▶"}</Text>
          </Pressable>
        ) : null}
        {playerStatus === "loading" ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: spacing.md, alignItems: "center" }}>
            <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Loading video…</Text>
          </View>
        ) : null}
        {playerStatus === "error" ? (
          <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: "rgba(0,0,0,0.78)" }}>
            <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.text, textAlign: "center" }]}>{playerError}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text selectable style={[typography.label, { width: 45, color: colors.text, fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(currentMs)}</Text>
          <View style={{ flex: 1, height: 44, justifyContent: "center" }}>
            <GestureDetector gesture={timelineGesture}>
              <Pressable
                ref={timelineRef}
                accessibilityActions={[{ name: "decrement", label: "Back five seconds" }, { name: "increment", label: "Forward five seconds" }]}
                accessibilityLabel="Recording timeline"
                accessibilityRole="adjustable"
                accessibilityValue={{ min: 0, max: Math.round(playbackDurationMs / 1_000), now: Math.round(currentMs / 1_000), text: `${formatPlaybackTime(currentMs)} of ${formatPlaybackTime(playbackDurationMs)}` }}
                onAccessibilityAction={(event) => seekToClip(stepPlaybackMs(currentMs, playbackDurationMs, event.nativeEvent.actionName === "decrement" ? -1 : 1), true)}
                onLayout={onTimelineLayout}
                onPress={(event) => seekToClip(timelineSeekMs(event.nativeEvent.locationX, timelineWidthRef.current, playbackDurationMs), true)}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "center" }}
              >
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                  <View style={{ width: `${progress}%`, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
                  <View style={{ position: "absolute", left: `${progress}%`, top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.gold }} />
                </View>
              </Pressable>
            </GestureDetector>
            {timelineFrames.map((frame) => {
              const selected = activeFrame?.id === frame.id;
              return (
                <Pressable
                  key={frame.id}
                  accessibilityLabel={`Review ${frame.title} at ${formatPlaybackTime(sourceToClipMs(frame.timeMs, resolvedWindow))}`}
                  accessibilityRole="button"
                  onPress={() => {
                    lastAppliedFrameKeyRef.current = `${frame.id}:${frame.timeMs}`;
                    seekToSource(frame.timeMs, true);
                    onSelectReviewFrame?.(frame);
                  }}
                  testID={`timeline-evidence-marker-${frame.id}`}
                  style={{ position: "absolute", left: `${timelineMarkerPercent(sourceToClipMs(frame.timeMs, resolvedWindow), playbackDurationMs)}%`, top: 0, width: 36, height: 44, marginLeft: -18, alignItems: "center", justifyContent: "center" }}
                >
                  <TimelineEvidenceMarker selected={selected} />
                </Pressable>
              );
            })}
          </View>
          <Text selectable style={[typography.label, { width: 45, color: colors.textSecondary, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{formatPlaybackTime(playbackDurationMs)}</Text>
        </View>

        {showActiveFrameCard && hasFrameContext && activeFrame ? (
          <Pressable accessibilityRole={onOpenFinding ? "button" : undefined} onPress={onOpenFinding ? () => onOpenFinding(activeFrame.finding) : undefined} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text selectable style={[typography.label, { color: colors.gold }]}>{formatPlaybackTime(sourceToClipMs(activeFrame.timeMs, resolvedWindow))}</Text>
              <Text selectable style={[typography.heading, { flex: 1, color: colors.text }]}>{activeFrame.title}</Text>
              {onOpenFinding ? <Text style={{ color: colors.gold, fontSize: 22 }}>›</Text> : null}
            </View>
            {activeFrame.body ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{activeFrame.body}</Text> : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
