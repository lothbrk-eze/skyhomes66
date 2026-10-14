import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { API_URL } from "../lib/api";

export type DMParticipant = {
  user_id: number | string;
  username: string;
  property_location?: string;
  house_types?: string;
  role?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  landlord?: DMParticipant;
  participant?: DMParticipant;
  currentUserId: number | string;
};

type DMessage = {
  message_id: number;
  sender_id: number | string;
  receiver_id: number | string;
  message: string;
  is_read: number;
  created_at: string;
};

const C = {
  orange: "#FC5C02",
  bg: "#F4F5F7",
  white: "#FFFFFF",
  text: "#1F1F1F",
  subtext: "#737780",
  border: "#E8E9ED",
  theirBubble: "#F3F4F6",
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const KEYBOARD_SHEET_MIN = 280;

const getInitials = (name: string) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const formatTime = (ts: string) => {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function DirectMessageModal({
  visible,
  onClose,
  landlord,
  participant,
  currentUserId,
}: Props) {
  const targetUser = participant || landlord || { user_id: "", username: "User" };
  const [messages, setMessages] = useState<DMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async (showSpinner = true) => {
    if (!targetUser?.user_id || !currentUserId) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/direct_messages`, {
        params: { sender_id: currentUserId, receiver_id: targetUser.user_id },
      });
      const newMsgs: DMessage[] = res.data?.messages || [];
      setMessages((prev) => {
        if (prev.length !== newMsgs.length || JSON.stringify(prev) !== JSON.stringify(newMsgs)) {
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
          return newMsgs;
        }
        return prev;
      });
      if (showSpinner) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
      }
    } catch {
      if (showSpinner) setMessages([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [targetUser?.user_id, currentUserId]);

  useEffect(() => {
    if (!visible) return;
    setDraft("");
    loadMessages(true);

    const interval = setInterval(() => {
      loadMessages(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [visible, loadMessages]);

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

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending || !targetUser?.user_id) return;
    setSending(true);
    // Optimistic UI
    const optimistic: DMessage = {
      message_id: Date.now(),
      sender_id: currentUserId,
      receiver_id: targetUser.user_id,
      message: text,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const fd = new FormData();
      fd.append("sender_id", String(currentUserId));
      fd.append("receiver_id", String(targetUser.user_id));
      fd.append("message", text);
      await axios.post(`${API_URL}/api/direct_messages/send`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadMessages(false);
    } catch {
      // keep optimistic message on screen
    } finally {
      setSending(false);
    }
  };

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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(targetUser.username)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.landlordName}>{targetUser.username}</Text>
                {!!targetUser.property_location && (
                  <Text style={styles.landlordMeta}>📍 {targetUser.property_location}</Text>
                )}
                {!!targetUser.house_types && (
                  <Text style={styles.landlordMeta}>🏠 {targetUser.house_types}</Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={26} color="#111" />
              </TouchableOpacity>
            </View>

            {/* ── Messages ── */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={C.orange} />
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={44}
                      color={C.subtext}
                    />
                    <Text style={styles.emptyTitle}>Start a conversation</Text>
                    <Text style={styles.empty}>
                      Ask about available services, houses, pricing, or moving details.
                    </Text>
                  </View>
                ) : (
                  messages.map((m) => {
                    const mine = String(m.sender_id) === String(currentUserId);
                    return (
                      <View
                        key={m.message_id}
                        style={[
                          styles.bubble,
                          mine ? styles.bubbleMine : styles.bubbleTheirs,
                        ]}
                      >
                        <Text
                          style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                        >
                          {m.message}
                        </Text>
                        <Text
                          style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}
                        >
                          {formatTime(m.created_at)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            {/* ── Input ── */}
            <View
              style={[
                styles.inputRow,
                sheetMaxHeight != null && styles.inputRowKeyboard,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#9CA3AF"
                value={draft}
                onChangeText={setDraft}
                multiline
                onFocus={() =>
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
                }
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!draft.trim() || sending) && styles.sendBtnDisabled,
                ]}
                onPress={sendMessage}
                disabled={!draft.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    minHeight: "62%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF4ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.orange,
  },
  avatarText: { fontWeight: "800", color: C.orange, fontSize: 16 },
  landlordName: { fontSize: 16, fontWeight: "800", color: C.text },
  landlordMeta: { fontSize: 12, color: C.subtext, marginTop: 2, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginTop: 8,
  },
  empty: {
    textAlign: "center",
    color: C.subtext,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: C.orange,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: C.theirBubble,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: C.text, lineHeight: 21 },
  bubbleTextMine: { color: C.white },
  bubbleTime: {
    fontSize: 10,
    color: C.subtext,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTimeMine: { color: "rgba(255,255,255,0.65)" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
    backgroundColor: C.white,
  },
  inputRowKeyboard: {
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
});