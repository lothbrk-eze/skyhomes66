import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const API_URL = "https://bombadir.pythonanywhere.com";
const IMAGE_BASE_URL = "https://bombadir.pythonanywhere.com/static/images/";

const COLORS = {
  bg: "#0B0B0D",
  surface: "#1A1A1F",
  white: "#FFFFFF",
  muted: "#A1A1AA",
  border: "#2F2F37",
  accent: "#2563EB",
};

export default function SavedScreen() {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [savedHouses, setSavedHouses] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState("");
  const [savedError, setSavedError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const getFirstImage = (images: any) => {
    if (!images) return "";

    if (Array.isArray(images) && images.length > 0) {
      const first = String(images[0]);
      return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
    }

    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = String(parsed[0]);
        return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
      }
    } catch {}

    if (typeof images === "string") {
      const first = images.split(",")[0]?.trim();
      if (first) {
        return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
      }
    }

    return "";
  };

  const normalizeStoredUser = useCallback(async () => {
    const storedUser = await AsyncStorage.getItem("user");
    const storedUsername = await AsyncStorage.getItem("username");
    const storedRole = await AsyncStorage.getItem("role");
    const storedEmail = await AsyncStorage.getItem("email");
    const storedPhone = await AsyncStorage.getItem("phone");
    const storedUserId = await AsyncStorage.getItem("user_id");

    let parsed: any = null;
    if (storedUser) parsed = JSON.parse(storedUser);

    const rawUser = parsed?.user ? parsed.user : parsed;

    const normalizedUser = {
      ...(rawUser || {}),
      user_id:
        rawUser?.user_id ||
        rawUser?.id ||
        parsed?.user_id ||
        parsed?.id ||
        storedUserId ||
        null,
      username:
        rawUser?.username ||
        rawUser?.name ||
        parsed?.username ||
        storedUsername ||
        "",
      name:
        rawUser?.name ||
        rawUser?.username ||
        parsed?.name ||
        storedUsername ||
        "",
      role: rawUser?.role || parsed?.role || storedRole || "",
      email: rawUser?.email || parsed?.email || storedEmail || "",
      phone: rawUser?.phone || parsed?.phone || storedPhone || "",
    };

    const hasAnySession =
      !!storedUser ||
      !!storedUsername ||
      !!storedEmail ||
      !!storedPhone ||
      !!storedUserId;

    return hasAnySession ? normalizedUser : null;
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      const normalizedUser = await normalizeStoredUser();
      setLoggedUser(normalizedUser);
      return normalizedUser;
    } catch (error) {
      console.log("Load user error:", error);
      setLoggedUser(null);
      return null;
    } finally {
      setLoadingUser(false);
    }
  }, [normalizeStoredUser]);

  const fetchSavedHouses = useCallback(async (user: any) => {
    try {
      setLoadingSaved("Loading saved houses...");
      setSavedError("");

      const formData = new FormData();
      formData.append("user_id", String(user.user_id));

      const response = await axios.post(
        `${API_URL}/api/my_saved_houses`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const houses = Array.isArray(response.data)
        ? response.data
        : response.data?.houses || response.data?.saved_houses || [];

      setSavedHouses(houses);
    } catch (err: any) {
      console.log("Saved houses error:", err?.response?.data || err);
      setSavedError(
        err?.response?.data?.message || "Failed to load saved houses"
      );
      setSavedHouses([]);
    } finally {
      setLoadingSaved("");
    }
  }, []);

  const refreshPage = useCallback(async () => {
    try {
      setRefreshing(true);
      const user = await loadUser();

      if (!user?.user_id) {
        setSavedHouses([]);
        setSavedError("Please sign in again to view saved houses.");
        return;
      }

      await fetchSavedHouses(user);
    } finally {
      setRefreshing(false);
    }
  }, [loadUser, fetchSavedHouses]);

  useEffect(() => {
    const init = async () => {
      const user = await loadUser();

      if (!user?.user_id) {
        setSavedHouses([]);
        setSavedError("Please sign in again to view saved houses.");
        return;
      }

      await fetchSavedHouses(user);
    };

    init();
  }, [loadUser, fetchSavedHouses]);

  if (loadingUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading saved houses...</Text>
      </View>
    );
  }

  if (!loggedUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Saved Houses</Text>
        <Text style={styles.emptyText}>Please log in to view your saved houses.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/login")}>
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPage} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Saved Houses</Text>
      <Text style={styles.subtitle}>Quick access to homes you bookmarked</Text>

      {!!loadingSaved && <Text style={styles.loadingText}>{loadingSaved}</Text>}

      {!!savedError && (
        <>
          <Text style={styles.errorText}>{savedError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshPage}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </>
      )}

      {!loadingSaved && !savedError && savedHouses.length === 0 && (
        <Text style={styles.emptyText}>You have no saved houses yet.</Text>
      )}

      {savedHouses.map((house) => {
        const imageUrl =
          house.first_image || getFirstImage(house.images || house.image_url);

        return (
          <TouchableOpacity
            key={house.saved_id || house.property_id}
            activeOpacity={0.9}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/house-details",
                params: { id: String(house.property_id) },
              })
            }
          >
            {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.itemImage} />}

            <Text style={styles.itemTitle}>
              {house.property_type || house.title || "House"}
            </Text>
            <Text style={styles.itemText}>
              Location: {house.location || house.address || "N/A"}
            </Text>
            <Text style={styles.itemText}>
              {String(house.listing_type || "").toLowerCase() === "sale"
                ? `Sale Price: KES ${house.sale_price || "N/A"}`
                : `Rent: KES ${house.monthly_rent || "N/A"}`}
            </Text>
            <Text style={styles.itemText}>
              Status: {house.availability_status || "N/A"}
            </Text>

            {!!house.property_id && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  router.push({
                    pathname: "/house-details",
                    params: { id: String(house.property_id) },
                  })
                }
              >
                <Text style={styles.primaryButtonText}>View House Details</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { color: COLORS.white, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.muted, marginTop: 6, marginBottom: 16, fontSize: 14 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemImage: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    marginBottom: 12,
    resizeMode: "cover",
  },
  itemTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  itemText: {
    color: COLORS.muted,
    marginBottom: 5,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "800" },
  retryButton: {
    marginTop: 8,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryButtonText: { color: COLORS.white, fontWeight: "800" },
  errorText: {
    color: "#FCA5A5",
    marginTop: 8,
    marginBottom: 8,
    fontWeight: "600",
  },
  loadingText: {
    color: "#93C5FD",
    marginTop: 10,
    marginBottom: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
});