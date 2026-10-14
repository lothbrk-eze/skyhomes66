import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const COLORS = {
  background: "#000000",
  white: "#FFFFFF",
  textPrimary: "#F5F5F5",
  textSecondary: "#9A9AA0",
  border: "rgba(255,255,255,0.08)",
  accent: "#2563EB",
  accentSoft: "rgba(252,92,2,0.12)",
  card: "#0D0D0D",
  buttonBg: "#FFFFFF",
  buttonText: "#111111",
  link: "#8BA8FF",
};

const sections = [
  {
    heading: "Information We Collect",
    body:
      "To support secure rental discovery on SkyHomes, we collect personal identification details such as your full name and verified phone number, property and listing data for landlords such as descriptions, images, pricing, and location, and usage or technical analytics such as search preferences, viewed listings, and device information.",
  },
  {
    heading: "How We Use Your Information",
    body:
      "We use your information to connect tenants and landlords, enable property discovery and communication, prevent fraud and suspicious activity, and improve the app by fixing technical issues, refining the interface, and developing better features.",
  },
  {
    heading: "Public Information",
    body:
      "Some content you provide may be visible to other users. This can include listing details like property descriptions, images, pricing, and location data, community feedback such as reviews, ratings, or comments, and limited profile details like your display name or verification status.",
  },
  {
    heading: "Data Sharing",
    body:
      "SkyHomes does not sell your data. Information may be shared where necessary with hosting and analytics providers, when publicly posted by you through listings or reviews, during a merger or business transfer, or when needed for safety, fraud investigation, legal enforcement, or government requests.",
  },
  {
    heading: "How We Protect Your Information",
    body:
      "We use security technologies and restrict access to personal information to authorized personnel who need it to operate and improve the platform. Users are encouraged to use strong passwords and report suspicious account activity immediately.",
  },
  {
    heading: "Your Rights",
    body:
      "You can request access to your data, ask for corrections where details are inaccurate or outdated, and request deletion of your account and personal data from active databases. Some information may still be retained for a limited period where required for tax, auditing, or fraud investigation purposes.",
  },
  {
    heading: "Children",
    body:
      "SkyHomes is intended for adult use and is not designed for users under 18 years old.",
  },
  {
    heading: "Contact Us",
    body:
      "For help with privacy, your account, or legal concerns, you can use the Help & Support section in the app or contact SkyHomes support through email at support@skyhomes.co.ke.",
  },
];

export default function PrivacyPolicyScreen() {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    try {
      setAccepting(true);

      await AsyncStorage.setItem("privacy_policy_accepted", "true");
      await AsyncStorage.setItem("privacy_policy_accepted_at", new Date().toISOString());

      Alert.alert("Accepted", "You have accepted SkyHomes's Privacy Policy.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save your acceptance. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.accent} />
            </View>
          </View>

          <Text style={styles.title}>Terms & Privacy</Text>

          <Text style={styles.introHeading}>Your data matters</Text>
          <Text style={styles.introText}>
            SkyHomes collects only the information needed to support secure rental discovery,
            tenant-landlord communication, fraud prevention, and better app performance.
            We do not sell your personal data.
          </Text>

          {sections.map((section, index) => (
            <View key={`${section.heading}-${index}`} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

          <Text style={styles.footerText}>
            By continuing, you confirm that you have read and accepted SkyHomes’s Privacy
            Policy and understand how your information is collected, used, and protected.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.acceptButtonText}>
              {accepting ? "Saving..." : "I Accept"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 20,
  },
  iconWrap: {
    marginTop: 8,
    marginBottom: 22,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 28,
    letterSpacing: -0.8,
  },
  introHeading: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  introText: {
    fontSize: 16,
    lineHeight: 30,
    color: COLORS.textSecondary,
    marginBottom: 36,
    fontWeight: "500",
  },
  section: {
    marginBottom: 34,
  },
  sectionHeading: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 30,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  footerText: {
    fontSize: 15,
    lineHeight: 27,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  bottomSpacer: {
    height: 120,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  acceptButton: {
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.buttonBg,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.buttonText,
  },
});