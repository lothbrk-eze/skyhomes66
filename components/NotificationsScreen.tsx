import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../lib/api";
import ConversationModal from "./ConversationModal";
import { useSubscription } from "../hooks/useSubscription";
import { getMessagingLimit } from "../lib/subscriptionUtils";
import { useAuth } from "../contexts/AuthContext";

const COLORS = {
  bg: "#EFF6FF",
  white: "#FFFFFF",
  text: "#0F172A",
  subtext: "#4B6CB7",
  border: "#DBEAFE",
  chip: "#DBEAFE",
  dot: "#FF4D4F",
  accent: "#2563EB",
};

type InquiryPreference = {
  user_id: string | null;
  houseType: string;
  roadProximity: string;
  location: string;
  budget: string;
  notes: string;
  selectedUtilities: string[];
  createdAt: string;
};

type House = {
  property_id?: number | string;
  title?: string;
  property_type?: string;
  listing_type?: string;
  address?: string;
  location?: string;
  description?: string;
  monthly_rent?: number | string;
  sale_price?: number | string;
  created_at?: string;
  is_read?: string | number | boolean;
};

type FilterType = "all" | "transactions" | "general" | "market";
type ScreenTab = "alerts" | "messages";

type ConversationState = {
  threadType: "inquiry" | "application" | "direct";
  threadId: number;
  title: string;
  subtitle?: string;
  senderRole: "admin" | "user" | "landlord" | "tenant";
  otherParticipantId?: number;
};

const getInitials = (name: string) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const formatDateLabel = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
};

const isNotificationUnread = (note: any) => {
  const v = note?.is_read;
  return v === "No" || v === "no" || v === false || v === 0 || v === "0";
};

const isInquiryUnread = (inq: any) => Number(inq?.unread_from_admin) > 0;

export default function NotificationsScreen() {
  const { isPremium } = useSubscription();
  const {
    isLoggedIn: authIsLoggedIn,
    userId: authUserId,
    role: authRole,
    username: authUsername,
    email: authEmail,
  } = useAuth();
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [screenTab, setScreenTab] = useState<ScreenTab>("alerts");
  const [filter, setFilter] = useState<FilterType>("all");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inquiryPreference, setInquiryPreference] = useState<InquiryPreference | null>(null);
  const [suggestedHouses, setSuggestedHouses] = useState<House[]>([]);
  const [landlordApplications, setLandlordApplications] = useState<any[]>([]);
  const [inquiryThreads, setInquiryThreads] = useState<any[]>([]);
  const [applicationThreads, setApplicationThreads] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expandedNotificationId, setExpandedNotificationId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Landlord list modal state ──────────────────────────────────────────
  const [showLandlordList, setShowLandlordList] = useState(false);
  const [landlords, setLandlords] = useState<any[]>([]);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [directMessageCount, setDirectMessageCount] = useState(0);

  const closeLandlordSheet = useCallback(() => {
    setShowLandlordList(false);
    setLandlordSearch("");
  }, []);

  // ─── Delete a single notification ────────────────────────────────────────
  const deleteNotification = useCallback(
    (notificationId: number | string) => {
      Alert.alert("Delete notification", "Remove this notification? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const idStr = String(notificationId);
            setDeletingId(idStr);
            setNotifications((prev) =>
              prev.filter((n) => String(n.notification_id) !== idStr)
            );
            try {
              await axios.delete(`${API_URL}/api/notifications/${idStr}`);
            } catch {
              // silent
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    []
  );

  // ─── Delete a message thread (inquiry or application) ──────────────────
  const deleteThread = useCallback(
    (threadType: "inquiry" | "application", threadId: number | string) => {
      const label = threadType === "inquiry" ? "inquiry" : "application thread";
      Alert.alert(`Delete ${label}`, `Remove this ${label}? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const idStr = String(threadId);
            setDeletingId(idStr);
            if (threadType === "inquiry") {
              setInquiryThreads((prev) =>
                prev.filter((t) => String(t.inquiry_id ?? t.id) !== idStr)
              );
              try {
                await axios.delete(`${API_URL}/api/inquiries/${idStr}`);
              } catch {}
            } else {
              setApplicationThreads((prev) =>
                prev.filter((a) => String(a.application_id) !== idStr)
              );
              try {
                await axios.delete(`${API_URL}/api/applications/${idStr}`);
              } catch {}
            }
            setDeletingId(null);
          },
        },
      ]);
    },
    []
  );

  const clearNotificationState = useCallback(() => {
    setNotifications([]);
    setSuggestedHouses([]);
    setLandlordApplications([]);
    setInquiryThreads([]);
    setApplicationThreads([]);
    setInquiryPreference(null);
    setError("");
    setMessagesError("");
  }, []);

  const markNotificationRead = useCallback((notificationId: number | string) => {
    const idStr = String(notificationId);
    if (!idStr || idStr === "0" || idStr === "NaN") return;
    setNotifications((prev) =>
      prev.map((n) =>
        String(n.notification_id) === idStr ? { ...n, is_read: "Yes" } : n
      )
    );
  }, []);

  const markNotificationsForThread = useCallback(
    (threadType: "inquiry" | "application" | "direct", threadId: number | string) => {
      const idStr = String(threadId);
      if (!idStr || idStr === "0" || idStr === "NaN") return;
      setNotifications((prev) =>
        prev.map((n) => {
          const refMatch =
            String(n.reference_type) === threadType && String(n.reference_id) === idStr;
          if (refMatch) return { ...n, is_read: "Yes" };
          return n;
        })
      );
    },
    []
  );

  const markInquiryRead = useCallback((inquiryId: number | string) => {
    const idStr = String(inquiryId);
    if (!idStr || idStr === "0" || idStr === "NaN") return;
    setInquiryThreads((prev) =>
      prev.map((t) =>
        String(t.inquiry_id ?? t.id) === idStr ? { ...t, unread_from_admin: 0 } : t
      )
    );
  }, []);

  const openConversation = useCallback(
    (conv: ConversationState, opts?: { notificationId?: number | string }) => {
      if (opts?.notificationId != null) {
        markNotificationRead(opts.notificationId);
      }
      if (conv.threadType === "inquiry") {
        markInquiryRead(conv.threadId);
        markNotificationsForThread("inquiry", conv.threadId);
      } else if (conv.threadType === "application") {
        markNotificationsForThread("application", conv.threadId);
      } else if (conv.threadType === "direct") {
        markNotificationsForThread("direct", conv.threadId);
      }
      setConversation(conv);
    },
    [markInquiryRead, markNotificationRead, markNotificationsForThread]
  );

  // ─── Fetch landlord list ────────────────────────────────────────────────
  const fetchLandlords = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/landlords_list`);
      setLandlords(res.data.landlords || []);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Could not load landlord list.");
    }
  }, []);

  // ─── Start direct chat with a landlord ─────────────────────────────────
  const startDirectChat = useCallback(
    async (landlord: any) => {
      if (!loggedUser) return;

      // Check messaging limits for tenants
      if (loggedUser.role === "tenant") {
        const limit = getMessagingLimit("tenant", isPremium);
        if (directMessageCount >= limit && !isPremium) {
          Alert.alert(
            "Limit Reached",
            `You can message up to ${limit} landlords on the free plan. Upgrade to Premium for unlimited messaging.`
          );
          return;
        }
      }

      try {
        const fd = new FormData();
        fd.append("tenant_id", loggedUser.user_id);
        fd.append("landlord_id", landlord.user_id);
        const res = await axios.post(`${API_URL}/api/direct/start`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const conversationId = res.data.conversation_id;
        closeLandlordSheet();
        setConversation({
          threadType: "direct",
          threadId: conversationId,
          title: landlord.username,
          subtitle: `${landlord.landlord_location || ""} · ${landlord.landlord_house_type || ""}`,
          senderRole: "tenant",
          otherParticipantId: landlord.user_id,
        });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err: any) {
        Alert.alert("Error", "Could not start conversation.");
      }
    },
    [loggedUser, closeLandlordSheet, directMessageCount, isPremium]
  );

  // ── User normalisation & data loading ──────────────────────────────────
  const normalizeStoredUser = useCallback(async () => {
    let isLoggedIn = await AsyncStorage.getItem("isLoggedIn");
    const storedUser = await AsyncStorage.getItem("user");
    const storedUsername = await AsyncStorage.getItem("username");
    const storedRole = await AsyncStorage.getItem("role");
    const storedEmail = await AsyncStorage.getItem("email");
    const storedPhone = await AsyncStorage.getItem("phone");
    const storedUserId = await AsyncStorage.getItem("user_id");

    let parsed: any = null;
    if (storedUser) {
      try {
        parsed = JSON.parse(storedUser);
      } catch {
        parsed = null;
      }
    }
    const rawUser = parsed?.user ? parsed.user : parsed;

    const resolvedUserId =
      rawUser?.user_id ||
      rawUser?.id ||
      parsed?.user_id ||
      parsed?.id ||
      storedUserId ||
      authUserId ||
      null;

    const hasSession =
      authIsLoggedIn ||
      isLoggedIn === "true" ||
      !!resolvedUserId ||
      !!storedUser ||
      !!storedUsername;

    if (!hasSession || !resolvedUserId) {
      return null;
    }

    if (isLoggedIn !== "true") {
      await AsyncStorage.setItem("isLoggedIn", "true");
    }

    const normalizedUser = {
      ...(rawUser || {}),
      user_id: resolvedUserId,
      username:
        rawUser?.username ||
        rawUser?.name ||
        parsed?.username ||
        storedUsername ||
        authUsername ||
        "",
      name:
        rawUser?.name ||
        rawUser?.username ||
        parsed?.name ||
        storedUsername ||
        authUsername ||
        "",
      role: String(
        rawUser?.role || parsed?.role || storedRole || authRole || ""
      ).toLowerCase(),
      email: rawUser?.email || parsed?.email || storedEmail || authEmail || "",
      phone: rawUser?.phone || parsed?.phone || storedPhone || "",
    };

    return normalizedUser;
  }, [authIsLoggedIn, authUserId, authRole, authUsername, authEmail]);

  const loadInquiryPreference = useCallback(async (user: any) => {
    try {
      const raw = await AsyncStorage.getItem("latest_inquiry_preference");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as InquiryPreference;
      if (!parsed?.user_id || !user?.user_id) return null;
      if (String(parsed.user_id) !== String(user.user_id)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const filterSuggestedHouses = useCallback((allHouses: House[], pref: InquiryPreference) => {
    const budgetValue = Number(pref.budget);
    const locationNeedle = pref.location.toLowerCase().trim();
    const typeNeedle = pref.houseType.toLowerCase().trim();
    const notesNeedle = pref.notes.toLowerCase().trim();
    const roadNeedle = pref.roadProximity.toLowerCase().trim();

    return allHouses
      .map((house) => {
        const location = String(house.address || house.location || "").toLowerCase();
        const type = String(house.property_type || house.title || "").toLowerCase();
        const description = String(house.description || "").toLowerCase();
        const isSale = String(house.listing_type || "").toLowerCase() === "sale";
        const price = Number(isSale ? house.sale_price || 0 : house.monthly_rent || 0);
        let score = 0;

        if (locationNeedle && location.includes(locationNeedle)) score += 4;
        if (typeNeedle && type.includes(typeNeedle)) score += 3;
        if (roadNeedle && description.includes(roadNeedle)) score += 2;
        if (notesNeedle && description.includes(notesNeedle)) score += 2;
        if (Number.isFinite(budgetValue) && budgetValue > 0) {
          if (price > 0 && price <= budgetValue) score += 4;
          else if (price > 0 && price <= budgetValue * 1.15) score += 2;
        }
        return { house, score };
      })
      .filter((item) => item.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.house);
  }, []);

  // ── FIX: openConversationFromNotification now handles direct ──────────
  const openConversationFromNotification = useCallback(
    (note: any, user: any) => {
      const refType = note.reference_type;
      const refId = note.reference_id;
      const isLandlord = user.role === "landlord" || user.role === "realtor";
      const notificationId = note.notification_id;

      // 1. Direct message notification
      if (refType === "direct" && refId) {
        openConversation(
          {
            threadType: "direct",
            threadId: Number(refId),
            title: note.title || "Direct message",
            subtitle: note.message?.slice(0, 50),
            senderRole: isLandlord ? "landlord" : "tenant",
          },
          { notificationId }
        );
        return;
      }

      // 2. Inquiry notification
      if (refType === "inquiry" && refId) {
        openConversation(
          {
            threadType: "inquiry",
            threadId: Number(refId),
            title: note.title || "Inquiry",
            senderRole: "user",
          },
          { notificationId }
        );
        return;
      }

      // 3. Application notification
      if (refType === "application" && refId) {
        openConversation(
          {
            threadType: "application",
            threadId: Number(refId),
            title: note.title || "Application",
            senderRole: isLandlord ? "landlord" : "tenant",
          },
          { notificationId }
        );
        return;
      }

      // Fallback for old notifications without reference_type
      const title = String(note.title || "").toLowerCase();
      if (title.includes("inquiry") && inquiryThreads.length > 0) {
        const latest = inquiryThreads[0];
        const threadId = latest.inquiry_id ?? latest.id;
        openConversation(
          {
            threadType: "inquiry",
            threadId: Number(threadId),
            title: latest.house_type || "Inquiry",
            subtitle: latest.location,
            senderRole: "user",
          },
          { notificationId }
        );
        setScreenTab("messages");
      } else if (title.includes("message about") || title.includes("application")) {
        if (notificationId != null) markNotificationRead(notificationId);
        setScreenTab("messages");
      }
    },
    [inquiryThreads, markNotificationRead, openConversation]
  );

  const loadMessagesData = useCallback(async (user: any) => {
    if (!user?.user_id) {
      setInquiryThreads([]);
      setApplicationThreads([]);
      return;
    }

    setMessagesLoading(true);
    setMessagesError("");

    try {
      const isLandlord = user.role === "landlord" || user.role === "realtor";
      const fd = new FormData();
      fd.append("user_id", String(user.user_id));

      if (isLandlord) {
        const landlordFd = new FormData();
        landlordFd.append("landlord_id", String(user.user_id));
        const res = await axios.post(`${API_URL}/api/landlord_applications`, landlordFd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setApplicationThreads(res.data?.applications || []);
        setInquiryThreads([]);
      } else {
        const [inquiriesRes, appsRes] = await Promise.all([
          axios.post(`${API_URL}/api/my_inquiries`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
          axios.post(`${API_URL}/api/my_house_applications`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        ]);
        const inquiries = inquiriesRes.data?.inquiries || [];
        setInquiryThreads(inquiries);
        const apps = appsRes.data?.applications || appsRes.data || [];
        setApplicationThreads(Array.isArray(apps) ? apps : []);
        
        // Count unique landlords for messaging limit
        const uniqueLandlords = new Set(inquiries.map((i: any) => i.landlord_id));
        setDirectMessageCount(uniqueLandlords.size);
      }
    } catch (err: any) {
      setMessagesError(err?.response?.data?.message || "Failed to load messages.");
      setInquiryThreads([]);
      setApplicationThreads([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(
    async (user: any) => {
      if (!user?.user_id) {
        clearNotificationState();
        setLoading("");
        return;
      }

      setLoading("Loading notifications...");
      setError("");

      try {
        const isBusinessUser = user.role === "landlord" || user.role === "realtor";

        await loadMessagesData(user);

        if (isBusinessUser) {
          const fd = new FormData();
          fd.append("landlord_id", String(user.user_id));
          const res = await axios.post(`${API_URL}/api/landlord_applications`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setLandlordApplications(res.data?.applications || []);

          const notesFd = new FormData();
          notesFd.append("user_id", String(user.user_id));
          try {
            const notesRes = await axios.post(`${API_URL}/api/my_notifications`, notesFd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            const rawNotes = notesRes.data?.notifications || [];
            setNotifications(
              rawNotes.filter(
                (n: any) => !n.user_id || String(n.user_id) === String(user.user_id)
              )
            );
          } catch {
            setNotifications([]);
          }
          setSuggestedHouses([]);
          setInquiryPreference(null);
          return;
        }

        const [notificationsRes, propertiesRes, pref] = await Promise.all([
          axios.post(
            `${API_URL}/api/my_notifications`,
            (() => {
              const fd = new FormData();
              fd.append("user_id", String(user.user_id));
              return fd;
            })(),
            { headers: { "Content-Type": "multipart/form-data" } }
          ),
          axios.get(`${API_URL}/api/getproperties`),
          loadInquiryPreference(user),
        ]);

        const rawNotes = Array.isArray(notificationsRes.data)
          ? notificationsRes.data
          : notificationsRes.data?.notifications || [];

        const notes = rawNotes.filter((n: any) => {
          if (!n.user_id) return true;
          return String(n.user_id) === String(user.user_id);
        });

        const houses = Array.isArray(propertiesRes.data)
          ? propertiesRes.data
          : propertiesRes.data?.properties || [];

        setNotifications(notes);
        setInquiryPreference(pref);
        setSuggestedHouses(pref ? filterSuggestedHouses(houses, pref) : []);
        setLandlordApplications([]);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load notifications.");
      } finally {
        setLoading("");
      }
    },
    [clearNotificationState, filterSuggestedHouses, loadInquiryPreference, loadMessagesData]
  );

  const refreshPage = useCallback(async () => {
    try {
      setRefreshing(true);
      const user = await normalizeStoredUser();
      setLoggedUser(user);
      if (!user) {
        clearNotificationState();
        return;
      }
      await loadDashboardData(user);
    } finally {
      setRefreshing(false);
    }
  }, [clearNotificationState, loadDashboardData, normalizeStoredUser]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const syncSessionAndData = async () => {
        try {
          const user = await normalizeStoredUser();
          if (!active) return;
          setLoggedUser(user);
          if (user) {
            await loadDashboardData(user);
          } else {
            clearNotificationState();
          }
        } finally {
          if (active) setLoadingUser(false);
        }
      };
      syncSessionAndData();
      return () => {
        active = false;
      };
    }, [clearNotificationState, loadDashboardData, normalizeStoredUser])
  );

  const displayName = loggedUser?.username || loggedUser?.name || "Guest";
  const isBusinessUser = loggedUser?.role === "landlord" || loggedUser?.role === "realtor";

  const messagesUnreadCount = useMemo(() => {
    let count = 0;
    inquiryThreads.forEach((i) => {
      if (isInquiryUnread(i)) count += 1;
    });
    notifications.forEach((n) => {
      if (!isNotificationUnread(n)) return;
      const t = String(n.title || "").toLowerCase();
      if (
        n.reference_type === "inquiry" ||
        n.reference_type === "application" ||
        t.includes("inquiry") ||
        t.includes("message about")
      ) {
        count += 1;
      }
    });
    return count;
  }, [inquiryThreads, notifications]);

  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlords;
    const needle = landlordSearch.trim().toLowerCase();
    return landlords.filter(
      (l) =>
        String(l.landlord_location || "").toLowerCase().includes(needle) ||
        String(l.username || "").toLowerCase().includes(needle)
    );
  }, [landlords, landlordSearch]);

  const renderMessagesTab = () => {
    if (messagesLoading) {
      return <Text style={styles.statusText}>Loading messages...</Text>;
    }
    if (messagesError) {
      return <Text style={styles.errorText}>{messagesError}</Text>;
    }

    const hasInquiries = inquiryThreads.length > 0;
    const hasApps = applicationThreads.length > 0;

    if (!hasInquiries && !hasApps) {
      return (
        <View style={styles.emptyMessages}>
          <Ionicons name="chatbubbles-outline" size={40} color={COLORS.subtext} />
          <Text style={styles.emptyMessagesTitle}>No conversations yet</Text>
          <Text style={styles.emptyMessagesText}>
            {isBusinessUser
              ? "When tenants apply or message you, threads will appear here."
              : "Submit an inquiry or apply for a house to start chatting with admin or landlords."}
          </Text>
        </View>
      );
    }

    return (
      <>
        {!isBusinessUser && hasInquiries && (
          <>
            <Text style={styles.messagesGroupTitle}>Inquiries (admin)</Text>
            {inquiryThreads.map((inq) => {
              const id = inq.inquiry_id ?? inq.id;
              const hasReply = isInquiryUnread(inq);
              return (
                <TouchableOpacity
                  key={`inq-${id}`}
                  style={styles.messageThread}
                  activeOpacity={0.86}
                  onPress={() =>
                    openConversation({
                      threadType: "inquiry",
                      threadId: Number(id),
                      title: inq.house_type || "House inquiry",
                      subtitle: inq.location,
                      senderRole: "user",
                    })
                  }
                  onLongPress={() => deleteThread("inquiry", id)}
                  delayLongPress={500}
                >
                  <View style={styles.messageThreadIcon}>
                    <Ionicons name="search-outline" size={20} color={COLORS.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.messageThreadTitle}>
                      {inq.house_type || "Inquiry"} · {inq.location || "Location"}
                    </Text>
                    <Text style={styles.messageThreadPreview} numberOfLines={1}>
                      {inq.last_message || inq.notes || "Tap to chat with admin"}
                    </Text>
                  </View>
                  {hasReply && <View style={styles.unreadDot} />}
                  <Ionicons name="chevron-forward" size={18} color={COLORS.subtext} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {hasApps && (
          <>
            <Text style={styles.messagesGroupTitle}>
              {isBusinessUser ? "Tenant applications" : "Applications"}
            </Text>
            {applicationThreads.map((app) => (
              <TouchableOpacity
                key={`app-${app.application_id}`}
                style={styles.messageThread}
                activeOpacity={0.86}
                onPress={() =>
                  openConversation({
                    threadType: "application",
                    threadId: app.application_id,
                    title: app.title || app.property_type || "Application",
                    subtitle: isBusinessUser
                      ? `Tenant: ${app.name || "N/A"}`
                      : "Message the Agent",
                    senderRole: isBusinessUser ? "landlord" : "tenant",
                  })
                }
                onLongPress={() => deleteThread("application", app.application_id)}
                delayLongPress={500}
              >
                <View style={styles.messageThreadIcon}>
                  <Ionicons name="home-outline" size={20} color={COLORS.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.messageThreadTitle}>
                    {app.title || app.property_type || "Property"}
                  </Text>
                  <Text style={styles.messageThreadPreview} numberOfLines={1}>
                    {isBusinessUser
                      ? `${app.name || "Applicant"} · ${app.status || "Pending"}`
                      : `${app.location || app.address || "Property"} · ${app.status || "Pending"}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.subtext} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </>
    );
  };

  const filteredNotifications = useMemo(() => {
    if (!loggedUser?.user_id) return [];
    if (filter === "all") return notifications;
    const needle =
      filter === "transactions"
        ? "transaction"
        : filter === "general"
          ? "general"
          : "market";
    return notifications.filter((n) => {
      const title = String(n.title || "").toLowerCase();
      const msg = String(n.message || "").toLowerCase();
      return title.includes(needle) || msg.includes(needle);
    });
  }, [filter, loggedUser, notifications]);

  const todayNotifications = useMemo(() => {
    const today = new Date().toDateString();
    return filteredNotifications.filter((n) => {
      if (!n.created_at) return false;
      return new Date(n.created_at).toDateString() === today;
    });
  }, [filteredNotifications]);

  const earlierNotifications = useMemo(() => {
    const today = new Date().toDateString();
    return filteredNotifications.filter((n) => {
      if (!n.created_at) return false;
      return new Date(n.created_at).toDateString() !== today;
    });
  }, [filteredNotifications]);

  if (loadingUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.centerText}>Loading...</Text>
      </View>
    );
  }

  if (!loggedUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.centerText}>Please log in to view your notifications.</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/login")}>
          <Text style={styles.loginButtonText}>Login</Text>
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
      <Text style={styles.title}>Notifications</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileMeta}>{loggedUser?.email || "No email set"}</Text>
          <Text style={styles.profileMeta}>{loggedUser?.phone || "No phone set"}</Text>
        </View>
      </View>

      {/* ── Main tabs ─────────────────────────────────────────────────────── */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, screenTab === "alerts" && styles.mainTabActive]}
          onPress={() => setScreenTab("alerts")}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color={screenTab === "alerts" ? COLORS.text : COLORS.subtext}
          />
          <Text style={[styles.mainTabText, screenTab === "alerts" && styles.mainTabTextActive]}>
            Alerts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, screenTab === "messages" && styles.mainTabActive]}
          onPress={() => setScreenTab("messages")}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={screenTab === "messages" ? COLORS.text : COLORS.subtext}
          />
          <Text style={[styles.mainTabText, screenTab === "messages" && styles.mainTabTextActive]}>
            Messages
          </Text>
          {messagesUnreadCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {messagesUnreadCount > 9 ? "9+" : messagesUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Find Landlords button (tenants only, alerts tab) ──────────────── */}
      {loggedUser?.role === "tenant" && screenTab === "alerts" && (
        <TouchableOpacity
          style={styles.findLandlordsBtn}
          onPress={() => {
            setShowLandlordList(true);
            fetchLandlords();
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={18} color={COLORS.white} />
          <Text style={styles.findLandlordsBtnText}>Find a House by Messaging Landlords</Text>
        </TouchableOpacity>
      )}

      {screenTab === "messages" && renderMessagesTab()}

      {/* ── ALERTS for TENANTS ─────────────────────────────────────────── */}
      {screenTab === "alerts" && !isBusinessUser && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {[
              { id: "all", label: "All" },
              { id: "transactions", label: "Transactions" },
              { id: "general", label: "General updates" },
              { id: "market", label: "Market updates" },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, filter === item.id && styles.chipActive]}
                onPress={() => setFilter(item.id as FilterType)}
              >
                <Text style={[styles.chipText, filter === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!!loading && <Text style={styles.statusText}>{loading}</Text>}
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {!!todayNotifications.length && <Text style={styles.sectionTitle}>Today</Text>}
          {todayNotifications.map((note) => {
            const expanded = expandedNotificationId === note.notification_id;
            const unread = isNotificationUnread(note);
            const isChat =
              note.reference_type === "inquiry" ||
              note.reference_type === "application" ||
              note.reference_type === "direct" ||
              String(note.title || "").toLowerCase().includes("inquiry") ||
              String(note.title || "").toLowerCase().includes("message about");

            return (
              <TouchableOpacity
                key={String(note.notification_id)}
                style={styles.item}
                activeOpacity={0.86}
                onLongPress={() => deleteNotification(note.notification_id)}
                delayLongPress={500}
                onPress={() => {
                  if (isChat && loggedUser) {
                    openConversationFromNotification(note, loggedUser);
                    return;
                  }
                  if (note.notification_id != null) markNotificationRead(note.notification_id);
                  setExpandedNotificationId(expanded ? null : Number(note.notification_id || 0));
                }}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{note.title || "Notification"}</Text>
                    <Text style={styles.itemDate}>{formatDateLabel(note.created_at || "")}</Text>
                  </View>
                  <Text style={styles.itemMessage} numberOfLines={expanded ? undefined : 2}>
                    {note.message || "No message"}
                  </Text>
                  {isChat && (
                    <Text style={styles.openChatHint}>Tap to open conversation</Text>
                  )}
                </View>
                {unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}

          {!!earlierNotifications.length && <Text style={styles.sectionTitle}>Earlier</Text>}
          {earlierNotifications.map((note) => {
            const expanded = expandedNotificationId === note.notification_id;
            const unread = isNotificationUnread(note);
            const isChat =
              note.reference_type === "inquiry" ||
              note.reference_type === "application" ||
              note.reference_type === "direct" ||
              String(note.title || "").toLowerCase().includes("inquiry") ||
              String(note.title || "").toLowerCase().includes("message about");

            return (
              <TouchableOpacity
                key={String(note.notification_id)}
                style={styles.item}
                activeOpacity={0.86}
                onLongPress={() => deleteNotification(note.notification_id)}
                delayLongPress={500}
                onPress={() => {
                  if (isChat && loggedUser) {
                    openConversationFromNotification(note, loggedUser);
                    return;
                  }
                  if (note.notification_id != null) markNotificationRead(note.notification_id);
                  setExpandedNotificationId(expanded ? null : Number(note.notification_id || 0));
                }}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{note.title || "Notification"}</Text>
                    <Text style={styles.itemDate}>{formatDateLabel(note.created_at || "")}</Text>
                  </View>
                  <Text style={styles.itemMessage} numberOfLines={expanded ? undefined : 2}>
                    {note.message || "No message"}
                  </Text>
                </View>
                {unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}

          {inquiryPreference && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Your inquiry</Text>
              <Text style={styles.infoText}>Type: {inquiryPreference.houseType || "-"}</Text>
              <Text style={styles.infoText}>Location: {inquiryPreference.location || "-"}</Text>
              <Text style={styles.infoText}>Budget: {inquiryPreference.budget || "-"}</Text>
              <Text style={styles.infoText}>Description: {inquiryPreference.notes || "-"}</Text>
            </View>
          )}

          {!!suggestedHouses.length && <Text style={styles.sectionTitle}>Suggested houses</Text>}
          {suggestedHouses.map((house) => (
            <TouchableOpacity
              key={String(house.property_id)}
              style={styles.houseCard}
              onPress={() =>
                router.push({
                  pathname: "/house-details",
                  params: { id: String(house.property_id) },
                })
              }
            >
              <Text style={styles.houseTitle}>{house.title || house.property_type || "House"}</Text>
              <Text style={styles.houseMeta}>{house.address || house.location || "No location"}</Text>
              <Text style={styles.houseMeta}>
                {String(house.listing_type || "").toLowerCase() === "sale"
                  ? `KES ${Number(house.sale_price || 0).toLocaleString()}`
                  : `KES ${Number(house.monthly_rent || 0).toLocaleString()} / month`}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* ── ALERTS for LANDLORDS / REALTORS ─────────────────────────────── */}
      {screenTab === "alerts" && isBusinessUser && (
        <>
          {!!loading && <Text style={styles.statusText}>{loading}</Text>}
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {!!todayNotifications.length && <Text style={styles.sectionTitle}>Today</Text>}
          {todayNotifications.map((note) => {
            const expanded = expandedNotificationId === note.notification_id;
            const unread = isNotificationUnread(note);
            // FIX: include direct type
            const isChat =
              note.reference_type === "application" ||
              note.reference_type === "direct" ||
              String(note.title || "").toLowerCase().includes("message about") ||
              String(note.title || "").toLowerCase().includes("application");

            return (
              <TouchableOpacity
                key={String(note.notification_id)}
                style={styles.item}
                activeOpacity={0.86}
                onLongPress={() => deleteNotification(note.notification_id)}
                delayLongPress={500}
                onPress={() => {
                  if (isChat && loggedUser) {
                    openConversationFromNotification(note, loggedUser);
                    return;
                  }
                  if (note.notification_id != null) markNotificationRead(note.notification_id);
                  setExpandedNotificationId(expanded ? null : Number(note.notification_id || 0));
                }}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{note.title || "Notification"}</Text>
                    <Text style={styles.itemDate}>{formatDateLabel(note.created_at || "")}</Text>
                  </View>
                  <Text style={styles.itemMessage} numberOfLines={expanded ? undefined : 2}>
                    {note.message || "No message"}
                  </Text>
                </View>
                {unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}

          {filteredNotifications.length === 0 && !loading && (
            <Text style={styles.centerText}>No alerts yet. Check the Messages tab for tenant chats.</Text>
          )}

          <Text style={styles.sectionTitle}>Recent applications</Text>
          {landlordApplications.length === 0 ? (
            <Text style={styles.centerText}>No house applications yet.</Text>
          ) : (
            landlordApplications.slice(0, 5).map((app) => (
              <TouchableOpacity
                key={String(app.application_id)}
                style={styles.houseCard}
                onPress={() =>
                  openConversation({
                    threadType: "application",
                    threadId: app.application_id,
                    title: app.title || "Application",
                    subtitle: `Message ${app.name || "tenant"}`,
                    senderRole: "landlord",
                  })
                }
              >
                <Text style={styles.houseTitle}>{app.title || "Property application"}</Text>
                <Text style={styles.houseMeta}>Applicant: {app.name || "N/A"} · {app.status || "Pending"}</Text>
                <Text style={styles.openChatHint}>Tap to message tenant</Text>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      {/* ─── ConversationModal ─────────────────────────────────────────────── */}
      {conversation && loggedUser?.user_id && (
        <ConversationModal
          visible={!!conversation}
          onClose={() => setConversation(null)}
          onOpened={() => {
            if (conversation.threadType === "inquiry") {
              markInquiryRead(conversation.threadId);
              markNotificationsForThread("inquiry", conversation.threadId);
            } else if (conversation.threadType === "application") {
              markNotificationsForThread("application", conversation.threadId);
            } else if (conversation.threadType === "direct") {
              markNotificationsForThread("direct", conversation.threadId);
            }
          }}
          threadType={conversation.threadType}
          threadId={conversation.threadId}
          userId={loggedUser.user_id}
          senderRole={conversation.senderRole}
          title={conversation.title}
          subtitle={conversation.subtitle}
          otherParticipantId={conversation.otherParticipantId}
        />
      )}

      {/* ─── Landlord List Bottom Sheet ──────────────────────────────────── */}
      <Modal
        visible={showLandlordList}
        animationType="slide"
        transparent
        onRequestClose={closeLandlordSheet}
      >
        <TouchableOpacity
          style={styles.landlordSheetBackdrop}
          activeOpacity={1}
          onPress={closeLandlordSheet}
        />
        <View style={styles.landlordSheet}>
          <View style={styles.landlordSheetHandle} />
          <View style={styles.landlordModalHeader}>
            <Text style={styles.landlordModalTitle}>Message a landlord</Text>
            <TouchableOpacity
              style={styles.landlordSheetClose}
              onPress={closeLandlordSheet}
            >
              <Ionicons name="close" size={16} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.landlordSearchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.subtext} />
            <TextInput
              style={styles.landlordSearchInput}
              placeholder="Search by location e.g. Juja"
              placeholderTextColor={COLORS.subtext}
              value={landlordSearch}
              onChangeText={setLandlordSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {landlordSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setLandlordSearch("")}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={15} color={COLORS.subtext} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filteredLandlords}
            keyExtractor={(item) => String(item.user_id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.landlordItem}
                onPress={() => startDirectChat(item)}
                activeOpacity={0.7}
              >
                <View style={styles.landlordAvatar}>
                  <Text style={styles.landlordAvatarText}>
                    {getInitials(item.username)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.landlordName}>{item.username}</Text>
                  <Text style={styles.landlordMeta}>
                    {item.landlord_location || "No location"} ·{" "}
                    {item.landlord_house_type || "Various"}
                  </Text>
                </View>
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.accent} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
            ListEmptyComponent={
              <Text style={styles.landlordEmptyText}>
                No landlords found{landlordSearch ? ` in "${landlordSearch}"` : ""}.
              </Text>
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 30 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: { fontSize: 34, color: COLORS.text, fontWeight: "800", marginBottom: 14 },
  centerText: { color: COLORS.subtext, textAlign: "center", lineHeight: 21, fontSize: 14 },
  loginButton: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  loginButtonText: { color: COLORS.white, fontWeight: "800" },
  profileCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ECEEF3",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: COLORS.text },
  profileName: { fontSize: 16, color: COLORS.text, fontWeight: "700" },
  profileMeta: { color: COLORS.subtext, marginTop: 2, fontSize: 12 },
  chipsRow: { gap: 8, paddingBottom: 6, marginBottom: 8 },
  chip: {
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.white, borderColor: COLORS.text },
  chipText: { color: COLORS.subtext, fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: COLORS.text },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 8,
  },
  item: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  itemTitle: { flex: 1, color: COLORS.text, fontWeight: "700", fontSize: 14 },
  itemDate: { color: COLORS.subtext, fontSize: 12, fontWeight: "600" },
  itemMessage: { color: COLORS.subtext, marginTop: 4, lineHeight: 20 },
  unreadDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: COLORS.dot, marginTop: 6 },
  infoCard: {
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoTitle: { color: COLORS.text, fontWeight: "800", marginBottom: 6 },
  infoText: { color: COLORS.subtext, marginTop: 2 },
  houseCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  houseTitle: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  houseMeta: { color: COLORS.subtext, marginTop: 4, fontSize: 12 },
  statusText: { color: COLORS.subtext, marginBottom: 8, fontWeight: "600" },
  errorText: { color: "#D93025", marginBottom: 8, fontWeight: "600" },
  mainTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  mainTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mainTabActive: { backgroundColor: COLORS.chip },
  mainTabText: { fontSize: 14, fontWeight: "600", color: COLORS.subtext },
  mainTabTextActive: { color: COLORS.text, fontWeight: "800" },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.dot,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "800" },
  messagesGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.subtext,
    marginBottom: 8,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageThread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  messageThreadIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF4ED",
    alignItems: "center",
    justifyContent: "center",
  },
  messageThreadTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  messageThreadPreview: { fontSize: 13, color: COLORS.subtext, marginTop: 3 },
  emptyMessages: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyMessagesTitle: { marginTop: 12, fontSize: 17, fontWeight: "700", color: COLORS.text },
  emptyMessagesText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.subtext,
    textAlign: "center",
    lineHeight: 21,
  },
  openChatHint: { marginTop: 6, fontSize: 12, fontWeight: "700", color: COLORS.accent },
  findLandlordsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 8,
  },
  findLandlordsBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  landlordSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  landlordSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "65%",
  },
  landlordSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  landlordModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  landlordModalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  landlordSheetClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  landlordSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  landlordSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
    padding: 0,
  },
  landlordItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  landlordAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF4ED",
    alignItems: "center",
    justifyContent: "center",
  },
  landlordAvatarText: { fontWeight: "800", color: COLORS.accent, fontSize: 16 },
  landlordName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  landlordMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  landlordEmptyText: {
    textAlign: "center",
    color: COLORS.subtext,
    fontSize: 13,
    paddingVertical: 24,
    fontWeight: "500",
  },
});