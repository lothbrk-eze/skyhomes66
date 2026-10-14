import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { clearLocalSession, deleteAccountOnServer } from "../lib/account";
import { API_URL, IMAGE_BASE_URL } from "../lib/api";
import { parseAmount } from "../lib/hoodaiSearch";
import ConversationModal from "./ConversationModal";
import SubscriptionModal from "./SubscriptionModal";
import { useSubscription } from "../hooks/useSubscription";
import EditProfileModal from "./EditProfileModal";
import ReUploadModal from "./ReUploadModal";
import DirectMessageModal, { DMParticipant } from "./DirectMessageModal";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#F2F4F8",
  white: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  soft: "#F9FAFB",
  accent: "#FF385C",
  accentLight: "#FFF1F3",
  accentBorder: "#FFD7DE",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  green: "#059669",
  greenLight: "#ECFDF5",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  gold: "#D97706",
  goldLight: "#FFFBEB",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
  avatarBg: "#0F172A",
};

type ActiveSection = "applications" | "properties" | "notifications";

const getFirstImage = (images: any): string => {
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
    if (first) return first.startsWith("http") ? first : `${IMAGE_BASE_URL}${first}`;
  }
  return "";
};

const getInitials = (name: string) => {
  if (!name) return "L";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
};

// ─── Check if property is a rent listing ───────────────────────────────────────
const isRentListing = (item: any): boolean => {
  const type = String(item.listing_type || "").toLowerCase().trim();
  if (type === "sale") return false;
  if (type === "rent") return true;
  // No listing_type set — treat as rent only if sale_price is empty / zero
  const sp = parseAmount(item.sale_price);
  return sp <= 0;
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Premium card ─────────────────────────────────────────────────────────────
function PremiumCard({ isPremium, role, onPress }: { isPremium: boolean; role: string; onPress: () => void }) {
  const label = role === "realtor" ? "Realtor Premium" : "Landlord Premium";
  const sub = isPremium
    ? "Featured listings & top visibility active"
    : "Unlock featured listings and higher visibility";
  return (
    <TouchableOpacity style={styles.premiumCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.premiumCardInner}>
        <View style={styles.premiumIconWrap}>
          <Ionicons name="star" size={22} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTitle}>{isPremium ? `${label} ✓` : label}</Text>
          <Text style={styles.premiumSub}>{sub}</Text>
        </View>
        {!isPremium ? (
          <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>Upgrade</Text></View>
        ) : (
          <Ionicons name="checkmark-circle" size={22} color={C.green} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Quick action (horizontal menu item) ───────────────────────────────────────
function QuickAction({
  icon, iconColor = C.text, iconBg = C.soft, title, badge, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap; iconColor?: string; iconBg?: string;
  title: string; badge?: string | number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.quickActionIconWrap}>
        <View style={[styles.quickActionIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        {badge !== undefined && badge !== "" && String(badge) !== "0" && (
          <View style={styles.quickActionBadge}><Text style={styles.quickActionBadgeText}>{badge}</Text></View>
        )}
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Main component ───────────────────────────────────────────────────────────
const Landlorddashboard = () => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [rememberedUsername, setRememberedUsername] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("applications");

  const [applications, setApplications] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [propertiesError, setPropertiesError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");

  const [conversation, setConversation] = useState<{ threadId: number; title: string; subtitle?: string } | null>(null);
  const [subscriptionVisible, setSubscriptionVisible] = useState(false);
  const { isPremium, refreshSubscription } = useSubscription();
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [reUploadVisible, setReUploadVisible] = useState(false);
  const [dmParticipant, setDmParticipant] = useState<DMParticipant | null>(null);
  const [subscriptionContext, setSubscriptionContext] = useState<any>("listing_boost");

  const normalizeStoredUser = useCallback(async () => {
    const storedUser = await AsyncStorage.getItem("user");
    const storedUsername = await AsyncStorage.getItem("username");
    const storedRole = await AsyncStorage.getItem("role");
    const storedEmail = await AsyncStorage.getItem("email");
    const storedPhone = await AsyncStorage.getItem("phone");
    const storedUserId = await AsyncStorage.getItem("user_id");
    let parsed: any = null;
    if (storedUser) { try { parsed = JSON.parse(storedUser); } catch { parsed = null; } }
    const rawUser = parsed?.user ? parsed.user : parsed;
    const normalized = {
      ...(rawUser || {}),
      user_id: rawUser?.user_id || rawUser?.id || parsed?.user_id || parsed?.id || storedUserId || null,
      username: rawUser?.username || rawUser?.name || parsed?.username || storedUsername || "",
      name: rawUser?.name || rawUser?.username || parsed?.name || storedUsername || "",
      role: rawUser?.role || parsed?.role || storedRole || "",
      email: rawUser?.email || parsed?.email || storedEmail || "",
      phone: rawUser?.phone || parsed?.phone || storedPhone || "",
    };
    const hasSession = !!storedUser || !!storedUsername || !!storedEmail || !!storedPhone || !!storedUserId;
    return hasSession ? normalized : null;
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true); setError("");
      const user = await normalizeStoredUser();
      setLoggedUser(user);
      setRememberedUsername(user?.username || user?.name || "");
      if (user?.username || user?.name) await AsyncStorage.setItem("username", user.username || user.name);
      if (user?.user_id) { await AsyncStorage.setItem("user", JSON.stringify(user)); await AsyncStorage.setItem("user_id", String(user.user_id)); }
      return user;
    } catch { setLoggedUser(null); setError("Failed to load user session"); return null; }
    finally { setLoadingUser(false); }
  }, [normalizeStoredUser]);

  const handleSaveSuccess = useCallback(async (updatedUser: any) => {
    try {
      const rawUser = updatedUser?.user ? updatedUser.user : updatedUser;
      
      const storedUserStr = await AsyncStorage.getItem("user");
      let parsed = storedUserStr ? JSON.parse(storedUserStr) : {};
      const updatedSessionUser = {
        ...(parsed?.user ? parsed.user : parsed),
        ...rawUser,
      };

      await AsyncStorage.setItem("user", JSON.stringify(updatedSessionUser));
      if (updatedSessionUser.username || updatedSessionUser.name) {
        await AsyncStorage.setItem("username", updatedSessionUser.username || updatedSessionUser.name);
      }
      if (updatedSessionUser.email) {
        await AsyncStorage.setItem("email", updatedSessionUser.email);
      }
      if (updatedSessionUser.phone) {
        await AsyncStorage.setItem("phone", updatedSessionUser.phone);
      }

      await loadUser();
    } catch (err) {
      console.error("Failed to persist updated user:", err);
    }
  }, [loadUser]);

  const handleReUploadSuccess = useCallback(async (updatedUser: any) => {
    try {
      const rawUser = updatedUser?.user ? updatedUser.user : updatedUser;
      const storedUserStr = await AsyncStorage.getItem("user");
      let parsed = storedUserStr ? JSON.parse(storedUserStr) : {};
      const updatedSessionUser = { ...(parsed?.user ? parsed.user : parsed), ...rawUser };
      await AsyncStorage.setItem("user", JSON.stringify(updatedSessionUser));
      await loadUser();
    } catch (err) {
      console.error("Failed to persist re-upload result:", err);
    }
  }, [loadUser]);

  const fetchApplications = useCallback(async (user?: any) => {
    if (!user?.user_id) return;
    setLoadingApplications(true); setApplicationsError("");
    try {
      const fd = new FormData(); fd.append("landlord_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/landlord_applications`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setApplications(res.data?.applications || []);
    } catch (err: any) { setApplications([]); setApplicationsError(err?.response?.data?.message || "Failed to load applications"); }
    finally { setLoadingApplications(false); }
  }, []);

  const fetchProperties = useCallback(async (user?: any) => {
    if (!user?.user_id) return;
    setLoadingProperties(true); setPropertiesError("");
    try {
      const fd = new FormData(); fd.append("landlord_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/landlord_properties`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProperties(res.data?.properties || []);
    } catch (err: any) { setProperties([]); setPropertiesError(err?.response?.data?.message || "Failed to load properties"); }
    finally { setLoadingProperties(false); }
  }, []);

  const fetchNotifications = useCallback(async (user?: any) => {
    if (!user?.user_id) return;
    setLoadingNotifications(true); setNotificationsError("");
    try {
      const fd = new FormData(); fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_notifications`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setNotifications(res.data?.notifications || []);
    } catch (err: any) { setNotifications([]); setNotificationsError(err?.response?.data?.message || "Failed to load notifications"); }
    finally { setLoadingNotifications(false); }
  }, []);

  const markNotificationRead = (notificationId: number | string) => {
    const idStr = String(notificationId);
    if (!idStr || idStr === "0" || idStr === "NaN") return;
    setNotifications((prev) => prev.map((n) => String(n.notification_id) === idStr ? { ...n, is_read: "Yes" } : n));
  };

  const init = useCallback(async () => {
    const user = await loadUser();
    if (!user?.user_id) { setError("Please login first"); return; }
    await Promise.all([fetchApplications(user), fetchProperties(user), fetchNotifications(user)]);
  }, [loadUser, fetchApplications, fetchProperties, fetchNotifications]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init(); }, []);

  const handleLogout = async () => {
    try {
      const savedName = loggedUser?.username || loggedUser?.name || rememberedUsername || "";
      await clearLocalSession(savedName || undefined);
      setLoggedUser(null); setApplications([]); setProperties([]); setNotifications([]);
      router.replace("/login");
    } catch { Alert.alert("Error", "Logout failed"); }
  };

  const handleDeleteAccount = () => {
    if (!loggedUser?.user_id) { router.push("/login"); return; }
    Alert.alert("Delete account", "This permanently deletes your account, listings, and related data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: async () => {
        try {
          setDeletingAccount(true);
          await deleteAccountOnServer(loggedUser.user_id);
          const savedName = loggedUser?.username || loggedUser?.name || rememberedUsername || "";
          await clearLocalSession(savedName || undefined);
          setLoggedUser(null); setApplications([]); setProperties([]); setNotifications([]); setError("");
          Alert.alert("Account deleted", "Your account has been removed.");
          router.replace("/login");
        } catch (err: any) { Alert.alert("Error", err?.response?.data?.message || "Failed to delete account."); }
        finally { setDeletingAccount(false); }
      }},
    ]);
  };

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const user = await loadUser();
      if (!user?.user_id) { setError("Please login first"); return; }
      await Promise.all([fetchApplications(user), fetchProperties(user), fetchNotifications(user)]);
    } finally { setRefreshing(false); }
  }, [loadUser, fetchApplications, fetchProperties, fetchNotifications]);

  const updateApplicationStatus = async (applicationId: number, status: "Accepted" | "Rejected") => {
    try {
      if (!loggedUser?.user_id) { Alert.alert("Error", "Please login first"); return; }
      setActionLoading(`${status === "Accepted" ? "Accepting" : "Rejecting"} application…`);
      const fd = new FormData();
      fd.append("application_id", String(applicationId)); fd.append("status", status); fd.append("landlord_id", String(loggedUser.user_id));
      const res = await axios.post(`${API_URL}/api/update_application_status`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      Alert.alert("Success", res.data?.message || `Application ${status}`);
      await Promise.all([fetchApplications(loggedUser), fetchNotifications(loggedUser)]);
    } catch (err: any) { Alert.alert("Error", err?.response?.data?.message || "Failed to update application"); }
    finally { setActionLoading(""); }
  };

  const deleteProperty = async (propertyId: number) => {
    if (!loggedUser?.user_id) { Alert.alert("Error", "Please login first"); return; }
    Alert.alert("Delete Property", "Are you sure you want to delete this property?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          setActionLoading("Deleting property…");
          const fd = new FormData(); fd.append("property_id", String(propertyId)); fd.append("landlord_id", String(loggedUser.user_id));
          const res = await axios.post(`${API_URL}/api/delete_property`, fd, { headers: { "Content-Type": "multipart/form-data" } });
          Alert.alert("Success", res.data?.message || "Property deleted");
          await fetchProperties(loggedUser);
        } catch (err: any) { Alert.alert("Error", err?.response?.data?.message || "Failed to delete property"); }
        finally { setActionLoading(""); }
      }},
    ]);
  };

  const pendingApplications = useMemo(() => applications.filter((a) => String(a.status) === "Pending").length, [applications]);
  const availableProperties = useMemo(() => properties.filter((p) => String(p.availability_status || "").toLowerCase() === "available").length, [properties]);
  const unreadCount = useMemo(() => notifications.filter((n) => n.is_read === "No" || n.is_read === 0 || n.is_read === false).length, [notifications]);

  const displayName = loggedUser?.username || loggedUser?.name || rememberedUsername || loggedUser?.email?.split("@")[0] || (loggedUser?.role === "realtor" ? "Realtor" : "Landlord");
  const displayEmail = loggedUser?.email || "";
  const role = loggedUser?.role || "landlord";

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loaderText}>Loading dashboard…</Text>
      </View>
    );
  }

  // ── Section renderers ────────────────────────────────────────────────────────
  const renderApplications = () => {
    if (loadingApplications) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (applicationsError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{applicationsError}</Text></View>;
    if (applications.length === 0) return <EmptyCard title="No applications yet" text={role === "realtor" ? "Inquiries for your listings will appear here." : "Tenant applications for your properties will appear here."} />;
    return (
      <View style={styles.cardsWrap}>
        {applications.map((app) => (
          <View key={app.application_id} style={styles.appCard}>
            <View style={styles.appCardTop}>
              <Text style={styles.appCardTitle} numberOfLines={1}>{app.title || "Property application"}</Text>
              <View style={[styles.statusChip, app.status === "Accepted" ? styles.chipGreen : app.status === "Rejected" ? styles.chipRed : styles.chipAmber]}>
                <Text style={[styles.statusChipText, { color: app.status === "Accepted" ? C.green : app.status === "Rejected" ? C.danger : C.gold }]}>{app.status || "Pending"}</Text>
              </View>
            </View>
            <View style={styles.appInfoGrid}>
              <View style={styles.appInfoItem}><Ionicons name="person-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{app.name || "N/A"}</Text></View>
              <View style={styles.appInfoItem}><Ionicons name="call-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{app.phone || "N/A"}</Text></View>
              <View style={styles.appInfoItem}><Ionicons name="briefcase-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{app.occupation || "N/A"}</Text></View>
              <View style={styles.appInfoItem}><Ionicons name="cash-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{app.income || "N/A"}</Text></View>
            </View>
            {!!app.reason && <Text style={styles.appReason} numberOfLines={2}>{app.reason}</Text>}
            <TouchableOpacity style={styles.msgBtn} onPress={() => setConversation({ threadId: app.application_id, title: app.title || "Application", subtitle: `Message ${app.name || "tenant"}` })}>
              <Ionicons name="chatbubble-outline" size={14} color={C.white} />
              <Text style={styles.msgBtnText}>Message tenant</Text>
            </TouchableOpacity>
            {String(app.status) === "Pending" && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => updateApplicationStatus(app.application_id, "Accepted")}>
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => updateApplicationStatus(app.application_id, "Rejected")}>
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderProperties = () => {
    if (loadingProperties) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (propertiesError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{propertiesError}</Text></View>;
    const rentProperties = properties.filter(isRentListing);
    return (
      <View style={styles.cardsWrap}>
        <TouchableOpacity style={styles.addPropertyBtn} onPress={() => router.push("/add-house")}>
          <Ionicons name="add-circle" size={20} color={C.white} />
          <Text style={styles.addPropertyBtnText}>Add new property</Text>
        </TouchableOpacity>
        {rentProperties.length === 0 && <EmptyCard title="No rental properties yet" text="Start by adding your first property listing for rent." />}
        {rentProperties.map((property) => {
          const imageUri = property.first_image || getFirstImage(property.images);
          return (
            <View key={property.property_id} style={styles.propCard}>
              <View style={styles.propImageWrap}>
                {!!imageUri && <Image source={{ uri: imageUri }} style={styles.propImage} />}
                {isPremium && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#fff" />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.propBody}>
                <View style={styles.appCardTop}>
                  <Text style={styles.appCardTitle} numberOfLines={1}>{property.title || "Untitled property"}</Text>
                  <View style={[styles.statusChip, { backgroundColor: C.soft }]}>
                    <Text style={[styles.statusChipText, { color: C.subtext }]}>{property.availability_status || "Unknown"}</Text>
                  </View>
                </View>
                <View style={styles.appInfoItem}><Ionicons name="business-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{property.property_type || "N/A"}</Text></View>
                <View style={styles.appInfoItem}><Ionicons name="location-outline" size={13} color={C.muted} /><Text style={styles.appInfoText}>{property.address || "N/A"}</Text></View>
                <Text style={styles.propPrice}>
                  {String(property.listing_type || "").toLowerCase() === "sale"
                    ? `KES ${Number(property.sale_price || 0).toLocaleString()}`
                    : `KES ${Number(property.monthly_rent || 0).toLocaleString()}/mo`}
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => router.push({ pathname: "/add-house", params: { property_id: String(property.property_id) } })}>
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => deleteProperty(property.property_id)}>
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderNotifications = () => {
    if (loadingNotifications) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (notificationsError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{notificationsError}</Text></View>;
    if (notifications.length === 0) return <EmptyCard title="No notifications" text={`Updates about your ${role} account will show here.`} />;
    return (
      <View style={styles.cardsWrap}>
        {notifications.map((note) => {
          const unread = note.is_read === "No" || note.is_read === 0 || note.is_read === false;
          return (
            <TouchableOpacity key={note.notification_id} style={[styles.notifCard, unread && styles.notifCardUnread]} onPress={() => markNotificationRead(note.notification_id)} activeOpacity={0.7}>
              <View style={styles.notifRow}>
                <Text style={styles.notifTitle}>{note.title || "Notification"}</Text>
                {unread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifBody}>{note.message || "No message"}</Text>
              <Text style={styles.notifDate}>{formatDate(note.created_at) || "No date"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => { if (!loggedUser) { router.push("/login"); return; } setEditProfileVisible(true); }}
            style={styles.nameRow}>
            <Text style={styles.headerName}>{displayName}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.subtext} />
          </TouchableOpacity>
          <Text style={styles.headerEmail}>{displayEmail || (loggedUser ? "Your account" : "Sign in to continue")}</Text>
        </View>
      </View>

      {!!error && <View style={styles.infoBox}><Text style={styles.infoBoxText}>{error}</Text></View>}
      {!!actionLoading && <View style={styles.actionInfoBox}><ActivityIndicator size="small" color={C.blue} style={{ marginRight: 8 }} /><Text style={styles.actionInfoText}>{actionLoading}</Text></View>}

      {/* ── Rejected documents banner ── */}
      {loggedUser?.verification_status === "rejected" && (
        <View style={styles.rejectedBanner}>
          <View style={styles.rejectedBannerTop}>
            <Ionicons name="close-circle" size={20} color={C.danger} />
            <Text style={styles.rejectedBannerTitle}>Verification Failed</Text>
          </View>
          <Text style={styles.rejectedBannerText}>
            Your submitted documents were rejected. Please upload new, clear photos of your ID and proof of ownership for review.
          </Text>
          <TouchableOpacity style={styles.reUploadBtn} onPress={() => setReUploadVisible(true)} activeOpacity={0.85}>
            <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
            <Text style={styles.reUploadBtnText}>Re-upload Documents</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Add property CTA ── */}
      <TouchableOpacity style={styles.hostCard} activeOpacity={0.88} onPress={() => router.push("/add-house")}>
        <View style={styles.hostCardText}>
          <Text style={styles.hostCardTitle}>Add a new property</Text>
          <Text style={styles.hostCardSub}>{role === "realtor" ? "List a property for sale and start receiving inquiries." : "Set up your listing and start receiving tenant applications."}</Text>
        </View>
        <View style={styles.hostArtwork}>
          <Ionicons name="home-outline" size={38}  />
        </View>
      </TouchableOpacity>

      {/* ── Menu (horizontal, scrollable) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActionsScroll}
        contentContainerStyle={styles.quickActionsRow}
      >
        <QuickAction icon="person-circle-outline"   title="Personal info"
          onPress={() => { if (!loggedUser) { router.push("/login"); return; } setEditProfileVisible(true); }} />
        <QuickAction icon="business-outline"   title="My listings"
          badge={properties.length} onPress={() => setActiveSection("properties")} />
        <QuickAction icon="document-text-outline" 
          title={role === "realtor" ? "Inquiries" : "Applications"}
          badge={applications.length} onPress={() => setActiveSection("applications")} />
        <QuickAction icon="notifications-outline"  title="Notifications"
          badge={unreadCount} onPress={() => setActiveSection("notifications")} />
        <QuickAction icon="shield-checkmark-outline"  title="Login & security"
          onPress={() => router.push("/login")} />
      </ScrollView>

      {/* ── Active section ── */}
      <SectionHeader title={
        activeSection === "applications" ? (role === "realtor" ? "Property inquiries" : "Tenant applications") :
        activeSection === "properties" ? "My properties" :
        "Notifications"
      } />

      {activeSection === "applications" && renderApplications()}
      {activeSection === "properties" && renderProperties()}
      {activeSection === "notifications" && renderNotifications()}

      {/* ── Modals ── */}
      {conversation && loggedUser?.user_id && (
        <ConversationModal visible={!!conversation} onClose={() => setConversation(null)} threadType="application"
          threadId={conversation.threadId} userId={loggedUser.user_id} senderRole="landlord"
          title={conversation.title} subtitle={conversation.subtitle} />
      )}
      <SubscriptionModal visible={subscriptionVisible} context={subscriptionContext || (role === "realtor" ? "realtor_signup" : "listing_boost")}
        onClose={() => setSubscriptionVisible(false)} onLater={() => setSubscriptionVisible(false)}
        onSubscribed={async () => { await refreshSubscription(); setSubscriptionVisible(false); }} />
      {editProfileVisible && loggedUser && (
        <EditProfileModal
          visible={editProfileVisible}
          onClose={() => setEditProfileVisible(false)}
          user={loggedUser}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
      {reUploadVisible && loggedUser?.user_id && (
        <ReUploadModal
          visible={reUploadVisible}
          onClose={() => setReUploadVisible(false)}
          userId={loggedUser.user_id}
          onUploadSuccess={handleReUploadSuccess}
        />
      )}
      {/* In-App Direct Message Modal with Contractor / Tenant */}
      {dmParticipant && loggedUser?.user_id && (
        <DirectMessageModal
          visible={!!dmParticipant}
          onClose={() => setDmParticipant(null)}
          participant={dmParticipant}
          currentUserId={loggedUser.user_id}
        />
      )}

      {/* ── Premium card ── */}
      <PremiumCard isPremium={isPremium} role={role} onPress={() => { setSubscriptionContext("listing_boost"); setSubscriptionVisible(true); }} />

      {/* ── Footer ── */}
      <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={C.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.deleteBtn, deletingAccount && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handleDeleteAccount} disabled={deletingAccount}>
        {deletingAccount ? <ActivityIndicator size="small" color={C.danger} /> : <Text style={styles.deleteBtnText}>Delete account</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default Landlorddashboard;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 48 },

  loaderWrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  loaderText: { marginTop: 12, fontSize: 15, color: C.subtext },
  loaderSection: { paddingVertical: 28, alignItems: "center" },

  // ── Header
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.avatarBg, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontWeight: "800", color: C.white, letterSpacing: 0.5 },
  headerTextWrap: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerName: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.4 },
  headerEmail: { marginTop: 3, fontSize: 14, color: C.subtext },

  // ── Stats
  statsRow: { flexDirection: "row", backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingVertical: 16, marginBottom: 14, alignItems: "center" },
  statPill: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: "600" },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },

  // ── Premium card
  premiumCard: {
    backgroundColor: C.white, borderRadius: 18, borderWidth: 1.5, borderColor: "#FDE68A", marginBottom: 14, overflow: "hidden",
    shadowColor: "#D97706", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  premiumCardInner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  premiumIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldLight, alignItems: "center", justifyContent: "center" },
  premiumTitle: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 3 },
  premiumSub: { fontSize: 12, color: C.subtext, lineHeight: 17 },
  premiumBadge: { backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  premiumBadgeText: { color: C.white, fontSize: 12, fontWeight: "800" },

  // ── Host CTA card
  hostCard: {
    backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  hostCardText: { flex: 1, paddingRight: 14 },
  hostCardTitle: { fontSize: 17, fontWeight: "800", color: C.text, marginBottom: 6 },
  hostCardSub: { fontSize: 13, lineHeight: 19, color: C.subtext },
  hostArtwork: { width: 72, height: 72, borderRadius: 16,  alignItems: "center", justifyContent: "center" },

  mgmtCtaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mgmtCtaTextWrap: { flex: 1, paddingRight: 14 },
  mgmtCtaTitle: { fontSize: 18, fontWeight: "800", color: "#000000", marginBottom: 4 },
  mgmtCtaSub: { fontSize: 12.5, color: "#374151", lineHeight: 18 },
  mgmtCtaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buildingMgmtBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  buildingMgmtBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },

  // ── Quick actions (horizontal, scrollable menu)
  quickActionsScroll: { marginBottom: 28 },
  quickActionsRow: { flexDirection: "row", gap: 16, paddingRight: 8 },
  quickAction: { width: 78, alignItems: "center" },
  quickActionIconWrap: { position: "relative", marginBottom: 8 },
  quickActionIcon: {
    width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  quickActionBadge: {
    position: "absolute", top: -4, right: -4, backgroundColor: C.accent, borderRadius: 20,
    minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.bg,
  },
  quickActionBadgeText: { color: C.white, fontSize: 10, fontWeight: "800" },
  quickActionLabel: { fontSize: 12, fontWeight: "600", color: C.text, textAlign: "center", lineHeight: 15 },

  // ── Section header
  sectionHeader: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 14, letterSpacing: -0.3 },

  // ── Empty / info
  emptyCard: { backgroundColor: C.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 21, color: C.subtext },
  infoBox: { backgroundColor: C.accentLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.accentBorder },
  infoBoxText: { color: C.danger, fontSize: 14, fontWeight: "600" },
  actionInfoBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.blueLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  actionInfoText: { color: C.blue, fontSize: 14, fontWeight: "600" },

  // ── Application card
  cardsWrap: { gap: 14 },
  appCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
  appCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 },
  appCardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text },
  statusChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  chipGreen: { backgroundColor: C.greenLight },
  chipRed: { backgroundColor: C.dangerLight },
  chipAmber: { backgroundColor: C.goldLight },
  appInfoGrid: { gap: 4, marginBottom: 6 },
  appInfoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  appInfoText: { fontSize: 13, color: C.subtext },
  appReason: { fontSize: 13, color: C.subtext, fontStyle: "italic", marginBottom: 6 },
  msgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 11, marginTop: 10 },
  msgBtnText: { color: C.white, fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  acceptBtn: { backgroundColor: C.green },
  rejectBtn: { backgroundColor: C.danger },
  editBtn: { backgroundColor: C.blue },
  actionBtnText: { color: C.white, fontWeight: "800", fontSize: 13 },

  // ── Property card
  propCard: { backgroundColor: C.white, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  propImageWrap: { position: "relative" },
  propImage: { width: "100%", height: 180, backgroundColor: "#EFEFEF" },
  verifiedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: C.green,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
  },
  verifiedBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  propBody: { padding: 14 },
  propPrice: { fontSize: 16, fontWeight: "800", color: C.text, marginTop: 6, marginBottom: 4 },
  addPropertyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14 },
  addPropertyBtnText: { color: C.white, fontWeight: "800", fontSize: 15 },

  // ── Notification card
  notifCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: C.accent },
  notifRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  notifTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: C.text, paddingRight: 8 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
  notifBody: { fontSize: 14, lineHeight: 20, color: C.subtext },
  notifDate: { fontSize: 12, color: C.muted, fontWeight: "600", marginTop: 8 },

  // ── Footer
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: C.accentBorder, backgroundColor: C.accentLight, paddingVertical: 15 },
  logoutText: { color: C.danger, fontSize: 15, fontWeight: "700" },
  deleteBtn: { marginBottom: 20, borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", backgroundColor: C.dangerLight, alignItems: "center", justifyContent: "center", paddingVertical: 15 },
  deleteBtnText: { color: C.danger, fontSize: 15, fontWeight: "800" },

  // ── Rejected banner
  rejectedBanner: { backgroundColor: C.dangerLight, borderRadius: 16, borderWidth: 1.5, borderColor: "#FECACA", padding: 16, marginBottom: 16 },
  rejectedBannerTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  rejectedBannerTitle: { fontSize: 15, fontWeight: "800", color: C.danger },
  rejectedBannerText: { fontSize: 13, color: "#7F1D1D", lineHeight: 18, marginBottom: 12 },
  reUploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.danger, borderRadius: 12, paddingVertical: 11 },
  reUploadBtnText: { color: C.white, fontWeight: "800", fontSize: 14 },

  // ── Pro+ Section
  proSectionCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  proSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  proSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  proSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: C.text,
  },
  proTierPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proTierPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  enterpriseSectionCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  enterpriseSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: C.text,
  },
  enterpriseTierPill: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  enterpriseTierPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#7C3AED",
    letterSpacing: 0.5,
  },
  proActionsScroll: {
    marginHorizontal: -4,
  },
  proActionsScrollContent: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
  },
  proActionCard: {
    width: 106,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  proActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  proActionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    lineHeight: 15,
    marginBottom: 3,
  },
  proActionSub: {
    fontSize: 9,
    color: C.subtext,
    textAlign: "center",
    fontWeight: "600",
  },
});