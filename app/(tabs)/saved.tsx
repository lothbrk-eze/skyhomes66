import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { BlurView } from "expo-blur";

const API_URL = "https://bombadir.pythonanywhere.com";
const IMAGE_BASE_URL = "https://bombadir.pythonanywhere.com/static/images/";

const COLORS = {
  background: "#050F24",
  card: "rgba(37,99,235,0.08)",
  primary: "#2563EB",
  primarySoft: "rgba(37,99,235,0.18)",
  text: "#E8F0FF",
  subtext: "#7BA4D4",
  border: "rgba(37,99,235,0.22)",
  error: "#FFB4B4",
};

export default function SavedScreen() {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [savedHouses, setSavedHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState("Loading saved houses...");
  const [error, setError] = useState("");

  const getImageUrl = (house: any) => {
    const image =
      house?.image_url ||
      house?.first_image ||
      house?.image ||
      house?.images;

    if (!image) return "";

    if (Array.isArray(image) && image.length > 0) {
      const first = String(image[0]);
      return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
    }

    try {
      const parsed = JSON.parse(image);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = String(parsed[0]);
        return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
      }
    } catch {}

    if (typeof image === "string") {
      const first = image.split(",")[0]?.trim();
      if (first) {
        return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
      }
    }

    return "";
  };

  const loadLoggedUser = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      const storedUsername = await AsyncStorage.getItem("username");
      const storedRole = await AsyncStorage.getItem("role");
      const storedEmail = await AsyncStorage.getItem("email");
      const storedPhone = await AsyncStorage.getItem("phone");
      const storedUserId = await AsyncStorage.getItem("user_id");

      let user: any = null;

      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        user = parsed?.user ? parsed.user : parsed;
      }

      const normalizedUser = {
        ...(user || {}),
        user_id:
          user?.user_id ||
          user?.id ||
          user?.tenant_id ||
          storedUserId ||
          null,
        username:
          user?.username ||
          user?.name ||
          storedUsername ||
          "",
        role: user?.role || storedRole || "",
        email: user?.email || storedEmail || "",
        phone: user?.phone || storedPhone || "",
      };

      const hasSession =
        !!storedUser ||
        !!storedUsername ||
        !!storedEmail ||
        !!storedPhone ||
        !!storedUserId;

      if (hasSession) {
        setLoggedUser(normalizedUser);
        return normalizedUser;
      }

      setLoggedUser(null);
      return null;
    } catch (err) {
      console.log("Load user error:", err);
      setLoggedUser(null);
      return null;
    }
  }, []);

  const fetchSavedHouses = useCallback(async () => {
    try {
      setError("");
      setLoading("Loading saved houses...");

      const user = await loadLoggedUser();

      if (!user) {
        setLoggedUser(null);
        setSavedHouses([]);
        return;
      }

      if (!user?.user_id) {
        setLoggedUser(user);
        setSavedHouses([]);
        setError("Your account is loaded, but user ID is missing. Please sign in again.");
        return;
      }

      const formData = new FormData();
      formData.append("user_id", String(user.user_id));

      const response = await axios.post(
        `${API_URL}/api/my_saved_houses`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const houses = Array.isArray(response.data)
        ? response.data
        : response.data?.houses ||
          response.data?.saved_houses ||
          response.data?.saved ||
          [];

      setSavedHouses(houses);
    } catch (err: any) {
      console.log("Saved houses error:", err?.response?.data || err);
      setSavedHouses([]);
      setError(
        err?.response?.data?.message || "Failed to load saved houses."
      );
    } finally {
      setLoading("");
    }
  }, [loadLoggedUser]);

  useEffect(() => {
    fetchSavedHouses();
  }, [fetchSavedHouses]);

  useFocusEffect(
    useCallback(() => {
      fetchSavedHouses();
    }, [fetchSavedHouses])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{loading}</Text>
      </View>
    );
  }

  if (!loggedUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Saved Houses</Text>
        <Text style={styles.subtitle}>
          Sign in to save houses and see them here.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && !savedHouses.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>

        {!loggedUser?.user_id && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryButtonText}>Login Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Saved Houses</Text>
      <Text style={styles.subtitle}>
        Houses you have saved to view later.
      </Text>

      {savedHouses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>You have no saved houses yet.</Text>
        </View>
      ) : (
        savedHouses.map((house) => {
          const imageUrl = getImageUrl(house);

          return (
            <TouchableOpacity
              key={house.saved_id || house.property_id}
              style={styles.cardWrapper}
              onPress={() =>
                router.push({
                  pathname: "/house-details",
                  params: { id: String(house.property_id) },
                })
              }
            >
              <BlurView intensity={40} tint="dark" style={styles.card}>
                {!!imageUrl && (
                  <Image source={{ uri: imageUrl }} style={styles.image} />
                )}

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {house.title || house.property_type || "House"}
                  </Text>

                  <Text style={styles.subtext}>
                    {house.location || house.address || "No location"}
                  </Text>

                  <Text style={styles.price}>
                    {String(house.listing_type || "").toLowerCase() === "sale"
                      ? `Sale Price: KES ${Number(house.sale_price || 0).toLocaleString()}`
                      : `KES ${Number(house.monthly_rent || 0).toLocaleString()} / month`}
                  </Text>

                  {String(house.listing_type || "").toLowerCase() !== "sale" && (
                    <Text style={styles.deposit}>
                      Deposit: KES {house.deposit_amount || "N/A"}
                    </Text>
                  )}
                </View>
              </BlurView>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 14,
    paddingBottom: 24,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.background,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },

  subtitle: {
    color: COLORS.subtext,
    marginBottom: 16,
    textAlign: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.subtext,
  },

  errorText: {
    color: COLORS.error,
    textAlign: "center",
    marginBottom: 12,
  },

  primaryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  emptyBox: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
  },

  emptyText: {
    color: COLORS.subtext,
  },

  cardWrapper: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primarySoft,
    backgroundColor: COLORS.card,
  },

  image: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },

  cardBody: {
    padding: 14,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },

  subtext: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  price: {
    marginTop: 6,
    fontWeight: "700",
    color: COLORS.primary,
  },

  deposit: {
    marginTop: 2,
    color: COLORS.subtext,
  },
});