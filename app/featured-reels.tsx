import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { VideoView, useVideoPlayer } from "expo-video";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://bombadir.pythonanywhere.com";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

/** Dark gap between reels so swipes feel discrete (Instagram-like separation) */
const REEL_GAP = 10;

type ReelItem = {
  id: string;
  video: string;
  title?: string;
  monthly_rent?: number | string;
};

function ReelSlide({
  item,
  active,
  bottomInset,
  pageHeight,
  isSaved,
  saving,
  onSave,
}: {
  item: ReelItem;
  active: boolean;
  bottomInset: number;
  pageHeight: number;
  isSaved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const player = useVideoPlayer(item.video || "", (p) => {
    p.loop = true;
    p.muted = false;
  });

  React.useEffect(() => {
    try {
      if (active && item.video) player.play();
      else player.pause();
    } catch {}
  }, [active, item.video, player]);

  return (
    <View style={[styles.slidePage, { height: pageHeight + REEL_GAP }]}>
      <View style={[styles.slide, { height: pageHeight }]}>
        <View style={styles.videoFrame} pointerEvents="none">
          <VideoView
            player={player}
            style={styles.video}
            nativeControls={false}
            contentFit="cover"
          />
        </View>

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
                color={isSaved ? "#2563EB" : "#fff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.bottomOverlay, { bottom: Math.max(28, bottomInset + 40) }]}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
              router.push({
                pathname: "/house-details",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.detailsBtnText}>View house Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reelGap} />
    </View>
  );
}

export default function FeaturedReelsScreen() {
  const { reels, index } = useLocalSearchParams<{
    reels?: string;
    index?: string;
  }>();

  const insets = useSafeAreaInsets();
  const [viewportH, setViewportH] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const parsed = useMemo<ReelItem[]>(() => {
    if (!reels) return [];
    try {
      const data = JSON.parse(reels);
      if (!Array.isArray(data)) return [];
      return data
        .map((x: any) => ({
          id: String(x.id ?? x.property_id ?? ""),
          video: String(x.video ?? ""),
          title: x.title ? String(x.title) : undefined,
          monthly_rent: x.monthly_rent,
        }))
        .filter((x) => x.id && x.video);
    } catch {
      return [];
    }
  }, [reels]);

  const initialIndex = Math.max(0, Math.min(parsed.length - 1, Number(index || 0) || 0));
  const listRef = useRef<FlatList<ReelItem>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const pageHeight = viewportH > 0 ? viewportH : SCREEN_HEIGHT;
  const step = pageHeight + REEL_GAP;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem("user");
        let uid: string | null = null;
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          const user = parsed?.user ? parsed.user : parsed;
          uid = user?.user_id != null ? String(user.user_id) : user?.id != null ? String(user.id) : null;
        }
        if (cancelled) return;
        setUserId(uid);

        if (uid) {
          const formData = new FormData();
          formData.append("user_id", uid);
          const response = await axios.post(`${API_URL}/api/my_saved_houses`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const savedList = Array.isArray(response.data)
            ? response.data
            : response.data?.houses || [];
          if (!cancelled) {
            setSavedIds(savedList.map((item: any) => String(item.property_id)));
          }
        } else {
          setSavedIds([]);
        }
      } catch {
        if (!cancelled) setSavedIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(
    async (propertyId: string) => {
      try {
        if (!userId) {
          Alert.alert("Login required", "Please login first to save houses.");
          return;
        }
        setSavingId(propertyId);
        const isSaved = savedIds.includes(propertyId);
        const formData = new FormData();
        formData.append("user_id", userId);
        formData.append("property_id", propertyId);

        if (isSaved) {
          const response = await axios.post(`${API_URL}/api/remove_saved_house`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setSavedIds((prev) => prev.filter((id) => id !== propertyId));
          Alert.alert("Removed", response.data?.message || "House removed from saved.");
        } else {
          const response = await axios.post(`${API_URL}/api/save_house`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setSavedIds((prev) => (prev.includes(propertyId) ? prev : [...prev, propertyId]));
          Alert.alert("Saved", response.data?.message || "House saved.");
        }
      } catch (err: any) {
        console.log("Reel save error:", err?.response?.data || err);
        Alert.alert("Error", err?.response?.data?.message || "Failed to update saved houses.");
      } finally {
        setSavingId(null);
      }
    },
    [userId, savedIds]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const first = viewableItems.find((v) => typeof v.index === "number");
      if (first?.index !== null && first?.index !== undefined) {
        setActiveIndex(first.index);
      }
    },
    []
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60 }),
    []
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: step,
      offset: step * i,
      index: i,
    }),
    [step]
  );

  const renderItem: ListRenderItem<ReelItem> = useCallback(
    ({ item, index: itemIndex }) => (
      <ReelSlide
        item={item}
        active={itemIndex === activeIndex}
        bottomInset={insets.bottom}
        pageHeight={pageHeight}
        isSaved={savedIds.includes(item.id)}
        saving={savingId === item.id}
        onSave={() => handleSave(item.id)}
      />
    ),
    [activeIndex, insets.bottom, pageHeight, savedIds, savingId, handleSave]
  );

  if (parsed.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No reels available.</Text>
          <TouchableOpacity style={styles.emptyBack} onPress={() => router.back()}>
            <Text style={styles.emptyBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View
        style={styles.listWrap}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - viewportH) > 1) setViewportH(h);
        }}
      >
        {viewportH > 0 ? (
          <FlatList
            ref={listRef}
            data={parsed}
            keyExtractor={(item) => `reel-${item.id}`}
            renderItem={renderItem}
            snapToInterval={step}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        ) : (
          <View style={styles.listPlaceholder} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  listWrap: { flex: 1 },
  listPlaceholder: { flex: 1 },
  slidePage: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  slide: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  reelGap: {
    height: REEL_GAP,
    backgroundColor: "#0a0a0a",
  },
  videoFrame: {
    flex: 1,
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%", backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    zIndex: 10,
  },
  detailsBtn: {
    marginTop: 14,
    alignSelf: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  detailsBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  emptyBack: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyBackText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
