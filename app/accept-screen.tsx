import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

export default function DisclaimerScreen() {
  const [accepted, setAccepted] = useState(false);

  const sections = [
    {
      heading: "SkyHomes Is a Discovery Platform",
      body: "SkyHomes helps users discover rental listings and connect with each other.",
    },
    {
      heading: "Bloom Does Not",
      body: [
        "Own properties",
        "Act as an agent",
        "Guarantee availability",
        "Handle payments",
      ],
    },
    {
      heading: "Your Responsibility",
      body:
        "Users must verify details independently before making any decisions or transactions.",
    },
    {
      heading: "Acceptance",
      body:
        "By continuing, you accept responsibility for your own choices and verification steps.",
    },
  ];

  const handleContinue = () => {
    if (!accepted) return;

    router.back(); // or router.push("/signup")
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Important Notice</Text>
          <Text style={styles.subtitle}>
            Please read this before using SkyHomes.
          </Text>
        </View>

        <View style={styles.sectionsWrapper}>
          {sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>

              {Array.isArray(section.body) ? (
                section.body.map((item, i) => (
                  <Text key={i} style={styles.text}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={styles.text}>{section.body}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBox}>
        <TouchableOpacity
          style={styles.checkboxRow}
          activeOpacity={0.8}
          onPress={() => setAccepted(!accepted)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxText}>
            I have accepted the terms and conditions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            !accepted && styles.buttonDisabled,
          ]}
          activeOpacity={0.85}
          disabled={!accepted}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Accept and Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingBottom: 180,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 22,
  },
  sectionsWrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 6,
  },
  bottomBox: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#9ca3af",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#16a34a",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#9ca3af",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});