import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: "contain" | "cover" | "fill";
  nativeControls?: boolean;
  loop?: boolean;
  shouldPlay?: boolean;
};

export default function VideoPreview({
  uri,
  style,
  contentFit = "contain",
  nativeControls = true,
  loop = false,
  shouldPlay = true,
}: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
  });

  useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch {
      // Ignore play/pause failures (e.g. invalid uri)
    }
  }, [player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={style as any}
      nativeControls={nativeControls}
      contentFit={contentFit}
    />
  );
}

