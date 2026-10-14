import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

type Section = {
  heading: string;
  body: string | string[];
};

type Props = {
  title: string;
  subtitle?: string;
  sections: Section[];
  footerText?: string;
  buttonText?: string;
  onAcceptRoute?: string;
};

const COLORS = {
  bg: "#050505",
  card: "#0C0C0C",
  text: "#FFFFFF",
  subtext: "#9CA3AF",
  muted: "#6B7280",
  line: "#1F2937",
  buttonBg: "#F3F4F6",
  buttonText: "#111111",
  link: "#8AB4FF",
};

export default function LegalPage({
  title,
  subtitle,
  sections,
  footerText = "By continuing, you agree to our Terms.",
  buttonText = "I Accept",
  onAcceptRoute = "/signup",
}: Props) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <LinearGradient colors={[COLORS.bg, "#000000"]} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <LinearGradient
              colors={["#6EE7B7", "#60A5FA", "#A78BFA", "#F97316", "#F87171"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Ionicons name="heart" size={22} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>{title}</Text>

          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {sections.map((section, index) => (
            <View key={`${section.heading}-${index}`} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>

              {Array.isArray(section.body) ? (
                <View style={styles.listWrap}>
                  {section.body.map((item, itemIndex) => (
                    <View key={`${item}-${itemIndex}`} style={styles.listRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.bodyText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.bodyText}>{section.body}</Text>
              )}
            </View>
          ))}

          <Text style={styles.footerText}>{footerText}</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.button}
            onPress={() => router.replace(onAcceptRoute as never)}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 34,
  },
  logoWrap: {
    marginTop: 8,
    marginBottom: 20,
  },
  logoGradient: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: COLORS.subtext,
    marginBottom: 30,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 30,
    marginBottom: 14,
    letterSpacing: -0.4,
    textTransform: "none",
  },
  bodyText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 32,
    color: COLORS.subtext,
    fontWeight: "400",
  },
  listWrap: {
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.subtext,
    marginTop: 12,
  },
  footerText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 18,
  },
  button: {
    backgroundColor: COLORS.buttonBg,
    borderRadius: 999,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.buttonText,
  },
});