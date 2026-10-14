import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { clearLocalSession, deleteAccountOnServer } from "../lib/account";
import { API_URL, IMAGE_BASE_URL } from "../lib/api";
import ConversationModal from "./ConversationModal";
import SubscriptionModal from "./SubscriptionModal";
import { useSubscription } from "../hooks/useSubscription";
import EditProfileModal from "./EditProfileModal";
import LeaseAgreementModal from "./LeaseAgreementModal";
import DirectMessageModal, { DMParticipant } from "./DirectMessageModal";
import { findTenantLeases, LeaseAgreementData } from "../lib/leaseStorage";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#F2F4F8",
  white: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  soft: "#F9FAFB",
  primary: "#FF385C",
  primaryLight: "#FFF1F3",
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
  amber: "#D97706",
  amberLight: "#FFFBEB",
  avatarBg: "#1E3A5F",
};

type ActiveSection = "applications" | "saved" | "notifications" | "inquiries";

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
  if (!name) return "U";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 4 }} />
      <Text style={[styles.statValue, { color: C.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Premium upgrade card ─────────────────────────────────────────────────────
function PremiumCard({ isPremium, onPress }: { isPremium: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.premiumCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.premiumCardInner}>
        <View style={styles.premiumIconWrap}>
          <Ionicons name="star" size={22} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTitle}>
            {isPremium ? "Premium Active ✓" : "Upgrade to Premium"}
          </Text>
          <Text style={styles.premiumSub}>
            {isPremium ? "You have direct chat & early access" : "Get early access & direct chat with landlords"}
          </Text>
        </View>
        {!isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>Upgrade</Text>
          </View>
        )}
        {isPremium && (
          <Ionicons name="checkmark-circle" size={22} color={C.green} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Menu row ─────────────────────────────────────────────────────────────────
function MenuRow({
  icon,
  iconColor = C.text,
  iconBg = C.soft,
  title,
  subtitle,
  badge,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  badge?: string | number;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && { borderBottomWidth: 0 }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.menuSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <View style={styles.menuRight}>
        {badge !== undefined && badge !== "" && String(badge) !== "0" && (
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </View>
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
const Tenantdashboard = () => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [rememberedUsername, setRememberedUsername] = useState("");
  const { isPremium, refreshSubscription } = useSubscription();
  const [subscriptionVisible, setSubscriptionVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const [applications, setApplications] = useState<any[]>([]);
  const [savedHouses, setSavedHouses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [error, setError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [savedError, setSavedError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [inquiriesError, setInquiriesError] = useState("");

  const [activeSection, setActiveSection] = useState<ActiveSection>("applications");
  const [expandedNotificationId, setExpandedNotificationId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<{
    threadType: "inquiry" | "application";
    threadId: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Tenancy Lease Agreement state
  const [myLease, setMyLease] = useState<LeaseAgreementData | null>(null);
  const [leaseModalVisible, setLeaseModalVisible] = useState(false);

  // In-App Messaging with Landlord State
  const [dmLandlord, setDmLandlord] = useState<DMParticipant | null>(null);

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
      setLoadingUser(true);
      setError("");
      const user = await normalizeStoredUser();
      setLoggedUser(user);
      setRememberedUsername(user?.username || user?.name || "");
      if (user?.username || user?.name) await AsyncStorage.setItem("username", user.username || user.name);
      if (user?.user_id) {
        await AsyncStorage.setItem("user", JSON.stringify(user));
        await AsyncStorage.setItem("user_id", String(user.user_id));
      }
      return user;
    } catch {
      setLoggedUser(null);
      setError("Failed to load user session");
      return null;
    } finally { setLoadingUser(false); }
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

  const fetchMyApplications = useCallback(async (user: any) => {
    setLoadingApplications(true); setApplicationsError("");
    try {
      const fd = new FormData(); fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_house_applications`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setApplications(Array.isArray(res.data) ? res.data : res.data?.applications || []);
    } catch (err: any) { setApplicationsError(err?.response?.data?.message || "Failed to load applications"); setApplications([]); }
    finally { setLoadingApplications(false); }
  }, []);

  const fetchSavedHouses = useCallback(async (user: any) => {
    setLoadingSaved(true); setSavedError("");
    try {
      const fd = new FormData(); fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_saved_houses`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSavedHouses(Array.isArray(res.data) ? res.data : res.data?.houses || res.data?.saved_houses || []);
    } catch (err: any) { setSavedError(err?.response?.data?.message || "Failed to load saved houses"); setSavedHouses([]); }
    finally { setLoadingSaved(false); }
  }, []);

  const fetchInquiries = useCallback(async (user: any) => {
    setLoadingInquiries(true); setInquiriesError("");
    try {
      const fd = new FormData(); fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_inquiries`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setInquiries(Array.isArray(res.data?.inquiries) ? res.data.inquiries : []);
    } catch (err: any) { setInquiriesError(err?.response?.data?.message || "Failed to load inquiries"); setInquiries([]); }
    finally { setLoadingInquiries(false); }
  }, []);

  const fetchNotifications = useCallback(async (user: any) => {
    setLoadingNotifications(true); setNotificationsError("");
    try {
      const fd = new FormData(); fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_notifications`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setNotifications(Array.isArray(res.data) ? res.data : res.data?.notifications || []);
    } catch (err: any) { setNotificationsError(err?.response?.data?.message || "Failed to load notifications"); setNotifications([]); }
    finally { setLoadingNotifications(false); }
  }, []);

  const fetchMyLease = useCallback(async (user: any) => {
    if (!user) return;
    try {
      const list = await findTenantLeases(user.phone, user.email, user.name || user.username, user.user_id);
      if (list.length > 0) {
        setMyLease(list[0]);
      } else {
        setMyLease(null);
      }
    } catch (e) {
      console.error("Failed to load tenant lease", e);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true); setError("");
    const user = await loadUser();
    if (user?.user_id) {
      await Promise.all([
        fetchMyApplications(user),
        fetchSavedHouses(user),
        fetchNotifications(user),
        fetchInquiries(user),
        fetchMyLease(user),
      ]);
    } else {
      setApplications([]); setSavedHouses([]); setNotifications([]); setInquiries([]); setMyLease(null);
    }
    setRefreshing(false);
  }, [loadUser, fetchMyApplications, fetchSavedHouses, fetchNotifications, fetchInquiries, fetchMyLease]);

  useEffect(() => {
    const init = async () => {
      const user = await loadUser();
      if (user?.user_id) {
        await Promise.all([
          fetchMyApplications(user),
          fetchSavedHouses(user),
          fetchNotifications(user),
          fetchInquiries(user),
          fetchMyLease(user),
        ]);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    const savedName = loggedUser?.username || loggedUser?.name || rememberedUsername || "";
    await clearLocalSession(savedName || undefined);
    setLoggedUser(null); setApplications([]); setSavedHouses([]); setNotifications([]); setError("");
    router.replace("/login");
  };

  const handleDeleteAccount = () => {
    if (!loggedUser?.user_id) { router.push("/login"); return; }
    Alert.alert("Delete account", "This permanently deletes your account, saved houses, and applications. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: async () => {
        try {
          setDeletingAccount(true);
          await deleteAccountOnServer(loggedUser.user_id);
          const savedName = loggedUser?.username || loggedUser?.name || rememberedUsername || "";
          await clearLocalSession(savedName || undefined);
          setLoggedUser(null); setApplications([]); setSavedHouses([]); setNotifications([]); setError("");
          Alert.alert("Account deleted", "Your account has been removed.");
          router.replace("/login");
        } catch (err: any) {
          Alert.alert("Error", err?.response?.data?.message || "Failed to delete account.");
        } finally { setDeletingAccount(false); }
      }},
    ]);
  };

  const unreadCount = useMemo(() => notifications.filter((n) => n.is_read === "No" || n.is_read === 0 || n.is_read === false).length, [notifications]);
  const inquiryUnreadCount = useMemo(() => inquiries.filter((i) => Number(i.unread_from_admin) > 0).length, [inquiries]);

  const markNotificationRead = (notificationId: number | string) => {
    const idStr = String(notificationId);
    if (!idStr || idStr === "0" || idStr === "NaN") return;
    setNotifications((prev) => prev.map((n) => String(n.notification_id) === idStr ? { ...n, is_read: "Yes" } : n));
  };

  const markInquiryRead = (inquiryId: number | string) => {
    const idStr = String(inquiryId);
    if (!idStr || idStr === "0" || idStr === "NaN") return;
    setInquiries((prev) => prev.map((t) => String(t.inquiry_id ?? t.id) === idStr ? { ...t, unread_from_admin: 0 } : t));
  };

  const openConversation = (conv: { threadType: "inquiry" | "application"; threadId: number; title: string; subtitle?: string }, opts?: { notificationId?: number | string }) => {
    if (opts?.notificationId != null) markNotificationRead(opts.notificationId);
    if (conv.threadType === "inquiry") markInquiryRead(conv.threadId);
    setConversation(conv);
  };

  const openConversationFromNotification = (note: any) => {
    const refType = note.reference_type;
    const refId = note.reference_id;
    const notificationId = note.notification_id;
    if (refType === "inquiry" && refId) { openConversation({ threadType: "inquiry", threadId: Number(refId), title: note.title || "Inquiry conversation" }, { notificationId }); return; }
    if (refType === "application" && refId) { openConversation({ threadType: "application", threadId: Number(refId), title: note.title || "Application messages" }, { notificationId }); return; }
    const title = String(note.title || "").toLowerCase();
    if (title.includes("inquiry")) {
      if (inquiries.length > 0) {
        const latest = inquiries[0];
        const threadId = latest.inquiry_id ?? latest.id;
        openConversation({ threadType: "inquiry", threadId: Number(threadId), title: "Inquiry conversation", subtitle: latest.location }, { notificationId });
      } else { if (notificationId != null) markNotificationRead(notificationId); setActiveSection("inquiries"); }
    }
  };

  const displayName = loggedUser?.username || loggedUser?.name || rememberedUsername || "Guest";
  const displayEmail = loggedUser?.email || "";
  const displayPhone = loggedUser?.phone || "";
  const displayRole = loggedUser?.role || "tenant";

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loaderText}>Loading profile…</Text>
      </View>
    );
  }

  // ── Section renderers ────────────────────────────────────────────────────────
  const renderApplications = () => {
    if (loadingApplications) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (applicationsError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{applicationsError}</Text></View>;
    if (applications.length === 0) return <EmptyCard title="No applications yet" text="When you apply for a house, it will appear here." />;
    return (
      <View style={styles.cardsWrap}>
        {applications.map((app) => {
          const imageUrl = getFirstImage(app.images || app.image_url);
          return (
            <TouchableOpacity key={app.application_id} style={styles.propertyCard} activeOpacity={0.88}
              onPress={() => { if (app.property_id) router.push({ pathname: "/house-details", params: { id: String(app.property_id), hideActions: "true" } }); }}>
              {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.propertyImage} />}
              <View style={styles.propertyBody}>
                <View style={styles.propertyTopRow}>
                  <Text style={styles.propertyTitle}>{app.property_type || app.title || "House"}</Text>
                  <View style={[styles.statusChip, { backgroundColor: app.status === "Accepted" ? C.greenLight : app.status === "Rejected" ? C.dangerLight : C.goldLight }]}>
                    <Text style={[styles.statusChipText, { color: app.status === "Accepted" ? C.green : app.status === "Rejected" ? C.danger : C.gold }]}>{app.status || "Pending"}</Text>
                  </View>
                </View>
                <Text style={styles.propertySub}><Ionicons name="location-outline" size={12} color={C.muted} /> {app.location || app.address || "Unknown location"}</Text>
                <Text style={styles.propertyPrice}>
                  {String(app.listing_type || "").toLowerCase() === "sale" ? `KES ${Number(app.sale_price || 0).toLocaleString()}` : `KES ${Number(app.monthly_rent || 0).toLocaleString()}/mo`}
                </Text>
                <TouchableOpacity style={styles.messageBtn}
                  onPress={() => setConversation({ threadType: "application", threadId: app.application_id, title: app.title || app.property_type || "Application", subtitle: "Message the landlord" })}>
                  <Ionicons name="chatbubble-outline" size={14} color={C.white} />
                  <Text style={styles.messageBtnText}>Message landlord</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderSaved = () => {
    if (loadingSaved) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (savedError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{savedError}</Text></View>;
    if (savedHouses.length === 0) return <EmptyCard title="No saved houses" text="Homes you save will appear here." />;
    return (
      <View style={styles.cardsWrap}>
        {savedHouses.map((house) => {
          const imageUrl = house.first_image || getFirstImage(house.images || house.image_url);
          return (
            <TouchableOpacity key={house.saved_id || house.property_id} style={styles.propertyCard} activeOpacity={0.88}
              onPress={() => router.push({ pathname: "/house-details", params: { id: String(house.property_id) } })}>
              {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.propertyImage} />}
              <View style={styles.propertyBody}>
                <View style={styles.propertyTopRow}>
                  <Text style={styles.propertyTitle}>{house.property_type || house.title || "House"}</Text>
                  <View style={[styles.statusChip, { backgroundColor: C.soft }]}>
                    <Text style={[styles.statusChipText, { color: C.subtext }]}>{house.availability_status || "Unknown"}</Text>
                  </View>
                </View>
                <Text style={styles.propertySub}><Ionicons name="location-outline" size={12} color={C.muted} /> {house.location || house.address || "Unknown location"}</Text>
                <Text style={styles.propertyPrice}>
                  {String(house.listing_type || "").toLowerCase() === "sale" ? `KES ${Number(house.sale_price || 0).toLocaleString()}` : `KES ${Number(house.monthly_rent || 0).toLocaleString()}/mo`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderInquiries = () => {
    if (loadingInquiries) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (inquiriesError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{inquiriesError}</Text></View>;
    if (inquiries.length === 0) return <EmptyCard title="No inquiries yet" text="Submit an inquiry from the More menu to get matched with properties." />;
    return (
      <View style={styles.cardsWrap}>
        {inquiries.map((inq) => {
          const id = inq.inquiry_id ?? inq.id;
          const hasReply = Number(inq.unread_from_admin) > 0;
          return (
            <TouchableOpacity key={id} style={[styles.notifCard, hasReply && styles.notifCardUnread]} activeOpacity={0.86}
              onPress={() => openConversation({ threadType: "inquiry", threadId: Number(id), title: inq.house_type || "House inquiry", subtitle: inq.location })}>
              <View style={styles.notifRow}>
                <Text style={styles.notifTitle} numberOfLines={1}>{inq.house_type || "Inquiry"} · {inq.location || "Location"}</Text>
                {hasReply && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifBody} numberOfLines={2}>{inq.last_message || inq.notes || "Tap to view conversation with admin"}</Text>
              <Text style={styles.notifDate}>{formatDate(inq.created_at)}{hasReply ? " · New reply" : ""}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderNotifications = () => {
    if (loadingNotifications) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (notificationsError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{notificationsError}</Text></View>;
    if (notifications.length === 0) return <EmptyCard title="No notifications" text="Updates about your saved houses and applications will show here." />;
    return (
      <View style={styles.cardsWrap}>
        {notifications.map((note) => {
          const expanded = expandedNotificationId === note.notification_id;
          const unread = note.is_read === "No" || note.is_read === 0 || note.is_read === false;
          return (
            <TouchableOpacity key={note.notification_id} style={[styles.notifCard, unread && styles.notifCardUnread]} activeOpacity={0.86}
              onPress={() => {
                const isInquiry = note.reference_type === "inquiry" || String(note.title || "").toLowerCase().includes("inquiry");
                const isApp = note.reference_type === "application" || String(note.title || "").toLowerCase().includes("message about");
                if (isInquiry || isApp) { openConversationFromNotification(note); return; }
                if (note.notification_id != null) markNotificationRead(note.notification_id);
                setExpandedNotificationId(expanded ? null : note.notification_id);
              }}>
              <View style={styles.notifRow}>
                <Text style={styles.notifTitle} numberOfLines={1}>{note.title || "Notification"}</Text>
                {unread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifBody} numberOfLines={expanded ? undefined : 2}>{note.message}</Text>
              <View style={styles.notifFooter}>
                <Text style={styles.notifDate}>{formatDate(note.created_at) || "No date"}</Text>
                <Text style={styles.readMoreText}>{expanded ? "Show less" : "Read more"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  /* const renderMaintenance = () => {
    if (loadingMaintenance) return <View style={styles.loaderSection}><ActivityIndicator color={C.accent} /></View>;
    if (maintenanceError) return <View style={styles.infoBox}><Text style={styles.infoBoxText}>{maintenanceError}</Text></View>;

    return (
      <View style={styles.cardsWrap}>
        { // Quick Report Issue Action Card }
        <TouchableOpacity
          style={styles.reportActionCard}
          onPress={() => {
            if (!loggedUser) {
              router.push("/login");
              return;
            }
            if (myLease) {
              setMaintUnitCode(myLease.unit_code);
              setMaintBuildingName(myLease.building_name || "");
            }
            setShowReportModal(true);
          }}
          activeOpacity={0.88}
        >
          <View style={styles.reportActionIconWrap}>
            <Ionicons name="construct" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportActionTitle}>+ Report Maintenance Request</Text>
            <Text style={styles.reportActionSub}>
              {myLease ? `Report repair issue for Unit ${myLease.unit_code}` : "Send repair request & message to your landlord"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </TouchableOpacity>

        {maintenanceRequests.length === 0 ? (
          <EmptyCard
            title="No maintenance requests"
            text="Have a repair issue with plumbing, power, water, or locks? Tap '+ Report Maintenance Request' above to alert your landlord."
          />
        ) : (
          maintenanceRequests.map((req) => {
            const isResolved = req.status === "Resolved";
            const isInProgress = req.status === "In Progress";
            const reqImages = parseMaintenanceImages(req.images);

            return (
              <View key={req.request_id} style={styles.maintTenantCard}>
                <View style={styles.maintTenantTop}>
                  <View style={styles.unitBadgeSmall}>
                    <Text style={styles.unitBadgeSmallText}>{req.unit_code || myLease?.unit_code || "Unit"}</Text>
                  </View>

                  <View style={[
                    styles.statusChip,
                    isResolved ? { backgroundColor: C.greenLight } : isInProgress ? { backgroundColor: C.blueLight } : { backgroundColor: C.amberLight }
                  ]}>
                    <Text style={[
                      styles.statusChipText,
                      isResolved ? { color: C.green } : isInProgress ? { color: C.blue } : { color: C.amber }
                    ]}>
                      {isResolved ? "🟢 Solved" : isInProgress ? "🔵 In Progress" : "🟡 Pending"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.maintTenantTitle}>{req.title}</Text>
                <Text style={styles.maintTenantDesc}>{req.description}</Text>

                { // Attached Photos }
                {reqImages.length > 0 && (
                  <View style={styles.maintCardPhotosWrap}>
                    <Text style={styles.maintCardPhotosLabel}>
                      📷 Attached Photos ({reqImages.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.maintCardPhotosScroll}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {reqImages.map((imgUri, idx) => {
                          const fullUrl = getMaintenanceImageUrl(imgUri);
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={styles.maintCardPhotoThumbWrap}
                              onPress={() => setViewingImageUrl(fullUrl)}
                              activeOpacity={0.85}
                            >
                              <Image source={{ uri: fullUrl }} style={styles.maintCardPhotoThumb} resizeMode="cover" />
                              <View style={styles.maintCardPhotoZoomBadge}>
                                <Ionicons name="expand" size={10} color="#fff" />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                { // Landlord Response (if any) }
                {!!req.landlord_reply && (
                  <View style={styles.landlordReplyWrap}>
                    <Ionicons name="chatbox-ellipses-outline" size={14} color={C.primary} />
                    <Text style={styles.landlordReplyContent}>
                      <Text style={{ fontWeight: "700" }}>Landlord update: </Text>
                      {req.landlord_reply}
                    </Text>
                  </View>
                )}

                <View style={styles.maintTenantMetaRow}>
                  <Text style={styles.maintTenantDate}>
                    Reported: {formatDate(req.created_at)}
                    {req.resolved_at ? ` · Solved: ${formatDate(req.resolved_at)}` : ""}
                  </Text>
                  {Number(req.cost) > 0 && (
                    <Text style={styles.maintTenantCost}>
                      Cost: KES {Number(req.cost).toLocaleString()}
                    </Text>
                  )}
                </View>

                { // Landlord Chat Action }
                <TouchableOpacity
                  style={styles.messageLandlordBtn}
                  onPress={() => handleOpenLandlordChat(req)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
                  <Text style={styles.messageLandlordBtnText}>Message Landlord</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    );
  }; */

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} tintColor={C.accent} />}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { if (!loggedUser) { router.push("/login"); return; } setEditProfileVisible(true); }} style={styles.nameRow}>
            <Text style={styles.headerName}>{displayName}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.subtext} />
          </TouchableOpacity>
          <Text style={styles.headerEmail}>{displayEmail || (loggedUser ? "Your account" : "Sign in to continue")}</Text>
        </View>
      </View>

      {!!error && <View style={styles.infoBox}><Text style={styles.infoBoxText}>{error}</Text></View>}

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <StatPill icon="document-text-outline" value={applications.length} label="Applications" color={C.blue} />
        <View style={styles.statDivider} />
        <StatPill icon="heart-outline" value={savedHouses.length} label="Saved" color={C.accent} />
        <View style={styles.statDivider} />
        <StatPill icon="chatbubbles-outline" value={inquiryUnreadCount || inquiries.length} label="Inquiries" color={C.green} />
        <View style={styles.statDivider} />
      </View>

      {/* ── Premium card ── */}
      <PremiumCard isPremium={isPremium} onPress={() => { if (!loggedUser) { router.push("/login"); return; } setSubscriptionVisible(true); }} />

      {/* ── Menu group ── */}
      <View style={styles.menuGroup}>
        <MenuRow icon="person-circle-outline" iconColor={C.blue} iconBg={C.blueLight} title="Personal information"
          subtitle={loggedUser ? `${displayName}${displayPhone ? ` · ${displayPhone}` : ""}` : "View and update your details"}
          onPress={() => { if (!loggedUser) { router.push("/login"); return; } setEditProfileVisible(true); }} />
        <MenuRow icon="document-text-outline" iconColor={C.purple} iconBg={C.purpleLight} title="Applications" subtitle="Track houses you have applied for"
          badge={applications.length} onPress={() => setActiveSection("applications")} />
        <MenuRow icon="heart-outline" iconColor={C.accent} iconBg={C.accentLight} title="Saved houses" subtitle="View the homes you saved"
          badge={savedHouses.length} onPress={() => setActiveSection("saved")} />
        <MenuRow icon="chatbubbles-outline" iconColor={C.green} iconBg={C.greenLight} title="My inquiries" subtitle="Chat with admin about your house search"
          badge={inquiryUnreadCount || inquiries.length} onPress={() => setActiveSection("inquiries")} />
        <MenuRow icon="document-text-outline" iconColor={C.green} iconBg={C.greenLight} title="My Tenancy Lease"
          subtitle={myLease ? `${myLease.title} · ${myLease.status === "active" ? "🟢 Active & Signed" : "🟡 Pending Signature"}` : "View or e-sign your unit lease agreement"}
          badge={myLease && myLease.status !== "active" ? "Sign" : undefined}
          onPress={() => {
            if (!loggedUser) {
              router.push("/login");
              return;
            }
            if (!myLease) {
              Alert.alert(
                "No Active Lease",
                "Your landlord has not yet generated a digital lease agreement for your unit. Please contact your landlord."
              );
              return;
            }
            setLeaseModalVisible(true);
          }}
        />
        <MenuRow
          icon="card-outline"
          iconColor={C.purple}
          iconBg={C.purpleLight}
          title="Subscription & Plan"
          subtitle={isPremium ? "Premium Active · Manage or cancel" : "Upgrade to Tenant Premium"}
          badge={isPremium ? "Active" : undefined}
          onPress={() => {
            if (!loggedUser) {
              router.push("/login");
              return;
            }
            setSubscriptionVisible(true);
          }}
        />
        <MenuRow icon="shield-checkmark-outline" iconColor={C.subtext} iconBg={C.soft} title="Login & security"
          subtitle={loggedUser ? "You are signed in" : "Manage sign in and account access"}
          onPress={() => router.push("/login")} isLast />
      </View>

      {/* ── Active section ── */}
      <SectionHeader title={
        activeSection === "applications" ? "Applications" :
        activeSection === "saved" ? "Saved houses" :
        activeSection === "inquiries" ? "My inquiries" :
        "Notifications"
      } />

      {activeSection === "applications" && renderApplications()}
      {activeSection === "saved" && renderSaved()}
      {activeSection === "inquiries" && renderInquiries()}
      {activeSection === "notifications" && renderNotifications()}

      {/* ── Modals ── */}
      {conversation && loggedUser?.user_id && (
        <ConversationModal visible={!!conversation} onClose={() => setConversation(null)}
          onOpened={() => { if (conversation.threadType === "inquiry") markInquiryRead(conversation.threadId); }}
          threadType={conversation.threadType} threadId={conversation.threadId} userId={loggedUser.user_id}
          senderRole={conversation.threadType === "inquiry" ? "user" : "tenant"} title={conversation.title} subtitle={conversation.subtitle} />
      )}
      <SubscriptionModal visible={subscriptionVisible} context="tenant_premium" onClose={() => setSubscriptionVisible(false)}
        onLater={() => setSubscriptionVisible(false)} onSubscribed={() => { refreshSubscription(); }} />
      {editProfileVisible && loggedUser && (
        <EditProfileModal
          visible={editProfileVisible}
          onClose={() => setEditProfileVisible(false)}
          user={loggedUser}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
      {leaseModalVisible && myLease && (
        <LeaseAgreementModal
          visible={leaseModalVisible}
          onClose={() => setLeaseModalVisible(false)}
          unit={{
            unit_id: myLease.unit_id,
            unit_code: myLease.unit_code,
            monthly_rent: myLease.monthly_rent,
            deposit_amount: myLease.deposit_amount,
            tenant_name: myLease.tenant_name,
            tenant_phone: myLease.tenant_phone,
            tenant_email: myLease.tenant_email,
            lease_start: myLease.lease_start_date,
            lease_end: myLease.lease_end_date,
            rent_due_day: myLease.rent_due_day,
          }}
          building={{
            building_id: myLease.building_id,
            building_name: myLease.building_name,
            address: myLease.building_address,
            location: myLease.building_location,
          }}
          landlord={{
            user_id: myLease.landlord_id,
            name: myLease.landlord_name,
            phone: myLease.landlord_phone,
            email: myLease.landlord_email,
          }}
          initialLease={myLease}
          viewerRole="tenant"
          onLeaseUpdated={(updated) => {
            setMyLease(updated);
          }}
        />
      )}

      {/* 💬 In-App Direct Message Modal with Landlord */}
      {dmLandlord && loggedUser?.user_id && (
        <DirectMessageModal
          visible={!!dmLandlord}
          onClose={() => setDmLandlord(null)}
          participant={dmLandlord}
          currentUserId={loggedUser.user_id}
        />
      )}

      {/* {showReportModal && (
        <Modal
          visible={showReportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.reportModalOverlay}>
            <View style={styles.reportModalCard}>
              <View style={styles.reportModalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="construct" size={20} color={C.primary} />
                  <Text style={styles.reportModalTitle}>Report Maintenance</Text>
                </View>
                <TouchableOpacity onPress={() => setShowReportModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                {myLease ? (
                  <View style={styles.leaseUnitInfoBadge}>
                    <Ionicons name="home" size={14} color={C.primary} />
                    <Text style={styles.leaseUnitInfoText}>
                      Unit {myLease.unit_code} · {myLease.building_name || "Building"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.modalLabel}>Unit / House Number *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. Unit 3B, Door 12"
                      placeholderTextColor={C.muted}
                      value={maintUnitCode}
                      onChangeText={setMaintUnitCode}
                    />
                  </>
                )}

                <Text style={styles.modalLabel}>Issue Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(["Plumbing", "Electrical", "Water Supply", "Carpentry & Locks", "Appliance", "Painting & Walls", "Roofing & Leakage", "Other"] as MaintenanceCategory[]).map((cat) => {
                      const isSel = maintCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.catPill, isSel && styles.catPillActive]}
                          onPress={() => setMaintCategory(cat)}
                        >
                          <Text style={[styles.catPillText, isSel && { color: "#fff", fontWeight: "700" }]}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text style={styles.modalLabel}>Priority Level</Text>
                <View style={styles.priorityRow}>
                  {(["Urgent", "Medium", "Low"] as MaintenancePriority[]).map((pri) => {
                    const isSel = maintPriority === pri;
                    return (
                      <TouchableOpacity
                        key={pri}
                        style={[styles.priorityPill, isSel && styles.priorityPillActive]}
                        onPress={() => setMaintPriority(pri)}
                      >
                        <Text style={[styles.priorityPillText, isSel && { color: "#fff", fontWeight: "700" }]}>{pri}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.modalLabel}>Issue Title / Short Summary *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Kitchen tap leaking water continuously"
                  placeholderTextColor={C.muted}
                  value={maintTitle}
                  onChangeText={setMaintTitle}
                />

                <Text style={styles.modalLabel}>Message for Landlord (What needs fixing) *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 90, textAlignVertical: "top" }]}
                  placeholder="Describe the issue in detail so your landlord knows what action to take..."
                  placeholderTextColor={C.muted}
                  multiline
                  value={maintMessage}
                  onChangeText={setMaintMessage}
                />

                { // Attach Photos Section }
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={styles.modalLabel}>Attach Photos (Optional)</Text>
                    <Text style={{ fontSize: 12, color: C.muted, fontWeight: "600" }}>
                      {maintImages.length}/5 photos
                    </Text>
                  </View>

                  <View style={styles.photoPickerBtnsRow}>
                    <TouchableOpacity
                      style={styles.photoPickerBtn}
                      onPress={pickMaintImages}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images-outline" size={18} color={C.primary} />
                      <Text style={styles.photoPickerBtnText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.photoPickerBtn}
                      onPress={takeMaintPhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera-outline" size={18} color={C.primary} />
                      <Text style={styles.photoPickerBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>

                  {maintImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                        {maintImages.map((uri, idx) => (
                          <View key={idx} style={styles.maintFormThumbWrap}>
                            <Image source={{ uri }} style={styles.maintFormThumb} />
                            <TouchableOpacity
                              style={styles.maintFormThumbRemove}
                              onPress={() => removeMaintImage(idx)}
                              hitSlop={8}
                            >
                              <Ionicons name="close-circle" size={22} color={C.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>

                <View style={styles.modalSubmitRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      setShowReportModal(false);
                      setMaintImages([]);
                    }}
                    disabled={submittingMaint}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleReportMaintenanceSubmit}
                    disabled={submittingMaint}
                  >
                    {submittingMaint ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalConfirmBtnText}>Submit Request 📨</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )} */}

      {/* {viewingImageUrl && (
        <Modal
          visible={!!viewingImageUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setViewingImageUrl(null)}
        >
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerCloseBtn}
              onPress={() => setViewingImageUrl(null)}
              hitSlop={15}
            >
              <Ionicons name="close-circle" size={36} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: viewingImageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )} */}

      {/* ── Footer actions ── */}
      <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={C.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.deleteBtn, deletingAccount && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handleDeleteAccount} disabled={deletingAccount}>
        {deletingAccount ? <ActivityIndicator size="small" color={C.danger} /> : <Text style={styles.deleteBtnText}>Delete account</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default Tenantdashboard;

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
  statValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: "600" },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },

  // ── Premium card
  premiumCard: {
    backgroundColor: C.white, borderRadius: 18, borderWidth: 1.5, borderColor: "#FDE68A",
    marginBottom: 20, overflow: "hidden",
    shadowColor: "#D97706", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  premiumCardInner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  premiumIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldLight, alignItems: "center", justifyContent: "center" },
  premiumTitle: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 3 },
  premiumSub: { fontSize: 12, color: C.subtext, lineHeight: 17 },
  premiumBadge: { backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  premiumBadgeText: { color: C.white, fontSize: 12, fontWeight: "800" },

  // ── Menu
  menuGroup: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, marginBottom: 28, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuTextWrap: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: "600", color: C.text },
  menuSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badgePill: { backgroundColor: C.accent, borderRadius: 20, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: C.white, fontSize: 11, fontWeight: "800" },

  // ── Section header
  sectionHeader: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 14, letterSpacing: -0.3 },

  // ── Empty card
  emptyCard: { backgroundColor: C.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 21, color: C.subtext },

  // ── Property card
  cardsWrap: { gap: 14 },
  propertyCard: { backgroundColor: C.white, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  propertyImage: { width: "100%", height: 180, backgroundColor: "#EFEFEF" },
  propertyBody: { padding: 14 },
  propertyTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  propertyTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text, paddingRight: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  propertySub: { fontSize: 13, color: C.subtext, marginBottom: 6 },
  propertyPrice: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 12 },
  propertyMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.text, borderRadius: 12, paddingVertical: 11 },
  messageBtnText: { color: C.white, fontSize: 13, fontWeight: "700" },

  // ── Notification / inquiry card
  notifCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: C.accent },
  notifRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  notifTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: C.text, paddingRight: 8 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
  notifBody: { fontSize: 14, lineHeight: 20, color: C.subtext },
  notifFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  notifDate: { fontSize: 12, color: C.muted, fontWeight: "600" },
  readMoreText: { fontSize: 12, color: C.text, fontWeight: "700" },

  // ── Info box
  infoBox: { backgroundColor: C.accentLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.accentBorder },
  infoBoxText: { color: C.danger, fontSize: 14, fontWeight: "600" },

  // ── Footer
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: C.accentBorder, backgroundColor: C.accentLight, paddingVertical: 15 },
  logoutText: { color: C.danger, fontSize: 15, fontWeight: "700" },
  deleteBtn: { marginBottom: 20, borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", backgroundColor: C.dangerLight, alignItems: "center", justifyContent: "center", paddingVertical: 15 },
  deleteBtnText: { color: C.danger, fontSize: 15, fontWeight: "800" },

  // ── Maintenance Report Action
  reportActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#FFD0B5",
    gap: 12,
    shadowColor: C.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reportActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reportActionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.text,
    marginBottom: 2,
  },
  reportActionSub: {
    fontSize: 12,
    color: C.subtext,
  },

  // ── Tenant Maintenance Card
  maintTenantCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  maintTenantTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  unitBadgeSmall: {
    backgroundColor: C.soft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  unitBadgeSmallText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.text,
  },
  maintTenantTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.text,
    marginBottom: 4,
  },
  maintTenantDesc: {
    fontSize: 13,
    color: C.subtext,
    lineHeight: 18,
    marginBottom: 10,
  },
  landlordReplyWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: C.primaryLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FFD0B5",
  },
  landlordReplyContent: {
    flex: 1,
    fontSize: 12,
    color: C.text,
    lineHeight: 17,
  },
  maintTenantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginBottom: 10,
  },
  maintTenantDate: {
    fontSize: 11,
    color: C.muted,
    fontWeight: "600",
  },
  maintTenantCost: {
    fontSize: 11,
    fontWeight: "800",
    color: C.primary,
  },
  messageLandlordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  messageLandlordBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Report Modal
  reportModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  reportModalCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
  },
  reportModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  reportModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
  },
  leaseUnitInfoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FFD0B5",
  },
  leaseUnitInfoText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primary,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.text,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    marginBottom: 14,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
  },
  catPillActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.text,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.soft,
  },
  priorityPillActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  priorityPillText: {
    fontSize: 12,
    color: C.subtext,
    fontWeight: "600",
  },
  modalSubmitRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.soft,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.subtext,
  },
  modalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: "center",
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Photo Picker & Form Previews
  photoPickerBtnsRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoPickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFD0B5",
  },
  photoPickerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primary,
  },
  maintFormThumbWrap: {
    position: "relative",
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: "visible",
  },
  maintFormThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: C.border,
  },
  maintFormThumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
  },

  // ── Maintenance Card Attached Photos Strip
  maintCardPhotosWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  maintCardPhotosLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.text,
    marginBottom: 6,
  },
  maintCardPhotosScroll: {
    flexDirection: "row",
  },
  maintCardPhotoThumbWrap: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: C.border,
  },
  maintCardPhotoThumb: {
    width: 80,
    height: 80,
  },
  maintCardPhotoZoomBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 3,
    borderRadius: 4,
  },

  // ── Fullscreen Image Viewer Modal
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  imageViewerImage: {
    width: "92%",
    height: "75%",
  },
});