import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  surface2: "#232329",
  white: "#FFFFFF",
  muted: "#A1A1AA",
  border: "#2F2F37",
  accent: "#2563EB",
  green: "#16A34A",
  red: "#DC2626",
  yellow: "#F59E0B",
  info: "#0EA5E9",
};

export default function ApplicationsScreen() {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

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
    if (storedUser) {
      parsed = JSON.parse(storedUser);
    }

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

  const fetchApplications = useCallback(async (user: any) => {
    try {
      setLoadingApplications("Loading applications...");
      setApplicationsError("");

      const formData = new FormData();
      formData.append("user_id", String(user.user_id));

      const response = await axios.post(
        `${API_URL}/api/my_house_applications`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const apps = Array.isArray(response.data)
        ? response.data
        : response.data?.applications || [];

      setApplications(apps);
    } catch (err: any) {
      console.log("Applications error:", err?.response?.data || err);
      setApplicationsError(
        err?.response?.data?.message || "Failed to load applications"
      );
      setApplications([]);
    } finally {
      setLoadingApplications("");
    }
  }, []);

  const refreshPage = useCallback(async () => {
    try {
      setRefreshing(true);
      const user = await loadUser();

      if (!user?.user_id) {
        setApplications([]);
        setApplicationsError("Please sign in again to view applications.");
        return;
      }

      await fetchApplications(user);
    } finally {
      setRefreshing(false);
    }
  }, [loadUser, fetchApplications]);

  useEffect(() => {
    const init = async () => {
      const user = await loadUser();

      if (!user?.user_id) {
        setApplications([]);
        setApplicationsError("Please sign in again to view applications.");
        return;
      }

      await fetchApplications(user);
    };

    init();
  }, [loadUser, fetchApplications]);

  const filteredApplications = useMemo(() => {
    if (activeFilter === "All") return applications;
    return applications.filter((app) => app.status === activeFilter);
  }, [applications, activeFilter]);

  const latestAcceptedApplication = applications.find(
    (app) => app.status === "Accepted"
  );

  const getStatusStyle = (status: string) => {
    if (status === "Accepted") return styles.statusAccepted;
    if (status === "Rejected") return styles.statusRejected;
    if (status === "Reviewing") return styles.statusReviewing;
    return styles.statusPending;
  };

  if (loadingUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  if (!loggedUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>My Applications</Text>
        <Text style={styles.emptyText}>Please log in to view your applications.</Text>
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
      <Text style={styles.title}>My Applications</Text>
      <Text style={styles.subtitle}>Track your house application progress</Text>

      <View style={styles.filterRow}>
        {["All", "Pending", "Reviewing", "Accepted", "Rejected"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.filterChip,
              activeFilter === item && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(item)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === item && styles.filterChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!loadingApplications && (
        <Text style={styles.loadingText}>{loadingApplications}</Text>
      )}

      {!!applicationsError && (
        <>
          <Text style={styles.errorText}>{applicationsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshPage}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </>
      )}

      {!loadingApplications && !!latestAcceptedApplication && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            Good news! Your application for{" "}
            {latestAcceptedApplication.property_type || latestAcceptedApplication.title} in{" "}
            {latestAcceptedApplication.location || latestAcceptedApplication.address} has been approved.
          </Text>
        </View>
      )}

      {!loadingApplications && !applicationsError && filteredApplications.length === 0 && (
        <Text style={styles.emptyText}>No applications found.</Text>
      )}

      {filteredApplications.map((app) => {
        const imageUrl = getFirstImage(app.images || app.image_url);

        return (
          <TouchableOpacity
            key={app.application_id}
            activeOpacity={0.9}
            style={styles.card}
            onPress={() => {
              if (app.property_id) {
                router.push({
                  pathname: "/house-details",
                  params: {
                    id: String(app.property_id),
                    hideActions: "true",
                  },
                });
              }
            }}
          >
            {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.itemImage} />}

            <Text style={styles.itemTitle}>
              {app.property_type || app.title || "House"}
            </Text>

            <Text style={styles.itemText}>
              Location: {app.location || app.address || "N/A"}
            </Text>
            <Text style={styles.itemText}>
              {String(app.listing_type || "").toLowerCase() === "sale"
                ? `Sale Price: KES ${app.sale_price || "N/A"}`
                : `Rent: KES ${app.monthly_rent || "N/A"}`}
            </Text>
            {String(app.listing_type || "").toLowerCase() !== "sale" && (
              <Text style={styles.itemText}>
                Deposit: KES {app.deposit_amount || "N/A"}
              </Text>
            )}
            <Text style={styles.itemText}>
              Landlord Phone:{" "}
              {app.landlord_phone ||
                app.landlord_contact ||
                app.landlord_phone_number ||
                "Not available"}
            </Text>

            <View style={[styles.statusBadge, getStatusStyle(app.status)]}>
              <Text style={styles.statusText}>{app.status || "Pending"}</Text>
            </View>

            {!!app.property_id && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  router.push({
                    pathname: "/house-details",
                    params: {
                      id: String(app.property_id),
                      hideActions: "true",
                    },
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: { backgroundColor: COLORS.white },
  filterChipText: { color: COLORS.white, fontWeight: "700" },
  filterChipTextActive: { color: COLORS.bg },
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
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusAccepted: { backgroundColor: COLORS.green },
  statusRejected: { backgroundColor: COLORS.red },
  statusReviewing: { backgroundColor: COLORS.info },
  statusPending: { backgroundColor: COLORS.yellow },
  statusText: { color: COLORS.white, fontWeight: "800" },
  successBox: {
    backgroundColor: "rgba(22,163,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.35)",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    marginTop: 6,
  },
  successText: {
    color: "#86EFAC",
    fontWeight: "600",
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