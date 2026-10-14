import React from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { openSocialUrl, SOCIAL_URLS } from "../lib/socialUrls";

const COLORS = {
  bg: "#F7F7F7",
  text: "#111111",
  muted: "#6B7280",
  soft: "#4B5563",
  line: "#E5E7EB",
  brand: "#3F5E96",
  brandDark: "#141E30",
  white: "#FFFFFF",
};

const AboutUs = () => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={30} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.brandSection}>
        <Text style={styles.logoText}>skyhomes</Text>

        <Text style={styles.tagline}>
          Find Better. Rent Better. Live Better.
        </Text>

        <TouchableOpacity onPress={() => router.push("/contact-us")}>
          <Text style={styles.websiteText}>skyhomes.app</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuList}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/terms")}
          activeOpacity={0.8}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="document-text-outline" size={26} color={COLORS.text} />
            <Text style={styles.menuLabel}>Terms and conditions</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/privacy-policy")}
          activeOpacity={0.8}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="lock-closed-outline" size={26} color={COLORS.text} />
            <Text style={styles.menuLabel}>Privacy policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/disclaimer")}
          activeOpacity={0.8}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.text} />
            <Text style={styles.menuLabel}>Disclaimer</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.8}
          onPress={() => openSocialUrl(SOCIAL_URLS.tiktok)}
        >
          <Ionicons name="logo-tiktok" size={30} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.8}
          onPress={() => openSocialUrl(SOCIAL_URLS.instagram)}
        >
          <Ionicons name="logo-instagram" size={30} color="#E4405F" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.8}
          onPress={() => openSocialUrl(SOCIAL_URLS.youtube)}
        >
          <Ionicons name="logo-youtube" size={30} color="#FF0000" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          By using SKYHOMES, you agree to the{" "}
          <Text style={styles.linkText} onPress={() => router.push("/terms")}>
            Terms and conditions
          </Text>{" "}
          and{" "}
          <Text
            style={styles.linkText}
            onPress={() => router.push("/privacy-policy")}
          >
            Privacy policy
          </Text>
          .
        </Text>
      </View>

      <Text style={styles.versionText}>VERSION 1.0.0</Text>
    </ScrollView>
  );
};

export default AboutUs;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 50,
    minHeight: "100%",
  },

  topBar: {
    paddingTop: 8,
    marginBottom: 28,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  brandSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 48,
  },

  logoText: {
    fontSize: 72,
    fontWeight: "900",
    color: COLORS.brand,
    letterSpacing: -2,
    textTransform: "lowercase",
  },

  tagline: {
    marginTop: 20,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    paddingHorizontal: 10,
  },

  websiteText: {
    marginTop: 10,
    fontSize: 18,
    color: COLORS.brand,
    textDecorationLine: "underline",
    fontWeight: "500",
  },

  menuList: {
    marginTop: 8,
  },

  menuRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    flex: 1,
  },

  menuLabel: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: "500",
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 56,
    marginBottom: 36,
  },

  socialButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    borderColor: "#A3A3A3",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },

  infoBlock: {
    paddingHorizontal: 10,
    marginBottom: 34,
  },

  infoText: {
    textAlign: "center",
    fontSize: 17,
    lineHeight: 30,
    color: COLORS.soft,
  },

  linkText: {
    color: "#3F3F46",
    textDecorationLine: "underline",
  },

  versionText: {
    textAlign: "center",
    color: COLORS.brand,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: 0.4,
  },
});