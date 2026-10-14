import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../contexts/AuthContext";

const API_URL = "https://bombadir.pythonanywhere.com";

const EMAILJS_SERVICE_ID = "service_f5ysmxh";
const EMAILJS_TEMPLATE_ID = "template_0ma0g2q";
const EMAILJS_PUBLIC_KEY = "fm22xbY5U5AkcrACG";

const C = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E0E0E0",
  borderLight: "#EEEEEE",
  accent: "#2563EB",
  accentLight: "#FFA500",
  white: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSub: "#7A7A7A",
  textMuted: "#B0B0B0",
  success: "#16A34A",
  error: "#DC2626",
  bg: "#FFFFFF",
};

export default function VerifyEmail() {
  return <VerifyEmailContent />;
}

function VerifyEmailContent() {
  const { login: saveSession } = useAuth();
  const params = useLocalSearchParams();
  const isGoogle = params.isGoogle === "true";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("pending_signup");
        if (!raw) {
          Alert.alert("No signup found", "Please sign up again.");
          router.replace("/signup");
          return;
        }
        setPendingSignup(JSON.parse(raw));
      } catch {
        Alert.alert("Error", "Failed to load signup details.");
        router.replace("/signup");
      }
    })();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Google signup: account creation happens right away for every role now that
  // there's no payment gate to wait on.
  useEffect(() => {
    if (pendingSignup && isGoogle) {
      (async () => {
        setLoading(true);
        try {
          const realUser = await createAccountAndSignIn(pendingSignup);
          Alert.alert("Success", "Account created!");
          await finalizeSession(realUser, pendingSignup);
        } catch (err: any) {
          console.log("Google Signup error:", err?.response?.data || err?.message || err);
          Alert.alert(
            "Signup failed",
            err?.response?.data?.message || err?.message || "Could not create account."
          );
          router.replace("/signup");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [pendingSignup]);

  const finalizeSession = async (user: any, signup: any) => {
    await saveSession({
      ...user,
      username: user.username || signup.username,
      email: user.email || signup.email,
      phone: user.phone || signup.phone,
      role: user.role || signup.role,
    });
    await AsyncStorage.removeItem("pending_signup");
    router.replace("/(tabs)");
  };

  const buildSignupFormData = (signup: any) => {
    const formData = new FormData();
    formData.append("username", signup.username);
    formData.append("email", signup.email);
    formData.append("phone", signup.phone);
    formData.append("password", signup.password);
    formData.append("role", signup.role);

    if (signup.role === "landlord" || signup.role === "realtor") {
      formData.append("landlord_location", signup.landlord_location || "");
      formData.append("landlord_house_type", signup.landlord_house_type || "");

      if (signup.idPhoto?.uri) {
        formData.append("id_photo", {
          uri: signup.idPhoto.uri,
          name: signup.idPhoto.fileName || `id_${Date.now()}.jpg`,
          type: signup.idPhoto.mimeType || "image/jpeg",
        } as any);
      }
      if (signup.proofOfOwnership?.uri) {
        formData.append("proof_of_ownership", {
          uri: signup.proofOfOwnership.uri,
          name: signup.proofOfOwnership.fileName || `proof_${Date.now()}.jpg`,
          type: signup.proofOfOwnership.mimeType || "image/jpeg",
        } as any);
      }
    }
    return formData;
  };

  // Shared helper — creates the account on the backend and signs the user in.
  // Runs the same way for every role now, right after OTP verification.
  const createAccountAndSignIn = async (signup: any) => {
    if (signup.isGoogle) {
      const formData = new FormData();
      formData.append("token", signup.googleIdToken);
      formData.append("role", signup.role);
      formData.append("phone", signup.phone);
      formData.append("landlord_location", signup.landlord_location || "");
      formData.append("landlord_house_type", signup.landlord_house_type || "");

      if (signup.role === "landlord" || signup.role === "realtor") {
        if (signup.idPhoto?.uri) {
          formData.append("id_photo", {
            uri: signup.idPhoto.uri,
            name: signup.idPhoto.fileName || `id_${Date.now()}.jpg`,
            type: signup.idPhoto.mimeType || "image/jpeg",
          } as any);
        }
        if (signup.proofOfOwnership?.uri) {
          formData.append("proof_of_ownership", {
            uri: signup.proofOfOwnership.uri,
            name: signup.proofOfOwnership.fileName || `proof_${Date.now()}.jpg`,
            type: signup.proofOfOwnership.mimeType || "image/jpeg",
          } as any);
        }
      }

      const res = await axios.post(`${API_URL}/api/google-signup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const realUser = res.data?.user;
      if (!realUser) throw new Error("Google account creation failed");
      return realUser;
    }

    await axios.post(`${API_URL}/api/signup3`, buildSignupFormData(signup), {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const signinData = new FormData();
    signinData.append("identifier", signup.email);
    signinData.append("password", signup.password);

    const signinRes = await axios.post(`${API_URL}/api/signin`, signinData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const realUser = signinRes.data?.user;
    if (!realUser) throw new Error("Auto sign-in failed");
    return realUser;
  };

  // Every role now creates the account right after OTP verification — no payment step.
  const handleVerify = async () => {
    if (!pendingSignup) { Alert.alert("Error", "Signup data not found."); return; }
    if (!code.trim()) { Alert.alert("Missing code", "Please enter the verification code."); return; }
    if (code.trim() !== pendingSignup.otp) { Alert.alert("Error", "Invalid code"); return; }

    const otpAge = Date.now() - (pendingSignup.otpCreatedAt || 0);
    if (otpAge > 15 * 60 * 1000) {
      Alert.alert("Expired", "This verification code has expired. Please resend it.");
      return;
    }

    setLoading(true);
    try {
      const realUser = await createAccountAndSignIn(pendingSignup);
      Alert.alert("Success", "Email verified and account created!");
      await finalizeSession(realUser, pendingSignup);
    } catch (err: any) {
      console.log("Verify error:", err?.response?.data || err?.message || err);
      Alert.alert(
        "Signup failed",
        err?.response?.data?.message || err?.message || "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingSignup || countdown > 0) return;
    setLoading(true);
    try {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString(
        [], { hour: "2-digit", minute: "2-digit" }
      );

      await axios.post(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: pendingSignup.email,
            to_name: pendingSignup.username,
            otp: newOtp,
            time: expiryTime,
            app_name: "SKYHOMES",
          },
        },
        { headers: { "Content-Type": "application/json" } }
      );

      const updated = { ...pendingSignup, otp: newOtp, otpCreatedAt: Date.now() };
      await AsyncStorage.setItem("pending_signup", JSON.stringify(updated));
      setPendingSignup(updated);
      setCountdown(60);
      Alert.alert("Sent", "A new verification code has been sent to your email.");
    } catch {
      Alert.alert("Error", "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <LinearGradient
          colors={[C.accent, C.accentLight]}
          style={styles.iconWrap}
        >
          <Ionicons name="mail-outline" size={28} color={C.white} />
        </LinearGradient>

        <Text style={styles.title}>Verify Code</Text>

        <Text style={styles.subtitle}>
          Please enter the code we just sent to your email{"\n"}
          <Text style={styles.emailText}>{pendingSignup?.email || "your email"}</Text>
        </Text>

        {isGoogle ? (
          <View style={{ alignItems: "center", marginTop: 40, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: "center", fontWeight: "600" }}>
              Setting up your account, please wait...
            </Text>
          </View>
        ) : (
          <>
            {/* OTP boxes */}
            <View style={styles.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.otpBox, code.length > i && styles.otpBoxActive]}>
                  <Text style={styles.otpChar}>{code[i] || "•"}</Text>
                </View>
              ))}
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenInput}
                autoFocus
              />
            </View>

            {/* Resend */}
            <TouchableOpacity
              onPress={handleResend}
              disabled={loading || countdown > 0}
              activeOpacity={0.85}
              style={styles.resendBtn}
            >
              <Text style={styles.resendLabel}>Didn&apos;t Receive OTP?</Text>
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend code in ${countdown}s` : "Resend Code"}
              </Text>
            </TouchableOpacity>

            {/* Verify */}
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.verifyBtnText}>Verify</Text>
              )}
            </TouchableOpacity>
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, paddingHorizontal: 25, paddingTop: 60 },
  iconWrap: { display: "none" },
  title: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    color: C.textSub,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emailText: { color: C.accent, fontWeight: "600" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    position: "relative",
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  otpBoxActive: { borderColor: C.accent },
  otpChar: { fontSize: 20, fontWeight: "700", color: C.textPrimary },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  resendBtn: { alignItems: "center", marginBottom: 30 },
  resendLabel: { color: C.textSub, fontSize: 13, marginBottom: 4 },
  resendText: { color: C.accent, fontSize: 14, fontWeight: "700" },
  resendDisabled: { opacity: 0.5 },
  verifyBtn: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnText: { color: C.white, fontSize: 16, fontWeight: "700" },
});