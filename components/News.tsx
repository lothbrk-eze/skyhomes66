import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import * as ImagePicker from "expo-image-picker";
import { API_URL, IMAGE_BASE_URL } from "../lib/api";
import { canPostNews, getMessagingLimit } from "../lib/subscriptionUtils";
import { useSubscription } from "../hooks/useSubscription";
import ConversationModal from "./ConversationModal";
import SubscriptionModal from "./SubscriptionModal";

const C = {
  bg: "#EFF6FF",           // Blue-tinted page bg
  cardBg: "#F8FAFF",       // Slightly lighter card bg
  white: "#FFFFFF",
  text: "#0F172A",
  subtext: "#4B6CB7",
  border: "#DBEAFE",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  danger: "#DC2626",
  avatarBg: "#BFDBFE",
  fabBg: "#2563EB",        // Blue FAB
};

// Initials avatar colors — cycled by index
const AVATAR_COLORS = ["#D4A8E8", "#A8D4E8", "#A8E8C4", "#E8D4A8", "#E8A8A8", "#A8B4E8"];

type NewsPost = {
  news_id: number;
  author_id: number;
  author_name?: string;
  author_role?: string;
  title: string;
  body: string;
  location?: string;
  property_id?: number | null;
  image?: string;
  created_at?: string;
};

type ConversationState = {
  threadType: "direct";
  threadId: number;
  title: string;
  subtitle?: string;
  senderRole: "tenant" | "landlord";
  otherParticipantId: number;
};

const formatDate = (value?: string) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const resolveImageUrl = (filename?: string) => {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  return `${IMAGE_BASE_URL}${filename}`;
};

// Generates a consistent color per author name
const avatarColor = (name?: string, index?: number) => {
  const i = name
    ? name.charCodeAt(0) % AVATAR_COLORS.length
    : (index ?? 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
};

const initials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

// Clubhouse-style clustered avatar bubbles
const AvatarCluster = ({
  authorName,
  extraCount = 0,
}: {
  authorName?: string;
  extraCount?: number;
}) => {
  // Simulated cluster positions (main + 2 behind)
  const clusterAvatars = [
    { name: authorName, size: 52, top: 14, left: 20, zIndex: 3 },
    { name: undefined, size: 44, top: 4, left: 56, zIndex: 2 },
    { name: undefined, size: 38, top: 28, left: 62, zIndex: 1 },
  ];

  return (
    <View style={styles.clusterWrap}>
      {clusterAvatars.map((av, idx) => (
        <View
          key={idx}
          style={[
            styles.clusterAvatar,
            {
              width: av.size,
              height: av.size,
              borderRadius: av.size / 2,
              backgroundColor: avatarColor(av.name, idx + 2),
              position: "absolute",
              top: av.top,
              left: av.left,
              zIndex: av.zIndex,
            },
          ]}
        >
          <Text style={[styles.clusterInitials, { fontSize: av.size * 0.32 }]}>
            {av.name ? initials(av.name) : ""}
          </Text>
        </View>
      ))}
      {extraCount > 0 && (
        <View style={styles.clusterCount}>
          <Text style={styles.clusterCountText}>+{extraCount}</Text>
        </View>
      )}
    </View>
  );
};

const News = () => {
  const { isPremium } = useSubscription();
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [subscriptionVisible, setSubscriptionVisible] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [posting, setPosting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [directMessageCount, setDirectMessageCount] = useState(0);
  const [messagingPostId, setMessagingPostId] = useState<number | null>(null);

  const isBusinessUser =
    loggedUser?.role === "landlord" || loggedUser?.role === "realtor";
  const canPost = canPostNews(loggedUser?.role, isPremium);

  const loadUser = useCallback(async () => {
    const isLoggedIn = await AsyncStorage.getItem("isLoggedIn");
    if (isLoggedIn !== "true") return null;
    const storedUser = await AsyncStorage.getItem("user");
    if (storedUser) {
      try { return JSON.parse(storedUser); } catch { return null; }
    }
    const userId = await AsyncStorage.getItem("user_id");
    if (!userId) return null;
    return {
      user_id: userId,
      username: (await AsyncStorage.getItem("username")) || "User",
      role: (await AsyncStorage.getItem("role")) || "tenant",
      email: await AsyncStorage.getItem("email"),
    };
  }, []);

  const loadDirectMessageCount = useCallback(async (user: any) => {
    if (!user?.user_id || user.role !== "tenant") {
      setDirectMessageCount(0);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("user_id", String(user.user_id));
      const res = await axios.post(`${API_URL}/api/my_inquiries`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const inquiries = res.data?.inquiries || [];
      const uniqueLandlords = new Set(inquiries.map((i: any) => i.landlord_id));
      setDirectMessageCount(uniqueLandlords.size);
    } catch {
      setDirectMessageCount(0);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setError("");
    try {
      const res = await axios.get(`${API_URL}/api/news`);
      const list = res.data?.news || res.data?.posts || res.data || [];
      setPosts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load news updates.");
      setPosts([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const user = await loadUser();
    setLoggedUser(user);
    await Promise.all([fetchNews(), user ? loadDirectMessageCount(user) : Promise.resolve()]);
    setRefreshing(false);
  }, [fetchNews, loadDirectMessageCount, loadUser]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const user = await loadUser();
      setLoggedUser(user);
      await Promise.all([fetchNews(), user ? loadDirectMessageCount(user) : Promise.resolve()]);
      setLoading(false);
    };
    init();
  }, [fetchNews, loadDirectMessageCount, loadUser]);

  const resetPostForm = () => {
    setTitle(""); setBody(""); setLocation(""); setImage(null);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow gallery access to attach a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
  };

  const submitPost = async () => {
    if (!loggedUser?.user_id) { router.push("/login"); return; }
    if (!canPost) { setSubscriptionVisible(true); return; }
    if (!title.trim() || !body.trim()) {
      Alert.alert("Required", "Please add a title and description for your update.");
      return;
    }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("author_id", String(loggedUser.user_id));
      fd.append("author_role", String(loggedUser.role));
      fd.append("is_premium", String(isPremium));
      fd.append("title", title.trim());
      fd.append("body", body.trim());
      if (location.trim()) fd.append("location", location.trim());
      if (image) {
        fd.append("image", {
          uri: image.uri,
          name: image.fileName || "news_photo.jpg",
          type: image.mimeType || "image/jpeg",
        } as any);
      }
      const res = await axios.post(`${API_URL}/api/news`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("Posted", res.data?.message || "Your news update is live.");
      setPostModalVisible(false);
      resetPostForm();
      await fetchNews();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Could not post update.");
    } finally {
      setPosting(false);
    }
  };

  const deletePost = (post: NewsPost) => {
    Alert.alert("Delete update", "Remove this news post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/news/${post.news_id}`, {
              params: { author_id: loggedUser?.user_id },
            });
            setPosts((prev) => prev.filter((p) => p.news_id !== post.news_id));
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message || "Could not delete post.");
          }
        },
      },
    ]);
  };

  const inquireAboutPost = async (post: NewsPost) => {
    if (!loggedUser?.user_id) { router.push("/login"); return; }
    if (loggedUser.role !== "tenant") {
      Alert.alert("Tenants only", "Only tenants can message landlords about availability updates.");
      return;
    }
    const limit = getMessagingLimit("tenant", isPremium);
    if (directMessageCount >= limit && !isPremium) {
      Alert.alert(
        "Limit Reached",
        `You can message up to ${limit} landlords on the free plan. Upgrade to Premium for unlimited messaging.`
      );
      return;
    }
    setMessagingPostId(post.news_id);
    try {
      const fd = new FormData();
      fd.append("tenant_id", String(loggedUser.user_id));
      fd.append("landlord_id", String(post.author_id));
      const res = await axios.post(`${API_URL}/api/direct/start`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const conversationId = res.data.conversation_id;
      const intro = `Hi, I'm interested in your update: "${post.title}"${post.location ? ` (${post.location})` : ""}.`;
      const msgFd = new FormData();
      msgFd.append("user_id", String(loggedUser.user_id));
      msgFd.append("sender_role", "tenant");
      msgFd.append("message", intro);
      msgFd.append("other_id", String(post.author_id));
      await axios.post(`${API_URL}/api/direct/conversations/${conversationId}/messages`, msgFd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setConversation({
        threadType: "direct",
        threadId: conversationId,
        title: post.author_name || "Landlord",
        subtitle: post.title,
        senderRole: "tenant",
        otherParticipantId: post.author_id,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Could not start conversation.");
    } finally {
      setMessagingPostId(null);
    }
  };

  const openPostModal = () => {
    if (!loggedUser) { router.push("/login"); return; }
    if (!isBusinessUser) {
      Alert.alert("Landlords & Realtors", "Only landlords and realtors can post availability updates.");
      return;
    }
    if (!canPost) {
      if (loggedUser?.role === "realtor") {
        Alert.alert(
          "Realtor Premium Required",
          "Free realtors can post up to 2 houses with free reels. Upgrading to Realtor Premium unlocks posting news updates, unlimited house listings, and priority listings.",
          [
            { text: "Later", style: "cancel" },
            { text: "Upgrade to Premium", onPress: () => setSubscriptionVisible(true) },
          ]
        );
      } else {
        setSubscriptionVisible(true);
      }
      return;
    }
    resetPostForm();
    setPostModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.centerText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.subtext} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>News & Availability</Text>
          <View style={styles.headerActions}>
            {loggedUser && (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarCircleText}>
                  {initials(loggedUser.username || loggedUser.email)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Premium banner ── */}
        {isBusinessUser && !canPost && (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => setSubscriptionVisible(true)} activeOpacity={0.85}>
            <Ionicons name="star" size={16} color={C.accent} />
            <Text style={styles.premiumBannerText}>
              {loggedUser?.role === "realtor"
                ? "Upgrade to Realtor Premium to post news updates"
                : "Upgrade to post availability updates"}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.subtext} />
          </TouchableOpacity>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {/* ── Empty state ── */}
        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="newspaper-outline" size={40} color={C.subtext} />
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptyText}>
              {isBusinessUser && canPost
                ? "Be the first to post about available houses."
                : "Check back soon for updates from landlords and realtors."}
            </Text>
          </View>
        ) : (
          posts.map((post, index) => {
            const imageUrl = resolveImageUrl(post.image);
            const isOwnPost = String(post.author_id) === String(loggedUser?.user_id);
            const isMessaging = messagingPostId === post.news_id;

            return (
              <View key={String(post.news_id)} style={styles.card}>
                <View style={styles.cardInner}>
                  {/* Left: text content */}
                  <View style={styles.cardLeft}>
                    {/* Author row */}
                    <View style={styles.authorRow}>
                      <View style={[styles.authorDot, { backgroundColor: avatarColor(post.author_name, index) }]} />
                      <Text style={styles.authorName} numberOfLines={1}>
                        {post.author_name || "Landlord"}
                        {post.author_role ? ` · ${post.author_role}` : ""}
                      </Text>
                      {isOwnPost && (
                        <TouchableOpacity onPress={() => deletePost(post)} hitSlop={10} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={15} color={C.danger} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={3}>{post.title}</Text>

                    {/* Location */}
                    {!!post.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={C.subtext} />
                        <Text style={styles.locationText}>{post.location}</Text>
                      </View>
                    )}

                    {/* Date */}
                    {!!post.created_at && (
                      <Text style={styles.dateText}>{formatDate(post.created_at)}</Text>
                    )}
                  </View>

                  {/* Right: avatar cluster */}
                  <AvatarCluster
                    authorName={post.author_name}
                    extraCount={Math.floor(Math.random() * 30) + 5}
                  />
                </View>

                {/* Full-width image (below the row) */}
                {!!imageUrl && (
                  <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
                )}

                {/* Body text */}
                {!!post.body && (
                  <Text style={styles.cardBodyText} numberOfLines={3}>{post.body}</Text>
                )}

                {/* Inquire button */}
                {!isOwnPost && loggedUser?.role === "tenant" && (
                  <TouchableOpacity
                    style={styles.inquireBtn}
                    onPress={() => inquireAboutPost(post)}
                    disabled={isMessaging}
                    activeOpacity={0.85}
                  >
                    {isMessaging ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-outline" size={14} color={C.accent} />
                        <Text style={styles.inquireBtnText}>Message to inquire</Text>
                        <Ionicons name="arrow-forward" size={14} color={C.accent} />
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!loggedUser && (
                  <TouchableOpacity style={styles.loginHint} onPress={() => router.push("/login")}>
                    <Text style={styles.loginHintText}>Log in to message about this update →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Clubhouse-style blue FAB ── */}
      {isBusinessUser && (
        <TouchableOpacity style={styles.fab} onPress={openPostModal} activeOpacity={0.88}>
          <Ionicons name="add" size={28} color={C.white} />
        </TouchableOpacity>
      )}

      {/* ── Post modal ── */}
      <Modal
        visible={postModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPostModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post availability update</Text>
              <TouchableOpacity onPress={() => setPostModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2BR available in Karen"
                placeholderTextColor={C.subtext}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Share details about the house, rent, viewing times..."
                placeholderTextColor={C.subtext}
                value={body}
                onChangeText={setBody}
                multiline
              />

              <Text style={styles.label}>Location (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Karen, Nairobi"
                placeholderTextColor={C.subtext}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={styles.label}>Photo (1 max)</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                <Ionicons name="image-outline" size={20} color={C.accent} />
                <Text style={styles.imagePickerText}>{image ? "Change photo" : "Add one photo"}</Text>
              </TouchableOpacity>
              {image && (
                <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="cover" />
              )}

              <TouchableOpacity
                style={[styles.submitBtn, posting && styles.submitBtnDisabled]}
                onPress={submitPost}
                disabled={posting}
                activeOpacity={0.88}
              >
                {posting ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Publish update</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {conversation && loggedUser?.user_id && (
        <ConversationModal
          visible={!!conversation}
          onClose={() => setConversation(null)}
          threadType={conversation.threadType}
          threadId={conversation.threadId}
          userId={loggedUser.user_id}
          senderRole={conversation.senderRole}
          title={conversation.title}
          subtitle={conversation.subtitle}
          otherParticipantId={conversation.otherParticipantId}
        />
      )}

      <SubscriptionModal
        visible={subscriptionVisible}
        context={loggedUser?.role === "realtor" ? "realtor_signup" : "listing_boost"}
        onClose={() => setSubscriptionVisible(false)}
        onLater={() => setSubscriptionVisible(false)}
      />
    </>
  );
};

export default News;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, gap: 10 },
  centerText: { color: C.subtext, fontSize: 14 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: 4,
  },
  screenTitle: { fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.avatarBg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.white,
  },
  avatarCircleText: { fontSize: 13, fontWeight: "700", color: C.text },

  // Premium banner
  premiumBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.accentLight, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
  },
  premiumBannerText: { flex: 1, color: C.text, fontSize: 13, fontWeight: "600" },

  errorText: { color: C.danger, marginBottom: 12, fontSize: 13 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginTop: 10 },
  emptyText: { textAlign: "center", color: C.subtext, fontSize: 13, lineHeight: 20, paddingHorizontal: 24 },

  // Card — Clubhouse style: warm bg, no heavy border
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardLeft: { flex: 1, paddingRight: 4 },

  // Author row
  authorRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  authorDot: { width: 22, height: 22, borderRadius: 11 },
  authorName: { flex: 1, fontSize: 12, fontWeight: "600", color: C.subtext },
  deleteBtn: { padding: 2 },

  // Card text
  cardTitle: { fontSize: 19, fontWeight: "800", color: C.text, lineHeight: 25, marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  locationText: { fontSize: 12, color: C.subtext },
  dateText: { fontSize: 11, color: C.subtext, marginTop: 2 },
  cardBodyText: { fontSize: 13, color: C.subtext, lineHeight: 19, marginTop: 12 },

  // Avatar cluster
  clusterWrap: { width: 110, height: 80, position: "relative" },
  clusterAvatar: {
    borderWidth: 2, borderColor: C.cardBg,
    alignItems: "center", justifyContent: "center",
  },
  clusterInitials: { fontWeight: "700", color: C.text },
  clusterCount: {
    position: "absolute", bottom: 4, right: 0,
    backgroundColor: C.avatarBg, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 2, borderColor: C.cardBg,
  },
  clusterCountText: { fontSize: 11, fontWeight: "700", color: C.text },

  // Inquire button — text style, not filled (Clubhouse rarely uses filled CTAs on cards)
  inquireBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  inquireBtnText: { flex: 1, fontSize: 13, fontWeight: "700", color: C.accent },
  loginHint: { marginTop: 12 },
  loginHintText: { color: C.accent, fontSize: 13, fontWeight: "600" },

  // FAB — Clubhouse blue floating button
  fab: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    left: "50%",
    marginLeft: -30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.fabBg,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.fabBg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center", marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  label: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: C.text, backgroundColor: C.bg,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  imagePicker: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 14, backgroundColor: C.bg,
  },
  imagePickerText: { color: C.text, fontWeight: "600", fontSize: 14 },
  previewImage: { width: "100%", height: 160, borderRadius: 12, marginTop: 10 },
  submitBtn: {
    marginTop: 24, marginBottom: 4,
    backgroundColor: C.accent,
    borderRadius: 14, paddingVertical: 15,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: C.white, fontWeight: "800", fontSize: 15 },
});