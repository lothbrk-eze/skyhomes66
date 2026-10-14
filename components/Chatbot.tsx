import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Animated,
  Image,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { router } from "expo-router";
import {
  ChatProperty,
  SKYHOMESAI_QUICK_PROMPTS,
  getDisplayPrice,
  getPropertyImage,
  isSaleListing,
  processSkyHomesAIMessage,
} from "../lib/skyhomesaiSearch";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const EDGE = 12;
const HIT_PAD = 14;
const FAB_ESTIMATE = { width: 72, height: 72 };
const PAN_MIN_DISTANCE = 3;

const COLORS = {
  accent: "#FF5722",
  accentLight: "#FF7043",
  accentGlow: "rgba(255, 87, 34, 0.18)",
  black: "#0D0D0D",
  white: "#FFFFFF",
  bg: "#F8F9FC",
  surface: "#FFFFFF",
  text: "#1A1D23",
  subtext: "#9299A6",
  mutedText: "#C4CAD4",
  line: "#ECEEF4",
  lineStrong: "#D8DCE6",
  userBubble: "#1A1D23",
  botBubble: "#FFFFFF",
  inputBg: "#F2F4F8",
  headerBg: "#FFFFFF",
  shadow: "rgba(0, 0, 0, 0.12)",
  fabShadow: "rgba(255, 87, 34, 0.4)",
};

type Message = { sender: "user" | "bot"; text: string; houses?: ChatProperty[] };

const API_URL = "https://bombadir.pythonanywhere.com";
const PLACEHOLDER_IMG = "https://via.placeholder.com/120x90.png?text=Home";

type ChatbotProps = {
  bottomOffset?: number;
};

const WELCOME =
  "Hi! I'm SkyHomesAI — ask me to find homes by area, budget, rent or sale, or near schools and main roads. Try a quick suggestion below.";

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.subtext,
    marginHorizontal: 2,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
};

const Chatbot = ({ bottomOffset = 20 }: ChatbotProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [container, setContainer] = useState({ w: SCREEN_WIDTH, h: 500 });
  const [fabSize, setFabSize] = useState(FAB_ESTIMATE);
  const [isTyping, setIsTyping] = useState(false);
  const [properties, setProperties] = useState<ChatProperty[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(1)).current;

  const bounds = useMemo(
    () => ({
      minX: EDGE,
      maxX: Math.max(EDGE, container.w - fabSize.width - EDGE),
      minY: EDGE,
      maxY: Math.max(EDGE, container.h - fabSize.height - bottomOffset - EDGE),
    }),
    [bottomOffset, container.h, container.w, fabSize.height, fabSize.width]
  );

  const defaultPos = useMemo(
    () => ({ x: bounds.maxX, y: bounds.maxY }),
    [bounds.maxX, bounds.maxY]
  );

  const [pos, setPos] = useState(defaultPos);
  const posRef = useRef(pos);
  const dragStartRef = useRef(pos);
  const draggedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const placedRef = useRef(false);

  const clampPos = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, bounds.minX, bounds.maxX),
      y: clamp(y, bounds.minY, bounds.maxY),
    }),
    [bounds]
  );

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  useEffect(() => {
    if (!placedRef.current && container.h > 100) {
      placedRef.current = true;
      setPos(defaultPos);
    }
  }, [container.h, defaultPos]);

  useEffect(() => {
    setPos((p) => clampPos(p.x, p.y));
  }, [clampPos]);

  useEffect(() => {
    if (isOpen) {
      Animated.spring(panelAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      panelAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setContainer({ w: width, h: height });
  };

  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(show, (ev) => setKeyboardHeight(ev.endCoordinates.height));
    const s2 = Keyboard.addListener(hide, () => setKeyboardHeight(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const fetchListings = useCallback(async () => {
    try {
      setLoadingListings(true);
      const res = await axios.get(`${API_URL}/api/getproperties`);
      const data = Array.isArray(res.data) ? res.data : res.data?.properties || [];
      setProperties(data);
    } catch {
      setProperties([]);
    } finally {
      setLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && properties.length === 0 && !loadingListings) {
      fetchListings();
    }
  }, [isOpen, properties.length, loadingListings, fetchListings]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{ sender: "bot", text: WELCOME }]);
    }
    if (properties.length === 0) fetchListings();
  }, [hasGreeted, properties.length, fetchListings]);

  const onFabTap = useCallback(() => {
    if (!isOpenRef.current) openChat();
  }, [openChat]);

  const onDragStart = useCallback(() => {
    draggedRef.current = false;
    dragStartRef.current = posRef.current;
  }, []);

  const onDragMove = useCallback(
    (tx: number, ty: number) => {
      draggedRef.current = true;
      setPos(clampPos(dragStartRef.current.x + tx, dragStartRef.current.y + ty));
    },
    [clampPos]
  );

  const onDragEnd = useCallback(() => { draggedRef.current = false; }, []);

  const fabGesture = useMemo(() => {
    const tap = Gesture.Tap().maxDuration(320).maxDistance(22).onEnd(() => { runOnJS(onFabTap)(); });
    const pan = Gesture.Pan()
      .minDistance(PAN_MIN_DISTANCE)
      .onBegin(() => { runOnJS(onDragStart)(); })
      .onUpdate((e) => { runOnJS(onDragMove)(e.translationX, e.translationY); })
      .onEnd(() => { runOnJS(onDragEnd)(); });
    return Gesture.Exclusive(pan, tap);
  }, [onDragEnd, onDragMove, onDragStart, onFabTap]);

  const pushBotReply = useCallback(
    (userText: string) => {
      const result = processSkyHomesAIMessage(userText, properties);
      setMessages((m) => [
        ...m,
        { sender: "bot", text: result.text, houses: result.houses },
      ]);
    },
    [properties]
  );

  const submitMessage = (textOverride?: string) => {
    const t = (textOverride ?? input).trim();
    if (!t) return;
    setMessages((m) => [...m, { sender: "user", text: t }]);
    setInput("");
    setIsTyping(true);
    const delay = properties.length > 0 ? 700 : 1400;
    setTimeout(() => {
      setIsTyping(false);
      if (properties.length === 0) {
        setMessages((m) => [
          ...m,
          {
            sender: "bot",
            text: "I'm still loading listings. Please send your question again in a moment.",
          },
        ]);
        fetchListings();
        return;
      }
      pushBotReply(t);
    }, delay);
  };

  const openHouseDetails = (propertyId: number | string) => {
    setIsOpen(false);
    Keyboard.dismiss();
    router.push({ pathname: "/house-details", params: { id: String(propertyId) } });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages, isOpen, keyboardHeight, isTyping]);

  const panelW = Math.min(container.w - 24, 340);
  const panelH = Math.min(480, container.h * 0.62);
  const panelLeft = clamp(pos.x + fabSize.width - panelW, EDGE, container.w - panelW - EDGE);
  const above = pos.y > container.h * 0.42;

  const panelStyle =
    keyboardHeight > 0
      ? {
        left: EDGE,
        width: container.w - EDGE * 2,
        bottom: Math.min(keyboardHeight, container.h * 0.55) + bottomOffset,
      }
      : above
        ? { top: Math.max(EDGE, pos.y - panelH - 12), left: panelLeft, width: panelW }
        : { top: pos.y + fabSize.height + 12, left: panelLeft, width: panelW };

  const panelAnimStyle = {
    opacity: panelAnim,
    transform: [
      {
        translateY: panelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [above ? 12 : -12, 0],
        }),
      },
      {
        scale: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
      },
    ],
  };

  const renderHouseCards = (houses: ChatProperty[]) => (
    <View style={styles.houseCardsWrap}>
      {houses.map((house) => {
        const img = getPropertyImage(house.images) || PLACEHOLDER_IMG;
        const sale = isSaleListing(house);
        const { amount, label } = getDisplayPrice(house);
        const loc = house.address || house.location || "Location not listed";
        return (
          <TouchableOpacity
            key={String(house.property_id)}
            style={styles.houseCard}
            activeOpacity={0.88}
            onPress={() => openHouseDetails(house.property_id)}
          >
            <Image source={{ uri: img }} style={styles.houseCardImg} />
            <View style={styles.houseCardBody}>
              <Text style={styles.houseCardTitle} numberOfLines={1}>
                {house.title || "Property"}
              </Text>
              <View style={styles.houseCardLocRow}>
                <Ionicons name="location-outline" size={12} color={COLORS.subtext} />
                <Text style={styles.houseCardLoc} numberOfLines={1}>
                  {loc}
                </Text>
              </View>
              <View style={styles.houseCardFooter}>
                {sale ? (
                  <View style={styles.salePill}>
                    <Text style={styles.salePillText}>For Sale</Text>
                  </View>
                ) : amount > 0 ? (
                  <Text style={styles.houseCardPrice}>
                    KES {amount.toLocaleString()}
                    <Text style={styles.houseCardPriceSub}>{label}</Text>
                  </Text>
                ) : (
                  <Text style={styles.houseCardPriceSub}>View details</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View
      style={styles.floatLayer}
      pointerEvents="box-none"
      onLayout={onContainerLayout}
      collapsable={false}
    >
      {isOpen && (
        <KeyboardAvoidingView
          behavior={keyboardHeight > 0 ? undefined : Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.panelWrap, panelStyle]}
          pointerEvents="auto"
        >
          <Animated.View style={[styles.panel, { height: panelH }, panelAnimStyle]}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>H</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.panelTitle}>SkyHomesAI</Text>
                  <Text style={styles.panelSubtitle}>Smart Home Assistant · Online</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setIsOpen(false); Keyboard.dismiss(); }}
                hitSlop={12}
              >
                <Ionicons name="close" size={18} color={COLORS.subtext} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesInner}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {messages.length <= 1 && (
                <View style={styles.quickPromptsWrap}>
                  {SKYHOMESAI_QUICK_PROMPTS.map((prompt: string) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.quickPromptChip}
                      onPress={() => submitMessage(prompt)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.quickPromptText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {loadingListings && (
                <Text style={styles.loadingListingsText}>Loading listings…</Text>
              )}

              {messages.map((m, i) => (
                <View key={`msg-${i}`}>
                  <View
                    style={[styles.msgRow, m.sender === "bot" ? styles.rowBot : styles.rowUser]}
                  >
                    {m.sender === "bot" && (
                      <View style={styles.botAvatarSmall}>
                        <Text style={styles.botAvatarSmallText}>H</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        m.sender === "bot" ? styles.bubbleBot : styles.bubbleUser,
                        m.houses && m.houses.length > 0 && styles.bubbleWide,
                      ]}
                    >
                      <Text style={m.sender === "bot" ? styles.textBot : styles.textUser}>
                        {m.text}
                      </Text>
                    </View>
                  </View>
                  {m.sender === "bot" && m.houses && m.houses.length > 0 && (
                    <View style={styles.houseCardsRow}>{renderHouseCards(m.houses)}</View>
                  )}
                </View>
              ))}

              {isTyping && (
                <View style={[styles.msgRow, styles.rowBot]}>
                  <View style={styles.botAvatarSmall}>
                    <Text style={styles.botAvatarSmallText}>H</Text>
                  </View>
                  <View style={[styles.bubble, styles.bubbleBot]}>
                    <TypingDots />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => submitMessage()}
                placeholder="Ask SkyHomesAI anything..."
                placeholderTextColor={COLORS.mutedText}
                returnKeyType="send"
                selectionColor={COLORS.accent}
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]}
                onPress={() => submitMessage()}
                disabled={!input.trim()}
              >
                <Ionicons name="arrow-up" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {/* FAB */}
      {!isOpen && (
        <View style={[styles.fabWidget, { left: pos.x, top: pos.y }]} pointerEvents="box-none">
          <GestureDetector gesture={fabGesture}>
            <Animated.View
              style={[styles.fabTouchArea, { transform: [{ scale: fabAnim }] }]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) setFabSize({ width, height });
              }}
            >
              <View style={styles.fabGlow}>
                <View style={styles.fab}>
                  <Text style={styles.fabH}>H</Text>
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
          <View style={styles.fabLabelBelow} pointerEvents="none">
            <View style={styles.fabLabelPill}>
              <View style={styles.fabPulse} />
              <Text style={styles.fabLabel}>skyhomesai</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  floatLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  panelWrap: {
    position: "absolute",
    zIndex: 60,
    elevation: 60,
  },
  panel: {
    flexDirection: "column",
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    elevation: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },

  // Header
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  panelHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRing: { position: "relative" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarLetter: { fontSize: 15, fontWeight: "900", color: COLORS.white, lineHeight: 18 },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  headerTextCol: { gap: 1 },
  panelTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text, letterSpacing: 0.1 },
  panelSubtitle: { fontSize: 11, color: COLORS.subtext, fontWeight: "500" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages
  messages: { flex: 1, minHeight: 0 },
  messagesInner: { padding: 14, gap: 10, flexGrow: 1 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowBot: { justifyContent: "flex-start" },
  rowUser: { justifyContent: "flex-end" },
  botAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  botAvatarSmallText: { fontSize: 11, fontWeight: "900", color: COLORS.white, lineHeight: 14 },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleWide: {
    maxWidth: "92%",
  },
  lastBubble: {},
  bubbleBot: {
    backgroundColor: COLORS.botBubble,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderBottomLeftRadius: 6,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 6,
  },
  textBot: { color: COLORS.text, fontSize: 13.5, lineHeight: 20, fontWeight: "400" },
  textUser: { color: COLORS.white, fontSize: 13.5, lineHeight: 20, fontWeight: "400" },

  quickPromptsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 34,
  },
  quickPromptChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickPromptText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: COLORS.text,
  },
  loadingListingsText: {
    fontSize: 11,
    color: COLORS.subtext,
    paddingLeft: 34,
    marginBottom: 4,
  },
  houseCardsRow: {
    marginLeft: 34,
    marginBottom: 8,
    maxWidth: "100%",
  },
  houseCardsWrap: {
    gap: 8,
  },
  houseCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    maxWidth: 280,
  },
  houseCardImg: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.inputBg,
  },
  houseCardBody: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    gap: 3,
  },
  houseCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  houseCardLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  houseCardLoc: {
    flex: 1,
    fontSize: 11,
    color: COLORS.subtext,
  },
  houseCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  houseCardPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
  },
  houseCardPriceSub: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.subtext,
  },
  salePill: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  salePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.white,
  },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: COLORS.lineStrong,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 9 : 10,
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.text,
    ...(Platform.OS === "android"
      ? ({ textAlignVertical: "center" as const, includeFontPadding: false } as const)
      : {}),
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.fabShadow,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sendBtnOff: { opacity: 0.35, shadowOpacity: 0 },

  // FAB
  fabWidget: {
    position: "absolute",
    zIndex: 70,
    elevation: 70,
    alignItems: "center",
  },
  fabTouchArea: {
    padding: HIT_PAD,
    minWidth: 48 + HIT_PAD * 2,
    minHeight: 48 + HIT_PAD * 2,
    justifyContent: "center",
    alignItems: "center",
  },
  fabGlow: {
    borderRadius: 27,
    shadowColor: COLORS.fabShadow,
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.black,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  fabH: { fontSize: 22, fontWeight: "900", color: COLORS.white, lineHeight: 26 },
  fabLabelBelow: {
    marginTop: -10,
    alignItems: "center",
  },
  fabLabelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  fabPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#22C55E",
  },
  fabLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: COLORS.text,
  },
});

export default Chatbot;