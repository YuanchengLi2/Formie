import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Text, View, type LayoutChangeEvent } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ReferenceVideoControlsProps = {
  localVideoUri: string;
};

export function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function ReferenceVideoControls({ localVideoUri }: ReferenceVideoControlsProps) {
  const player = useVideoPlayer(localVideoUri, (created) => {
    created.loop = true;
    created.timeUpdateEventInterval = 0.25;
  });
  const timelineWidthRef = useRef(1);
  const [playing, setPlaying] = useState(player.playing);
  const [currentTime, setCurrentTime] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying));
    const timeSubscription = player.addListener("timeUpdate", ({ currentTime: nextTime }) => setCurrentTime(nextTime));
    const statusSubscription = player.addListener("statusChange", ({ status, error: playerError }) => {
      setDuration(Number.isFinite(player.duration) ? player.duration : 0);
      setError(status === "error" ? playerError?.message ?? "This recording could not be played." : null);
    });
    return () => {
      playingSubscription.remove();
      timeSubscription.remove();
      statusSubscription.remove();
    };
  }, [player]);

  const togglePlayback = useCallback(() => {
    if (playing) player.pause();
    else player.play();
  }, [player, playing]);

  const seek = useCallback((locationX: number) => {
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const ratio = Math.max(0, Math.min(1, locationX / Math.max(1, timelineWidthRef.current)));
    const nextTime = ratio * safeDuration;
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration, player]);

  const onTimelineMove = (locationX: number) => {
    seek(locationX);
  };

  const onTimelineLayout = (event: LayoutChangeEvent) => {
    timelineWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
  };
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const progress = safeDuration > 0 ? Math.max(0, Math.min(1, currentTime / safeDuration)) : 0;

  return (<>
    <View style={{ gap: 4 }}>
    <View testID="recording-video-frame" style={{ overflow: "hidden", aspectRatio: 1.255, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: "#3A3A3A", backgroundColor: colors.cameraBlack }}>
      <VideoView
        accessibilityLabel="Recorded set preview"
        contentFit="contain"
        nativeControls={false}
        player={player}
        style={{ width: "100%", height: "100%", backgroundColor: colors.cameraBlack }}
      />

      {!playing && !error ? (
        <Pressable
          accessibilityLabel="Play recording preview"
          accessibilityRole="button"
          onPress={togglePlayback}
          style={{ position: "absolute", top: "50%", left: "50%", width: 58, height: 58, marginTop: -29, marginLeft: -29, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: "rgba(8,8,8,0.82)" }}
        >
          <View style={{ marginLeft: 3 }}><CaptureReferenceIcon name="play" color={colors.text} size={28} /></View>
        </Pressable>
      ) : null}

      {error ? (
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" }}>
          <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.text, textAlign: "center" }]}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="View recording fullscreen"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setFullscreenOpen(true)}
        style={{ position: "absolute", top: 10, left: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "rgba(20,20,20,0.86)" }}
      >
        <CaptureReferenceIcon name="fullscreen" color={colors.text} size={19} />
      </Pressable>

      <View style={{ position: "absolute", left: 14, right: 14, bottom: 30, minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          accessibilityLabel={playing ? "Pause recording" : "Play recording"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={togglePlayback}
          style={{ width: 22, height: 30, alignItems: "center", justifyContent: "center" }}
        >
          <CaptureReferenceIcon name={playing ? "pause" : "play"} color={colors.text} size={17} />
        </Pressable>
        <Pressable
          accessibilityLabel="Recording timeline"
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: Math.round(safeDuration), now: Math.round(currentTime), text: `${formatPlaybackTime(currentTime)} of ${formatPlaybackTime(safeDuration)}` }}
          onStartShouldSetResponder={() => true}
          onLayout={onTimelineLayout}
          onPressIn={(event) => {
            seek(event.nativeEvent.locationX);
          }}
          onPressMove={(event) => onTimelineMove(event.nativeEvent.locationX)}
          onResponderMove={(event) => onTimelineMove(event.nativeEvent.locationX)}
          onPress={(event) => seek(event.nativeEvent.locationX)}
          style={{ flex: 1, height: 30, justifyContent: "center" }}
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.24)" }}>
            <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
            <View style={{ position: "absolute", top: -4, left: `${progress * 100}%`, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: colors.gold }} />
          </View>
        </Pressable>
        <View accessibilityLabel={`Playback time ${formatPlaybackTime(currentTime)} of ${formatPlaybackTime(safeDuration)}`} style={{ minWidth: 72, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
          <Text selectable style={[typography.caption, { color: colors.text, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] }]}>
            {formatPlaybackTime(currentTime)}
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] }]}>
            {` / ${formatPlaybackTime(safeDuration)}`}
          </Text>
        </View>
      </View>
    </View>
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}><Text style={{ color: colors.gold, fontSize: 12 }}>☝</Text><Text selectable style={[typography.caption, { color: colors.textMuted, fontSize: 11, lineHeight: 15 }]}>Drag or swipe to scrub</Text></View>
    </View>
    <Modal animationType="fade" onRequestClose={() => setFullscreenOpen(false)} presentationStyle="fullScreen" visible={fullscreenOpen}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cameraBlack }}>
        <VideoView
          accessibilityLabel="Fullscreen recording preview"
          contentFit="contain"
          nativeControls
          player={player}
          style={{ flex: 1, backgroundColor: colors.cameraBlack }}
        />
        <SafeAreaView edges={["top"]} pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
          <Pressable
            accessibilityLabel="Close fullscreen recording"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setFullscreenOpen(false)}
            style={{ minWidth: 96, minHeight: 52, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, marginRight: 16, paddingHorizontal: 16, borderRadius: 26, borderWidth: 2, borderColor: colors.cameraBlack, backgroundColor: colors.gold }}
          >
            <Text style={{ color: colors.cameraBlack, fontSize: 25, lineHeight: 27, fontWeight: "800" }}>{"\u00D7"}</Text>
            <Text style={[typography.label, { color: colors.cameraBlack }]}>Close</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  </>);
}
