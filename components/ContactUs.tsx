import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { send } from "@emailjs/react-native";
import { openSocialUrl, SOCIAL_URLS } from "../lib/socialUrls";

const COLORS = {
  bg: "#000000",
  card: "#1C1C1E",
  card2: "#232326",
  text: "#FFFFFF",
  muted: "#A1A1AA",
  line: "#2F2F33",
  blue: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  soft: "#D4D4D8",
};

const ContactUs = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const sendMessage = async () => {
    if (!name || !email || !phone || !message) {
      Alert.alert("Missing fields", "Please fill all fields.");
      return;
    }

    try {
      await send(
        "service_f5ysmxh",
        "template_shc2fh6",
        {
          from_name: name,
          reply_to: email,
          phone: phone,
          message: message,
        },
        {
          publicKey: "fm22xbY5U5AkcrACG",
        }
      );

      Alert.alert("Success", "Message sent successfully!");

      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (error) {
      console.log("EMAIL ERROR:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Contact SkyHomes</Text>
          <Text style={styles.subtitle}>
            Reach out for rentals, listings, applications, or general housing
            support.
          </Text>
        </View>

        <View style={styles.avatar}>
          <Ionicons name="call-outline" size={34} color="#BDBDBD" />
        </View>
      </View>

      <View style={styles.quickActionsRow}>
        <View style={styles.quickCard}>
          <Ionicons name="call-outline" size={26} color="#FFFFFF" />
          <Text style={styles.quickTitle}>Call</Text>
          <Text style={styles.quickSubtitle}>Fast support</Text>
        </View>

        <View style={styles.quickCard}>
          <Ionicons name="mail-outline" size={26} color="#FFFFFF" />
          <Text style={styles.quickTitle}>Email</Text>
          <Text style={styles.quickSubtitle}>Send inquiry</Text>
        </View>

        <View style={styles.quickCard}>
          <Ionicons name="location-outline" size={26} color="#FFFFFF" />
          <Text style={styles.quickTitle}>Visit</Text>
          <Text style={styles.quickSubtitle}>Our office</Text>
        </View>
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => openSocialUrl(SOCIAL_URLS.tiktok)}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-tiktok" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => openSocialUrl(SOCIAL_URLS.instagram)}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-instagram" size={26} color="#E4405F" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => openSocialUrl(SOCIAL_URLS.youtube)}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-youtube" size={26} color="#FF0000" />
        </TouchableOpacity>
      </View>

      <View style={styles.bannerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>We are here to help</Text>
          <Text style={styles.bannerSubtitle}>
            Contact us about property listings, tenant applications, rentals,
            and support.
          </Text>
        </View>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.blue} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send a message</Text>

        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={COLORS.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="call-outline" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor={COLORS.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={[styles.inputWrap, styles.textAreaWrap]}>
          <Ionicons
            name="document-text-outline"
            size={20}
            color={COLORS.muted}
            style={{ marginTop: 12 }}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write your message here..."
            placeholderTextColor={COLORS.muted}
            value={message}
            onChangeText={setMessage}
            multiline
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={sendMessage}>
          <Text style={styles.buttonText}>Send Message</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ContactUs;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    paddingRight: 12,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#F1F1F1",
    justifyContent: "center",
    alignItems: "center",
  },

  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  quickCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "center",
    minHeight: 118,
    justifyContent: "center",
  },
  quickTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },
  quickSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginBottom: 18,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  bannerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bannerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  bannerSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
    color: COLORS.text,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  textAreaWrap: {
    alignItems: "flex-start",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: COLORS.text,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.bg,
    fontWeight: "800",
    fontSize: 16,
  },
});