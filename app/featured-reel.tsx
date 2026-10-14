import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import Ionicons from "@expo/vector-icons/Ionicons";

const COLORS = {
  black: "#0F0F10",
  white: "#FFFFFF",
  accent: "#2563EB",
};

export default function FeaturedReelScreen() {
  const { id, video, title } = useLocalSearchParams<{
    id: string;
    video: string;
    title?: string;
  }>();

  const player = useVideoPlayer(video || "", (playerInstance) => {
    playerInstance.loop = true;
    if (video) {
      playerInstance.play();
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="cover"
        />

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.overlayBottom}>
          <Text style={styles.title} numberOfLines={2}>
            {title || "Featured Property"}
          </Text>

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
              router.push({
                pathname: "/house-details",
                params: { id: String(id) },
              })
            }
          >
            <Text style={styles.detailsBtnText}>House Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  overlayBottom: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
  },
  title: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  detailsBtn: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  detailsBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
});