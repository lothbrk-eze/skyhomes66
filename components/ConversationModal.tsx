import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { API_URL, ThreadMessage } from "../lib/api";

export type ThreadType = "inquiry" | "application" | "direct";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpened?: () => void;
  threadType: ThreadType;
  threadId: number;
  userId: number | string;
  senderRole: "admin" | "user" | "landlord" | "tenant";
  title: string;
  subtitle?: string;
  otherParticipantId?: number | string;
  readOnly?: boolean;
};

const COLORS = {
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  blue: "#2563EB",
  bg: "#EFF6FF",
  white: "#FFFFFF",
  text: "#0F172A",
  subtext: "#4B6CB7",
  border: "#DBEAFE",
  inputBg: "#F8FAFF",
  bubbleMine: "#2563EB",
  readOnlyBg: "#F8FAFF",
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const KEYBOARD_SHEET_MIN = 280;

const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    landlord: "Landlord",
    tenant: "Tenant",
    admin: "Admin",
    user: "User",
  };
  return map[role] ?? role;
};

const formatTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
};

// ── Build the base URL for GET and POST ──────────────────────────────────────
function buildBasePath(
  threadType: ThreadType,
  threadId: number,
): string {
  if (threadType === "inquiry") return `${API_URL}/api/inquiries/${threadId}/messages`;
  if (threadType === "application") return `${API_URL}/api/applications/${threadId}/messages`;
  // direct — matches Flask: /api/direct/conversations/<id>/messages
  return `${API_URL}/api/direct/conversations/${threadId}/messages`;
}

// ── Normalise message shape across all three thread types ────────────────────
// Direct messages from Flask don't have sender_role, so we infer it from sender_id.
function normaliseMessages(
  raw: any[],
  userId: number | string,
): ThreadMessage[] {
  return raw.map((m) => ({
    id: m.id ?? m.message_id ?? 0,
    message: m.message ?? "",
    sender_role: m.sender_role ?? "",   // empty for direct msgs — we use sender_id instead
    sender_id: m.sender_id,
    sender_name: m.sender_name ?? m.username ?? "",
    created_at: m.created_at,
  }));
}

export default function ConversationModal({
  visible,
  onClose,
  onOpened,
  threadType,
  threadId,
  userId,
  senderRole,
  title,
  subtitle,
  otherParticipantId,
  readOnly = false,
}: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [retryCount, setRetry] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  const basePath = buildBasePath(threadType, threadId);

  // ── Load messages ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!threadId || !userId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      // Build query params
      const params: Record<string, string> = {
        user_id: String(userId),
        role: senderRole === "landlord" ? "landlord"
          : senderRole === "admin" ? "admin"
            : "user",
      };
      if (threadType === "direct" && otherParticipantId) {
        params.other_id = String(otherParticipantId);
      }

      const res = await axios.get(basePath, { params });
      const raw = res.data?.messages ?? [];
      const normalised = normaliseMessages(raw, userId);
      setMessages(normalised);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message ?? err?.message ?? "Unknown error";
      const detail = status ? `(${status}) ${message}` : message;
      setErrorMsg(`Could not load messages: ${detail}`);
    } finally {
      setLoading(false);
    }
  }, [basePath, threadId, userId, senderRole, threadType, otherParticipantId]);

  useEffect(() => {
    if (!visible) return;
    onOpened?.();
    loadMessages();
    setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, retryCount]);

  // Shrink the sheet to the space above the keyboard instead of lifting the
  // whole modal with KeyboardAvoidingView (which over-shoots and hides the input).
  useEffect(() => {
    if (!visible) {
      setSheetMaxHeight(undefined);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const available = Math.max(KEYBOARD_SHEET_MIN, e.endCoordinates.screenY - 12);
      setSheetMaxHeight(Math.min(available, SCREEN_HEIGHT * 0.9));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };
    const onHide = () => setSheetMaxHeight(undefined);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("user_id", String(userId));
      fd.append("sender_role", senderRole);
      fd.append("message", text);
      if (threadType === "direct" && otherParticipantId) {
        fd.append("other_id", String(otherParticipantId));
      }

      await axios.post(basePath, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setDraft("");
      await loadMessages();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message ?? err?.message ?? "Unknown error";
      const detail = status ? `(${status}) ${message}` : message;
      // Show inline so the user can read the exact error
      setErrorMsg(`Send failed: ${detail}`);
      Alert.alert("Send failed", detail);
    } finally {
      setSending(false);
    }
  };

  const threadBadge = {
    inquiry: { label: "Inquiry", icon: "search-outline" as const, color: COLORS.blue },
    application: { label: "Application", icon: "home-outline" as const, color: COLORS.text },
    direct: { label: "Direct message", icon: "chatbubble-outline" as const, color: COLORS.primary },
  }[threadType];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
          <View
            style={[
              styles.sheet,
              sheetMaxHeight != null && { maxHeight: sheetMaxHeight, minHeight: 0 },
            ]}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.dragHandle} />
              <View style={styles.headerRow}>
                <View style={[styles.headerIcon, { backgroundColor: COLORS.primaryLight }]}>
                  <Ionicons name={threadBadge.icon} size={20} color={threadBadge.color} />
                </View>

                <View style={styles.headerText}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                  {!!subtitle && (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
                  )}
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: COLORS.primaryLight }]}>
                      <Text style={[styles.badgeText, { color: threadBadge.color }]}>
                        {threadBadge.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerActionBtn}
                    onPress={() => setRetry((c) => c + 1)}
                    hitSlop={12}
                  >
                    <Ionicons name="refresh-outline" size={20} color={COLORS.subtext} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Inline error banner ── */}
            {!!errorMsg && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                <Text style={styles.errorBannerText} numberOfLines={3}>{errorMsg}</Text>
                <TouchableOpacity onPress={() => setErrorMsg("")} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#B91C1C" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Messages ── */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading conversation…</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="chatbubbles-outline" size={32} color={COLORS.subtext} />
                    </View>
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyText}>
                      {readOnly ? "No messages in this thread yet." : "Be the first to send a message."}
                    </Text>
                  </View>
                ) : (
                  messages.map((m, index) => {
                    // For direct threads sender_role is empty — use sender_id
                    const mine =
                      !readOnly &&
                      (threadType === "direct"
                        ? String(m.sender_id) === String(userId)
                        : m.sender_role === senderRole || String(m.sender_id) === String(userId));

                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isSameGroup = prevMsg && String(prevMsg.sender_id) === String(m.sender_id);
                    const showSender = !mine && !isSameGroup;

                    return (
                      <View
                        key={m.id ?? index}
                        style={[
                          styles.bubbleWrapper,
                          mine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs,
                          isSameGroup && styles.bubbleGrouped,
                        ]}
                      >
                        {(readOnly || showSender) && (
                          <Text style={styles.senderName}>
                            {m.sender_name ? `${m.sender_name}` : ""}
                            {m.sender_role ? ` · ${roleLabel(m.sender_role)}` : ""}
                          </Text>
                        )}
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                          <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                            {m.message}
                          </Text>
                        </View>
                        <Text style={[styles.timestamp, mine && styles.timestampMine]}>
                          {formatTime(m.created_at)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            {/* ── Read-only bar ── */}
            {readOnly ? (
              <View style={styles.readOnlyBar}>
                <Ionicons name="eye-outline" size={16} color={COLORS.subtext} />
                <Text style={styles.readOnlyText}>View only — you cannot reply in this thread.</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.inputRow,
                  sheetMaxHeight != null && styles.inputRowKeyboard,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Type a message…"
                  placeholderTextColor={COLORS.subtext}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={1000}
                  onFocus={() =>
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
                  }
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!draft.trim() || sending}
                  activeOpacity={0.8}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            )}
          </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "55%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },

  // Header
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center", marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.subtext, marginTop: 1 },
  badgeRow: { flexDirection: "row", marginTop: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  headerActionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: "#B91C1C", lineHeight: 17 },

  // Loading / empty
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 },
  loadingText: { color: COLORS.subtext, fontSize: 14, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.subtext, textAlign: "center", lineHeight: 20 },

  // Messages
  messages: { flex: 1, backgroundColor: COLORS.bg },
  messagesContent: { padding: 16, paddingBottom: 12, gap: 2 },
  bubbleWrapper: { maxWidth: "80%", marginBottom: 4 },
  bubbleWrapperMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleWrapperTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleGrouped: { marginTop: -2 },
  senderName: { fontSize: 11, fontWeight: "700", color: COLORS.subtext, marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: COLORS.bubbleMine, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: COLORS.white, borderBottomLeftRadius: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextMine: { color: COLORS.white },
  bubbleTextTheirs: { color: COLORS.text },
  timestamp: { fontSize: 10, color: COLORS.subtext, marginTop: 3, marginLeft: 4, marginRight: 4 },
  timestampMine: { textAlign: "right" },

  // Input
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.white, gap: 8,
  },
  inputRowKeyboard: {
    paddingBottom: 12,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 110,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: 10,
    fontSize: 15, color: COLORS.text,
    backgroundColor: COLORS.inputBg,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  sendBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },

  // Read-only
  readOnlyBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.readOnlyBg,
  },
  readOnlyText: { flex: 1, fontSize: 13, color: COLORS.subtext, fontWeight: "600" },
});