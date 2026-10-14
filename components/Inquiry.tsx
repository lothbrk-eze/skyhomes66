import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { API_URL } from "../lib/api";
import { useSubscription } from "../hooks/useSubscription";
import SubscriptionModal from "./SubscriptionModal";

const COLORS = {
  bg: "#F6F7FB",
  white: "#FFFFFF",
  black: "#111111",
  text: "#181A20",
  subtext: "#8F96A3",
  line: "#ECEEF3",
  accent: "#2563EB",
  soft: "#F3F4F6",
  success: "#1AAE60",
};

const UTILITIES = [
  "Water",
  "Electricity",
  "Wi‑Fi",
  "Parking",
  "Security",
  "Garbage collection",
  "Borehole",
  "Gym",
  "Swimming pool",
] as const;

type Utility = (typeof UTILITIES)[number];

export default function Inquiry() {
  const { isPremium, refreshSubscription } = useSubscription();
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);

  // ─── Manual Inquiry Form State ──────────────────────────────────────────────
  const [houseType, setHouseType] = useState("");
  const [roadProximity, setRoadProximity] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedUtilities, setSelectedUtilities] = useState<Utility[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // ─── Manual Form Submission Logic ───────────────────────────────────────────
  const canSubmitForm = useMemo(() => {
    return (
      houseType.trim().length > 0 &&
      roadProximity.trim().length > 0 &&
      location.trim().length > 0
    );
  }, [houseType, roadProximity, location]);

  const toggleUtility = (u: Utility) => {
    setSelectedUtilities((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  };

  const getStoredUserId = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      const storedUserId = await AsyncStorage.getItem("user_id");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const raw = parsed?.user ? parsed.user : parsed;
        return raw?.user_id || raw?.id || storedUserId || null;
      }
      return storedUserId || null;
    } catch {
      return null;
    }
  };

  const handleFormSubmit = async () => {
    if (!isPremium) {
      Alert.alert(
        "Tenant Premium Feature",
        "Only premium tenants can place custom house inquiries. Upgrade now or start your 14-day free trial to submit inquiries.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Unlock Inquiries", onPress: () => setSubscriptionModalVisible(true) },
        ]
      );
      return;
    }

    if (!canSubmitForm) {
      Alert.alert("Missing details", "Please fill house type, proximity and location.");
      return;
    }

    try {
      const userId = await getStoredUserId();
      if (!userId) {
        Alert.alert(
          "Sign in required",
          "Please sign in so we can link your inquiry and send you replies.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign in", onPress: () => router.push("/login") },
          ]
        );
        return;
      }
      const formData = new FormData();
      formData.append("houseType", houseType.trim());
      formData.append("roadProximity", roadProximity.trim());
      formData.append("location", location.trim());
      formData.append("budget", budget.trim());
      formData.append("notes", notes.trim());
      if (userId) {
        formData.append("user_id", String(userId));
      }

      selectedUtilities.forEach((u) => {
        formData.append("selectedUtilities", u);
      });

      const res = await fetch(`${API_URL}/api/inquiries`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Submission failed", data?.message || "Could not submit inquiry.");
        return;
      }

      await AsyncStorage.setItem(
        "latest_inquiry_preference",
        JSON.stringify({
          user_id: userId ? String(userId) : null,
          houseType: houseType.trim(),
          roadProximity: roadProximity.trim(),
          location: location.trim(),
          budget: budget.trim(),
          notes: notes.trim(),
          selectedUtilities,
          createdAt: new Date().toISOString(),
        })
      );

      setHouseType("");
      setRoadProximity("");
      setLocation("");
      setBudget("");
      setNotes("");
      setSelectedUtilities([]);
      setShowSuccess(true);
    } catch {
      Alert.alert("Network error", "Please check your internet and try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 30}
        style={styles.flex}
      >
        <View style={styles.topContainer}>
          <Text style={styles.headerTitle}>Submit an Inquiry</Text>
          <Text style={styles.headerSubtitle}>
            Tell us what you are looking for and we will match you with suitable properties.
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {!isPremium && (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.premiumCallout}
                onPress={() => setSubscriptionModalVisible(true)}
              >
                <View style={styles.premiumCalloutIconWrap}>
                  <Ionicons name="sparkles" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumCalloutTitle}>Tenant Premium Feature</Text>
                  <Text style={styles.premiumCalloutSub}>
                    Only premium tenants can submit custom house inquiries. Tap to unlock or try 14 days free.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.subtext} />
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              <Text style={styles.formSectionTitle}>Submit Custom Requirement</Text>
              <Text style={styles.formSectionSub}>
                Our team and partner landlords will match houses to your exact criteria.
              </Text>

              <Text style={styles.label}>Type of house</Text>
              <TextInput
                value={houseType}
                onChangeText={setHouseType}
                placeholder="e.g., Bedsitter, 1 Bedroom, 2 Bedroom"
                placeholderTextColor="#A1A7B3"
                style={styles.input}
              />

              <Text style={styles.label}>Proximity to the road</Text>
              <TextInput
                value={roadProximity}
                onChangeText={setRoadProximity}
                placeholder="e.g., Near main road / inside estate / quiet area"
                placeholderTextColor="#A1A7B3"
                style={styles.input}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g., Nairobi, Ruaka, Thika Road..."
                placeholderTextColor="#A1A7B3"
                style={styles.input}
              />

              <Text style={styles.label}>Budget (optional)</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                placeholder="e.g., 20000"
                placeholderTextColor="#A1A7B3"
                style={styles.input}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Utilities you want (optional)</Text>
              <View style={styles.utilityWrap}>
                {UTILITIES.map((u) => {
                  const active = selectedUtilities.includes(u);
                  return (
                    <TouchableOpacity
                      key={u}
                      activeOpacity={0.9}
                      onPress={() => toggleUtility(u)}
                      style={[styles.utilityChip, active && styles.utilityChipActive]}
                    >
                      <Ionicons
                        name={active ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={active ? COLORS.white : COLORS.subtext}
                      />
                      <Text style={[styles.utilityText, active && styles.utilityTextActive]} numberOfLines={1}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Extra notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything else? (pets, children, floor, balcony, etc.)"
                placeholderTextColor="#A1A7B3"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.submitBtn, (!canSubmitForm || !isPremium) && styles.submitBtnDisabled]}
              onPress={handleFormSubmit}
            >
              <Text style={styles.submitText}>
                {isPremium ? "Submit inquiry" : "Unlock with Premium to Submit"}
              </Text>
            </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={30} color={COLORS.white} />
            </View>
            <Text style={styles.successTitle}>Inquiry submitted!</Text>
            <Text style={styles.successSubtitle}>
              Your inquiry was sent successfully. Our team will get back to you with matching
              properties shortly.
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.successBtn}
              onPress={() => setShowSuccess(false)}
            >
              <Text style={styles.successBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SubscriptionModal
        visible={subscriptionModalVisible}
        context="tenant_premium"
        onClose={() => setSubscriptionModalVisible(false)}
        onLater={() => setSubscriptionModalVisible(false)}
        onSubscribed={async () => {
          await refreshSubscription();
          setSubscriptionModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  topContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.subtext,
    lineHeight: 18,
  },

  // Form Content
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  premiumCallout: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  premiumCalloutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCalloutTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E3A8A",
    marginBottom: 2,
  },
  premiumCalloutSub: {
    fontSize: 12,
    color: "#2563EB",
    lineHeight: 16,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  formSectionSub: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.subtext,
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  textArea: {
    height: 110,
    paddingTop: 14,
  },
  utilityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  utilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  utilityChipActive: {
    borderColor: COLORS.black,
    backgroundColor: COLORS.black,
  },
  utilityText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.subtext,
    maxWidth: 160,
  },
  utilityTextActive: {
    color: COLORS.white,
  },
  submitBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },

  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  successCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  successSubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.subtext,
    textAlign: "center",
    lineHeight: 19,
  },
  successBtn: {
    marginTop: 20,
    height: 48,
    width: "100%",
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
});