import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import VideoPreview from "./VideoPreview";
// import AdBanner from "./BannerAd"; // Ads disabled for now
// import Chatbot from "./Chatbot"; // SkyHomesAI chatbot — disabled for now
import { WebView } from "react-native-webview";
import {
  formatKesPrice,
  parseAmount,
  resolveListingKind,
} from "../lib/skyhomesaiSearch";
import { useSubscription } from "../hooks/useSubscription";
import { canUserViewProperty } from "../lib/subscriptionUtils";
import SubscriptionModal from "./SubscriptionModal";

const API_URL = "https://bombadir.pythonanywhere.com";
const IMAGE_BASE_URL = "https://bombadir.pythonanywhere.com/static/images/";
const { width, height } = Dimensions.get("window");

type MediaItem =
  | { type: "image"; uri: string }
  | { type: "video"; uri: string };

const COLORS = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#0F172A",
  subtext: "#4B6CB7",
  muted: "#7BA4D4",
  border: "#DBEAFE",
  soft: "#EFF6FF",
  overlay: "rgba(255,255,255,0.96)",
  darkOverlay: "rgba(11,20,38,0.45)",
  accent: "#2563EB",
  accentSoft: "#EFF6FF",
  success: "#16A34A",
  teal: "#0F766E",
  tealSoft: "#CCFBF1",
  white: "#FFFFFF",
  black: "#0B1426",
  mapBorder: "#DBEAFE",
  shadow: "#1E40AF",
};

function safeNormalizeUrl(value: any) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  return str.startsWith("http") ? str : `${IMAGE_BASE_URL}${str}`;
}

function parseImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.map(safeNormalizeUrl).filter(Boolean);
  }
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        return parsed.map(safeNormalizeUrl).filter(Boolean);
      }
    } catch { }
    return images
      .split(",")
      .map((item) => safeNormalizeUrl(item))
      .filter(Boolean);
  }
  return [];
}

function parseAmenities(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { }
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizePhone(phone: string) {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
  if (cleaned.startsWith("7") || cleaned.startsWith("1")) return `254${cleaned}`;
  return cleaned;
}

function getAgentInitials(name: string): string {
  if (!name) return "AG";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// ── APPLICATION MODAL ──────────────────────────────────────────────────────────
interface ApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  property: any;
  loggedUser: any;
}

function ApplyModal({ visible, onClose, onSuccess, property, loggedUser }: ApplyModalProps) {
  const [name, setName] = useState(loggedUser?.username ?? "");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(loggedUser?.phone ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSaleListing = resolveListingKind(property) === "sale";
  const salePrice = parseAmount(property?.sale_price);
  const rentPrice = parseAmount(property?.monthly_rent);
  const priceText = isSaleListing
    ? formatKesPrice(salePrice)
    : formatKesPrice(rentPrice, "Rent on request");
  const priceLabel = isSaleListing ? "sale price" : "/month";

  useEffect(() => {
    setName(loggedUser?.username ?? "");
    setPhone(loggedUser?.phone ?? "");
  }, [loggedUser]);

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert("Missing fields", "Please fill in your name, address and phone number.");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("user_id", String(loggedUser.user_id));
      formData.append("house_id", String(property.property_id));
      formData.append("name", name.trim());
      formData.append("address", address.trim());
      formData.append("phone", phone.trim());
      formData.append("reason", reason.trim());

      const response = await axios.post(`${API_URL}/api/applyhouse`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Application sent", response.data?.message || "Applied successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to submit application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={modalStyles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={modalStyles.backdropTap} activeOpacity={1} onPress={onClose} />

        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.headerTitle}>
                {isSaleListing ? "Express Interest" : "Apply for House"}
              </Text>
              <Text style={modalStyles.headerSub} numberOfLines={1}>
                {property?.title || "Property"}
              </Text>
            </View>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={modalStyles.body}
            contentContainerStyle={modalStyles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[modalStyles.priceReminder, isSaleListing && modalStyles.priceReminderSale]}>
              <Ionicons name="home" size={16} color={isSaleListing ? COLORS.teal : COLORS.accent} />
              <Text style={[modalStyles.priceReminderText, isSaleListing && modalStyles.priceReminderTextSale]}>
                {priceText}
                {!isSaleListing && (
                  <Text style={modalStyles.priceReminderSub}> {priceLabel}</Text>
                )}
              </Text>
            </View>

            <View style={modalStyles.fieldGroup}>
              <ModalField
                label="Full Name"
                icon="person-outline"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Jane Doe"
              />
              <ModalField
                label="Current Address"
                icon="location-outline"
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Westlands, Nairobi"
              />
              <ModalField
                label="Phone Number"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 0712 345 678"
                keyboardType="phone-pad"
              />
              <ModalField
                label={isSaleListing ? "Reason for Interest (optional)" : "Reason for Moving (optional)"}
                icon="chatbubble-ellipses-outline"
                value={reason}
                onChangeText={setReason}
                placeholder={
                  isSaleListing
                    ? "Tell the agent why you're interested in buying…"
                    : "Tell the landlord why you're a great tenant…"
                }
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[
                modalStyles.submitBtn,
                isSaleListing && modalStyles.submitBtnSale,
                submitting && modalStyles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={COLORS.white} />
                  <Text style={modalStyles.submitBtnText}>
                    {isSaleListing ? "Submit Interest" : "Submit Application"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={modalStyles.disclaimer}>
              By submitting, you agree to be contacted by the agent.{" "}
              {isSaleListing
                ? "Inquiries are reviewed within 24 hours."
                : "Applications are reviewed within 24 hours."}
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ModalFieldProps {
  label: string;
  icon: any;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  numberOfLines?: number;
}

function ModalField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  numberOfLines = 1,
}: ModalFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={modalStyles.fieldWrap}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      <View style={[modalStyles.inputRow, focused && modalStyles.inputRowFocused, multiline && modalStyles.inputRowMulti]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? COLORS.accent : COLORS.muted}
          style={multiline ? { marginTop: 2 } : undefined}
        />
        <TextInput
          style={[modalStyles.input, multiline && modalStyles.inputMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.92,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "500",
    marginTop: 2,
    maxWidth: width * 0.65,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 22 },
  bodyContent: { paddingTop: 18, paddingBottom: 8 },

  priceReminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "#FDDCC9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  priceReminderSale: {
    backgroundColor: COLORS.tealSoft,
    borderColor: "#99F6E4",
  },
  priceReminderText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.accent,
  },
  priceReminderTextSale: {
    color: COLORS.teal,
  },
  priceReminderSub: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.accent,
  },
  priceReminderSubSale: {
    color: COLORS.teal,
  },

  fieldGroup: { gap: 16, marginBottom: 24 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: COLORS.soft,
  },
  inputRowFocused: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.white,
  },
  inputRowMulti: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
    padding: 0,
  },
  inputMulti: {
    minHeight: 90,
  },

  submitBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  submitBtnSale: {
    backgroundColor: COLORS.teal,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  disclaimer: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
});

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function HouseDetails() {
  const { id, hideActions } = useLocalSearchParams<{
    id?: string;
    hideActions?: string;
  }>();

  const { isPremium, loading: subscriptionLoading, refreshSubscription } = useSubscription();
  const [property, setProperty] = useState<any>(null);
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [isEarlyAccessLocked, setIsEarlyAccessLocked] = useState(false);
  const hasPromptedPaywall = useRef(false);

  const paywallContext = useMemo(() => {
    if (loggedUser?.role === "realtor") return "realtor_signup";
    if (loggedUser?.role === "landlord") return "listing_boost";
    return "tenant_premium";
  }, [loggedUser?.role]);

  // Prompt the paywall when user navigates to house details (if user is not subscribed)
  useEffect(() => {
    if (loading || subscriptionLoading || !property) return;
    if (!isPremium && !hasPromptedPaywall.current) {
      hasPromptedPaywall.current = true;
      const timer = setTimeout(() => {
        setPaywallVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isPremium, subscriptionLoading, property]);

  const scrollRef = useRef<ScrollView>(null);
  const mapWebRef = useRef<WebView | null>(null);

  const mediaItems = useMemo<MediaItem[]>(() => {
    if (!property) return [];
    const images = parseImages(property.images).map((uri) => ({
      type: "image" as const,
      uri,
    }));
    const videoTour = safeNormalizeUrl(
      property.video_tour || property.video || property.video_url
    );
    if (videoTour) {
      return [...images, { type: "video", uri: videoTour }];
    }
    return images;
  }, [property]);

  const firstVideoUri = useMemo(() => {
    const found = mediaItems.find((item) => item.type === "video");
    return found?.uri || null;
  }, [mediaItems]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const savedUser = await AsyncStorage.getItem("user");
        const savedUserName = await AsyncStorage.getItem("username");
        const savedRole = await AsyncStorage.getItem("role");
        const savedEmail = await AsyncStorage.getItem("email");
        const savedPhone = await AsyncStorage.getItem("phone");

        let normalizedUser: any = null;

        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const user = parsedUser?.user ? parsedUser.user : parsedUser;
          normalizedUser = {
            user_id: user?.user_id ?? user?.id ?? null,
            username: user?.username ?? savedUserName ?? "",
            email: user?.email ?? savedEmail ?? "",
            phone: user?.phone ?? savedPhone ?? "",
            role: user?.role ?? savedRole ?? "",
          };
        } else if (savedUserName || savedEmail || savedPhone) {
          normalizedUser = {
            user_id: null,
            username: savedUserName ?? "",
            email: savedEmail ?? "",
            phone: savedPhone ?? "",
            role: savedRole ?? "",
          };
        }

        setLoggedUser(normalizedUser);

        if (!id) {
          Alert.alert("Missing property", "Property ID was not provided.");
          router.back();
          return;
        }

        const response = await axios.get(`${API_URL}/api/getproperties/${id}`);
        const propertyData = response.data?.property ?? response.data;

        // 3-hour Early Access: during the first 3 hours, listing is hidden from free tenants & guests
        const createdAt = propertyData?.created_at || propertyData?.date_added || propertyData?.created;
        if (!canUserViewProperty(createdAt, normalizedUser?.role, isPremium)) {
          setIsEarlyAccessLocked(true);
          setProperty(propertyData);
          setPaywallVisible(true);
          hasPromptedPaywall.current = true;
          return;
        }

        setProperty(propertyData);

        if (normalizedUser?.user_id) {
          const formData = new FormData();
          formData.append("user_id", String(normalizedUser.user_id));

          try {
            const savedResponse = await axios.post(
              `${API_URL}/api/my_saved_houses`,
              formData,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            const savedList = Array.isArray(savedResponse.data)
              ? savedResponse.data
              : savedResponse.data?.houses || [];
            setIsSaved(
              savedList.some((item: any) => String(item.property_id) === String(id))
            );
          } catch (error) {
            console.log("Saved house check error:", error);
          }

          try {
            const applyForm = new FormData();
            applyForm.append("property_id", String(id));
            applyForm.append("user_id", String(normalizedUser.user_id));
            const appliedResponse = await axios.post(
              `${API_URL}/api/my_house_applications`,
              applyForm,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            const applications = Array.isArray(appliedResponse.data)
              ? appliedResponse.data
              : appliedResponse.data?.applications || [];
            setHasApplied(
              applications.some((item: any) => String(item.property_id) === String(id))
            );
          } catch (error) {
            console.log("Application check error:", error);
          }
        }
      } catch (err: any) {
        console.log("House details error:", err?.response?.data || err);
        Alert.alert(
          "Error",
          err?.response?.data?.message || "Failed to load property details"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const onMediaScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const handleShare = async () => {
    try {
      if (!property) return;
      const isSale = resolveListingKind(property) === "sale";
      const salePrice = parseAmount(property.sale_price);
      const rentPrice = parseAmount(property.monthly_rent);
      const price = isSale
        ? `${formatKesPrice(salePrice)} (for sale)`
        : `${formatKesPrice(rentPrice, "Rent on request")}/month`;
      await Share.share({
        message: `${property.title || "Property"}\n${property.address || property.location || ""}\n${price}`,
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleSaveHouse = async () => {
    try {
      if (!loggedUser?.user_id) {
        Alert.alert("Login required", "Please login first to save this house.");
        return;
      }
      if (!property?.property_id) return;
      setActionLoading(true);
      const formData = new FormData();
      formData.append("user_id", String(loggedUser.user_id));
      formData.append("property_id", String(property.property_id));
      if (isSaved) {
        const response = await axios.post(
          `${API_URL}/api/remove_saved_house`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        setIsSaved(false);
        Alert.alert("Removed", response.data?.message || "Removed from saved");
      } else {
        const response = await axios.post(`${API_URL}/api/save_house`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setIsSaved(true);
        Alert.alert("Saved", response.data?.message || "House saved successfully");
      }
    } catch (err: any) {
      console.log("Save house error:", err?.response?.data || err);
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to update saved house"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyPress = () => {
    if (!loggedUser?.user_id) {
      Alert.alert("Login required", "Please login first to apply for this house.");
      return;
    }
    if (hasApplied) return;
    setApplyModalVisible(true);
  };

  const contactPhone =
    property?.agent_phone_number ||
    property?.landlord_number ||
    property?.landlord_phone ||
    "";

  const handleCallAgent = async () => {
    const normalized = normalizePhone(contactPhone);
    if (!normalized) {
      Alert.alert("Unavailable", "No phone number available for this agent.");
      return;
    }
    const url = `tel:+${normalized}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unavailable", "Calling is not supported on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not start a phone call.");
    }
  };

  const handleWhatsApp = async () => {
    const normalized = normalizePhone(contactPhone);
    if (!normalized) {
      Alert.alert("Unavailable", "No phone number available for this agent.");
      return;
    }
    const url = `https://wa.me/${normalized}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Error", "WhatsApp could not be opened on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const amenities = useMemo(
    () =>
      parseAmenities(
        property?.amenities ||
        property?.features ||
        property?.utilities_breakdown ||
        ""
      ),
    [property]
  );

  const latitude = Number(property?.latitude);
  const longitude = Number(property?.longitude);
  const hasValidCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0;

  const openInExternalMap = () => {
    const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
    Linking.openURL(url);
  };

  const mapHtml = useMemo(() => {
    if (!hasValidCoordinates) return "";
    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F8FAFC; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function() {
        const lat = ${latitude};
        const lng = ${longitude};
        const title = ${JSON.stringify(String(property?.title || "Property"))};
        const address = ${JSON.stringify(String(property?.address || property?.location || ""))};
        const map = L.map('map', { zoomControl: false, dragging: true, scrollWheelZoom: false }).setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        const m = L.marker([lat, lng]).addTo(map);
        if (address) m.bindPopup('<b>' + title + '</b><br/>' + address);
      })();
    </script>
  </body>
</html>`;
  }, [hasValidCoordinates, latitude, longitude, property?.title, property?.address, property?.location]);

  const agentName = property?.agent_name || property?.landlord_name || "Agent";

  // ── listing_type + sale_price / monthly_rent from GET /api/getproperties/:id ──
  const isSaleListing = resolveListingKind(property) === "sale";
  const salePrice = parseAmount(property?.sale_price);
  const rentPrice = parseAmount(property?.monthly_rent);
  const priceLabel = isSaleListing ? "sale price" : "per month";
  const overviewPriceText = isSaleListing
    ? formatKesPrice(salePrice)
    : formatKesPrice(rentPrice, "Rent on request");
  const footerPriceText = overviewPriceText;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading property details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isEarlyAccessLocked && !isPremium) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={COLORS.accent} />
          <Text style={[styles.emptyText, { marginTop: 16, textAlign: "center" }]}>
            Early Access Listing
          </Text>
          <Text
            style={{
              color: COLORS.subtext,
              textAlign: "center",
              marginTop: 8,
              marginHorizontal: 24,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            This property is currently in its 3-hour Early Access window for Premium Tenants. Upgrade to Premium or activate your 14-day free trial to view this property now.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              marginTop: 20,
            }}
            onPress={() => setPaywallVisible(true)}
          >
            <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 15 }}>
              Unlock with Premium
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 14, padding: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: COLORS.subtext, fontSize: 14, fontWeight: "600" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
        <SubscriptionModal
          visible={paywallVisible}
          context={paywallContext}
          requireSubscription={false}
          onClose={() => setPaywallVisible(false)}
          onLater={() => setPaywallVisible(false)}
          onSubscribed={async () => {
            setPaywallVisible(false);
            setIsEarlyAccessLocked(false);
            await refreshSubscription();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Property not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMedia = mediaItems[currentIndex];
  const totalMedia = mediaItems.length;

  // ── OVERVIEW ROWS ──
  // Sale listings: Type, Listing, Sale Price, Units Available, Status
  // Rent listings: Type, Listing, Monthly Rent, Deposit, Lease Duration (if set), Units Available, Status
  const overviewRows = [
    {
      icon: "home-outline" as const,
      label: "Type",
      value: property.property_type || "House",
    },
    {
      icon: "pricetag-outline" as const,
      label: "Listing",
      value: isSaleListing ? " sale" : "For rent",
    },
    ...(isSaleListing
      ? [
        {
          icon: "cash-outline" as const,
          label: "Sale Price",
          value: formatKesPrice(salePrice),
        },
      ]
      : [
        {
          icon: "wallet-outline" as const,
          label: "Monthly Rent",
          value: formatKesPrice(rentPrice, "Rent on request"),
        },
        {
          icon: "cash-outline" as const,
          label: "Deposit",
          value: `KES ${Number(property.deposit_amount || 0).toLocaleString()}`,
        },
        ...(property.lease_duration
          ? [
            {
              icon: "calendar-outline" as const,
              label: "Lease Duration",
              value: String(property.lease_duration),
            },
          ]
          : []),
      ]),
    {
      icon: "layers-outline" as const,
      label: "Units Available",
      value: String(property.units_available ?? property.available_units ?? 0),
    },
    {
      icon: "checkmark-circle-outline" as const,
      label: "Status",
      value: property.availability_status || "Available",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO MEDIA ── */}
        <View style={styles.heroSection}>
          {mediaItems.length > 0 ? (
            <>
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onMediaScroll}
                scrollEventThrottle={16}
              >
                {mediaItems.map((item, index) => (
                  <View key={`${item.type}-${index}`} style={styles.mediaSlide}>
                    {item.type === "image" ? (
                      <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                    ) : item.type === "video" && firstVideoUri ? (
                      <View style={styles.videoWrap}>
                        <VideoPreview
                          uri={item.uri}
                          style={styles.video}
                          nativeControls
                          contentFit="contain"
                          loop={false}
                          shouldPlay={index === currentIndex}
                        />
                        <View style={styles.videoBadge}>
                          <Ionicons name="videocam" size={14} color={COLORS.white} />
                          <Text style={styles.videoBadgeText}>Video Tour</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noMedia}>
                        <Ionicons name="videocam-outline" size={42} color={COLORS.muted} />
                        <Text style={styles.noMediaText}>Video preview available</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.floatingCircleBtn, styles.backButton]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={22} color={COLORS.black} />
              </TouchableOpacity>

              <View style={styles.topRightButtons}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.floatingCircleBtn}
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={22} color={COLORS.black} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.floatingCircleBtn}
                  onPress={handleSaveHouse}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Ionicons
                      name={isSaved ? "heart" : "heart-outline"}
                      size={22}
                      color={isSaved ? COLORS.accent : COLORS.black}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {!!totalMedia && (
                <View style={styles.mediaCounter}>
                  <Text style={styles.mediaCounterText}>
                    {currentIndex + 1} / {totalMedia}
                  </Text>
                </View>
              )}

              {currentMedia?.type === "video" && (
                <View style={styles.videoBottomHint}>
                  <Ionicons name="play-circle" size={16} color={COLORS.white} />
                  <Text style={styles.videoBottomHintText}>Swipe back for photos</Text>
                </View>
              )}

              {isSaleListing && (
                <View style={styles.saleHeroBadge}>
                  <Ionicons name="pricetag" size={13} color={COLORS.white} />
                  <Text style={styles.saleHeroBadgeText}>For Sale</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noMedia}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.floatingCircleBtn, styles.backButton]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={22} color={COLORS.black} />
              </TouchableOpacity>
              <Ionicons name="image-outline" size={42} color={COLORS.muted} />
              <Text style={styles.noMediaText}>No media available</Text>
            </View>
          )}
        </View>

        {/* ── CONTENT SHEET ── */}
        <View style={styles.contentSheet}>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{property.title || "Untitled Property"}</Text>
            <Text style={styles.subtitle}>
              {property.property_type || "Property"} in{" "}
              {property.address || property.location || "Location not available"}
            </Text>
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingCol}>
              <Text style={styles.ratingBig}>4.9</Text>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name="star" size={12} color={COLORS.accent} />
                ))}
              </View>
            </View>

            <View style={styles.ratingDivider} />

            <View style={styles.ratingCenterCol}>
              <Ionicons name="sparkles-outline" size={20} color={COLORS.accent} />
              <Text style={styles.ratingCenterText}>Premium choice</Text>
            </View>

            <View style={styles.ratingDivider} />

            <View style={styles.ratingCol}>
              <Text style={styles.ratingBig}>120</Text>
              <Text style={styles.ratingSmallLink}>Reviews</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property overview</Text>
            <View style={styles.overviewList}>
              {overviewRows.map((row, index) => (
                <View
                  key={row.label}
                  style={[
                    styles.overviewRow,
                    index < overviewRows.length - 1 && styles.overviewRowBorder,
                  ]}
                >
                  <View style={styles.overviewRowLeft}>
                    <View style={[
                      styles.overviewIconWrap,
                      row.label === "Sale Price" && styles.overviewIconWrapSale,
                    ]}>
                      <Ionicons
                        name={row.icon}
                        size={16}
                        color={row.label === "Sale Price" ? COLORS.teal : COLORS.accent}
                      />
                    </View>
                    <Text style={styles.overviewLabel}>{row.label}</Text>
                  </View>
                  <Text style={[
                    styles.overviewValue,
                    row.label === "Sale Price" && styles.overviewValueSale,
                  ]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {property.description || "No description available."}
            </Text>
          </View>

          {amenities.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                <View style={styles.amenitiesWrap}>
                  {amenities.map((item, index) => (
                    <View key={`${item}-${index}`} style={styles.amenityChip}>
                      <Text style={styles.amenityText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.divider} />

          {/* ── CONTACT AGENT SECTION ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact agent</Text>
            <View style={styles.agentCard}>
              <View style={styles.agentHeader}>
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentAvatarText}>
                    {getAgentInitials(agentName)}
                  </Text>
                </View>
                <View style={styles.agentInfo}>
                  <View style={styles.agentBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={COLORS.white} />
                    <Text style={styles.agentBadgeText}>Licensed Agent</Text>
                  </View>
                  <Text style={styles.agentName}>{agentName}</Text>
                  <Text style={styles.agentTitle}> Property Consultant </Text>
                  {contactPhone ? (
                    <Text style={styles.agentPhone}>
                      <Ionicons name="call-outline" size={12} color={COLORS.muted} />{" "}
                      {contactPhone}
                    </Text>
                  ) : null}
                </View>
              </View>

              {hideActions !== "true" && (
                <View style={styles.contactActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, styles.callBtn, styles.contactActionBtn]}
                    onPress={handleCallAgent}
                    disabled={actionLoading || !contactPhone}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="call" size={18} color={COLORS.white} />
                    <Text style={styles.secondaryBtnText}>Call agent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, styles.whatsappBtn, styles.contactActionBtn]}
                    onPress={handleWhatsApp}
                    disabled={actionLoading || !contactPhone}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                    <Text style={styles.secondaryBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {hasValidCoordinates && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={openInExternalMap}
                  style={styles.mapContainer}
                >
                  <WebView
                    ref={mapWebRef}
                    originWhitelist={["*"]}
                    source={{ html: mapHtml }}
                    style={styles.map}
                    javaScriptEnabled
                    domStorageEnabled
                  />
                  <View style={styles.mapOverlay}>
                    <Ionicons name="map-outline" size={20} color={COLORS.white} />
                    <Text style={styles.mapOverlayText}>Tap to open in maps</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.mapAddress}>
                  {property.address || property.location}
                </Text>
              </View>
            </>
          )}

          {/* ── INLINE APPLY / BUY SECTION ── */}
          {hideActions !== "true" && (
            <>
              <View style={styles.divider} />
              <View style={[styles.applySection, isSaleListing && styles.applySectionSale]}>
                <View style={styles.applyPriceBlock}>
                  <Text style={[styles.applyPrice, isSaleListing && styles.applyPriceSale]}>
                    {footerPriceText}
                  </Text>
                  {!isSaleListing && <Text style={styles.applyPriceSub}>{priceLabel}</Text>}
                </View>
                <View style={styles.applyAvailRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isSaleListing ? COLORS.teal : COLORS.success}
                  />
                  <Text style={[styles.applyAvailText, isSaleListing && styles.applyAvailTextSale]}>
                    {isSaleListing ? "Available for purchase" : "Available now"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.applyBtn,
                    isSaleListing && styles.applyBtnSale,
                    hasApplied && styles.applyBtnDisabled,
                  ]}
                  onPress={handleApplyPress}
                  disabled={hasApplied}
                >
                  <Text style={styles.applyBtnText}>
                    {hasApplied
                      ? isSaleListing ? "Interest Submitted" : "Already Applied"
                      : isSaleListing ? "Express Interest to Buy" : "Apply for this House"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Ads commented out for now
          {hideActions !== "true" && (
            <View style={styles.bannerContainer}>
              <AdBanner />
            </View>
          )}
          */}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ── APPLICATION MODAL ── */}
      {property && (
        <ApplyModal
          visible={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          onSuccess={() => setHasApplied(true)}
          property={property}
          loggedUser={loggedUser}
        />
      )}

      {/* ── SUBSCRIPTION / PAYWALL MODAL ── */}
      <SubscriptionModal
        visible={paywallVisible}
        context={paywallContext}
        requireSubscription={false}
        onClose={() => setPaywallVisible(false)}
        onLater={() => setPaywallVisible(false)}
        onSubscribed={async () => {
          setPaywallVisible(false);
          setIsEarlyAccessLocked(false);
          await refreshSubscription();
        }}
      />

      {/* <Chatbot bottomOffset={24} /> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  contentContainer: { paddingBottom: 0 },

  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { color: COLORS.text, marginTop: 12, fontSize: 16, fontWeight: "600" },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: "800" },

  heroSection: {
    width: "100%",
    height: height * 0.42,
    backgroundColor: COLORS.soft,
    position: "relative",
  },
  mediaSlide: { width, height: height * 0.58, backgroundColor: "#EFEFEF" },
  mediaImage: { width: "100%", height: "100%", resizeMode: "cover" },
  videoWrap: { flex: 1, backgroundColor: COLORS.black },
  video: { width: "100%", height: "100%" },

  floatingCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 10,
  },
  backButton: { position: "absolute", top: 16, left: 16, zIndex: 10 },
  topRightButtons: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
    zIndex: 10,
  },
  mediaCounter: {
    position: "absolute",
    right: 16,
    bottom: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  mediaCounterText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  videoBadge: {
    position: "absolute",
    right: 16,
    top: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  videoBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  videoBottomHint: {
    position: "absolute",
    left: 16,
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  videoBottomHintText: { color: COLORS.white, fontSize: 13, fontWeight: "600" },
  noMedia: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.soft,
  },
  noMediaText: { color: COLORS.muted, marginTop: 10, fontSize: 14, fontWeight: "600" },

  saleHeroBadge: {
    position: "absolute",
    top: 74,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  saleHeroBadgeText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },

  contentSheet: {
    backgroundColor: COLORS.surface,
    paddingTop: 24,
    paddingHorizontal: 20,
  },

  titleBlock: { marginBottom: 20 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", lineHeight: 34 },
  subtitle: { marginTop: 8, color: COLORS.subtext, fontSize: 15, fontWeight: "500", lineHeight: 22 },

  ratingCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    marginBottom: 24,
  },
  ratingCol: { flex: 1, alignItems: "center" },
  ratingCenterCol: { flex: 1.2, alignItems: "center", justifyContent: "center", gap: 6 },
  ratingBig: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  starsRow: { flexDirection: "row", gap: 2, marginTop: 4 },
  ratingCenterText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  ratingSmallLink: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    marginTop: 4,
  },
  ratingDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  section: { paddingBottom: 4 },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800", marginBottom: 16 },

  overviewList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  overviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  overviewRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  overviewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewIconWrapSale: {
    backgroundColor: COLORS.tealSoft,
  },
  overviewLabel: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: "600",
  },
  overviewValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    maxWidth: "45%",
  },
  overviewValueSale: {
    color: COLORS.teal,
  },

  description: { color: COLORS.subtext, fontSize: 15, lineHeight: 25, fontWeight: "500" },

  amenitiesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenityChip: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amenityText: { color: COLORS.text, fontWeight: "700", fontSize: 13 },

  agentCard: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
  },
  agentHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  agentAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  agentAvatarText: { fontSize: 18, fontWeight: "900", color: COLORS.accent },
  agentInfo: { flex: 1, gap: 3 },
  agentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  agentBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  agentName: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  agentTitle: { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  agentPhone: { color: COLORS.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },

  contactActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  contactActionBtn: {
    flex: 1,
  },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  callBtn: { backgroundColor: COLORS.teal },
  whatsappBtn: { backgroundColor: COLORS.success },
  secondaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "800" },

  mapContainer: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.mapBorder,
    position: "relative",
  },
  map: { width: "100%", height: 260 },
  mapOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapOverlayText: { color: COLORS.white, fontSize: 12, fontWeight: "600" },
  mapAddress: { marginTop: 8, color: COLORS.subtext, fontSize: 14, textAlign: "center" },

  applySection: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  applySectionSale: {
    borderColor: "#99F6E4",
    backgroundColor: COLORS.tealSoft,
  },
  applyPriceBlock: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  applyPrice: { color: COLORS.text, fontSize: 26, fontWeight: "900" },
  applyPriceSale: { color: COLORS.teal },
  applyPriceSub: { color: COLORS.subtext, fontSize: 15, fontWeight: "500" },
  applyAvailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  applyAvailText: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  applyAvailTextSale: { color: COLORS.teal },
  applyBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  applyBtnSale: {
    backgroundColor: COLORS.teal,
  },
  applyBtnDisabled: { opacity: 0.65 },
  applyBtnText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },

  bannerContainer: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});