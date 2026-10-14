import React, { useState, useEffect } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../contexts/AuthContext";
// import { auth } from "../lib/firebase"; // Google Sign-In disabled for now
// import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

let GoogleSignin: any = null;
let isExpoGo = true;
/*
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  isExpoGo = false;
} catch {
  isExpoGo = true;
}
*/

const API_URL = "https://bombadir.pythonanywhere.com";

// Same palette/spacing scale as Addhouse.tsx / signup.tsx, so login reads
// as the same step-wizard pattern as the rest of the app.
const C = {
  blue: "#2563EB",
  background: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  subtext: "#6B7280",
  mutedText: "#9CA3AF",
  white: "#FFFFFF",
  errorText: "#DC2626",
  errorDim: "#FEE2E2",
  orange: "#2563EB",
};

const WEB_CLIENT_ID =
  "250434053132-3ah0dbosmpsm6a6a7t3og6eka8frej41.apps.googleusercontent.com";

const ROLE_OPTIONS: { id: string; label: string; icon: string }[] = [
  { id: "tenant", label: "Tenant", icon: "person-outline" },
  { id: "landlord", label: "Landlord", icon: "business-outline" },
  { id: "realtor", label: "Realtor", icon: "briefcase-outline" },
];

const Login = () => {
  const { login: saveSession } = useAuth();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showMaybeLater, setShowMaybeLater] = useState(true);

  // Step state — step 0 collects the identifier, step 1 collects the
  // password, mirroring the Addhouse/Signup step-wizard pattern.
  const [step, setStep] = useState(0);
  const totalSteps = 2;

  /*
  useEffect(() => {
    if (!isExpoGo && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        offlineAccess: true,
      });
    }
  }, []);
  */

  useEffect(() => {
    let mounted = true;
    const checkPreviousAccount = async () => {
      try {
        const seen = await AsyncStorage.getItem("has_account_before");
        if (mounted) setShowMaybeLater(seen !== "false");
      } catch {
        if (mounted) setShowMaybeLater(true);
      }
    };
    checkPreviousAccount();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePostLogin = async (user: any) => {
    await saveSession(user);
    await router.dismissAll();
    router.replace("/(tabs)");
  };

  const handleMaybeLater = async () => {
    try {
      await AsyncStorage.multiSet([
        ["has_account_before", "true"],
        ["guest_mode", "true"],
      ]);
    } catch {
      // ignore
    }
    await router.replace("/(tabs)");
  };

  const submit = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your username/email and password");
      return;
    }
    setLoading("Signing in...");
    setError("");
    try {
      const formData = new FormData();
      formData.append("identifier", identifier.trim());
      formData.append("password", password.trim());
      const response = await axios.post(`${API_URL}/api/signin`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data?.user) {
        setLoading("");
        await handlePostLogin(response.data.user);
      } else {
        setLoading("");
        setError("Login failed. Please try again.");
      }
    } catch (err: any) {
      setLoading("");
      setError(err?.response?.data?.message || "Login failed");
    }
  };

  const handleGoogleLogin = async (selectedRole: string | null = null) => {
    setShowRoleModal(false);
    Alert.alert("Google Sign-In Disabled", "Google Sign-In is temporarily disabled.");
  };

  const handleContinue = () => {
    setError("");
    if (!identifier.trim()) {
      setError("Please enter your email or username");
      return;
    }
    setStep(1);
  };

  const handleBack = () => {
    setError("");
    if (step === 0) {
      router.back();
      return;
    }
    setStep(0);
  };

  const renderIdentifierStep = () => (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Hi, Welcome Back</Text>
      <Text style={s.stepSubtitle}>Sign in to continue to your account.</Text>

      <Text style={s.label}>Email or Username</Text>
      <TextInput
        style={s.input}
        placeholder="Enter Your Email"
        placeholderTextColor={C.mutedText}
        value={identifier}
        onChangeText={(t) => {
          setIdentifier(t);
          setError("");
        }}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {showMaybeLater && (
        <TouchableOpacity style={s.maybeLaterBtn} onPress={handleMaybeLater} activeOpacity={0.85}>
          <Text style={s.maybeLaterText}>Maybe later</Text>
        </TouchableOpacity>
      )}

      <View style={s.divider}>
        <View style={s.divLine} />
        <Text style={s.divText}>Or</Text>
        <View style={s.divLine} />
      </View>

      <TouchableOpacity
        style={s.socialBtn}
        onPress={() => setShowRoleModal(true)}
        activeOpacity={0.85}
        disabled={!!loading}
      >
        <Ionicons name="logo-google" size={20} color="#4285F4" />
        <Text style={s.socialBtnText}>Sign in with Google</Text>
      </TouchableOpacity>

      <View style={s.signupRow}>
        <Text style={s.signupText}>Don&apos;t Have An Account? </Text>
        <TouchableOpacity onPress={() => router.push("/signup")}>
          <Text style={s.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordStep = () => (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Enter Your Password</Text>
      <Text style={s.stepSubtitle}>Signing in as {identifier}</Text>

      <Text style={s.label}>Password</Text>
      <View style={s.pwWrap}>
        <TextInput
          style={[s.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
          placeholder="••••••••"
          placeholderTextColor={C.mutedText}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError("");
          }}
          secureTextEntry={!pwVisible}
          autoFocus
        />
        <TouchableOpacity onPress={() => setPwVisible((v) => !v)} style={s.eyeBtn}>
          <Ionicons name={pwVisible ? "eye-off-outline" : "eye-outline"} size={18} color={C.subtext} />
        </TouchableOpacity>
      </View>

      <View style={s.rememberRow}>
        <TouchableOpacity style={s.checkRow} onPress={() => setRememberMe((v) => !v)} activeOpacity={0.8}>
          <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
            {rememberMe && <Ionicons name="checkmark" size={11} color={C.white} />}
          </View>
          <Text style={s.rememberText}>Remember For 30 Days</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("../forgot-password")}>
          <Text style={s.forgot}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isLastStep = step === totalSteps - 1;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.brand}>skyhomes</Text>
      </View>

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={s.msgBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.errorText} />
            <Text style={s.msgText}>{error}</Text>
          </View>
        )}
        {!!loading && (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.orange} size="small" />
            <Text style={s.loadingText}>{loading}</Text>
          </View>
        )}

        {step === 0 ? renderIdentifierStep() : renderPasswordStep()}
      </ScrollView>

      {/* Footer navigation — progress bar removed; just Back (text link)
          and the solid pill Continue/Sign In button. */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.footerControls}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>

          {isLastStep ? (
            <TouchableOpacity
              style={[s.nextBtn, !!loading && s.nextBtnDisabled]}
              onPress={submit}
              disabled={!!loading}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={s.nextBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleContinue} style={s.nextBtn}>
              <Text style={s.nextBtnText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>How will you use SkyHomes?</Text>
            <Text style={s.modalSub}>Choose your role to continue with Google</Text>
            {ROLE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={s.modalOption}
                onPress={() => handleGoogleLogin(r.id)}
                activeOpacity={0.85}
              >
                <Ionicons name={r.icon as any} size={22} color={C.orange} />
                <Text style={s.modalOptionText}>{r.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.subtext} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowRoleModal(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Login;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: "center",
  },
  brand: { fontSize: 22, fontWeight: "800", color: C.orange },

  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    backgroundColor: C.errorDim,
    borderColor: "#FCA5A5",
  },
  msgText: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18, color: C.errorText },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  loadingText: { color: C.orange, fontWeight: "600", fontSize: 13 },

  stepContainer: { flex: 1 },
  stepTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: C.text,
    marginBottom: 8,
    lineHeight: 38,
  },
  stepSubtitle: {
    fontSize: 16,
    color: C.subtext,
    marginBottom: 30,
    lineHeight: 22,
  },

  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.white,
    marginBottom: 10,
  },
  pwWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingRight: 12,
    marginBottom: 10,
    backgroundColor: C.white,
  },
  eyeBtn: { padding: 4 },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: C.orange, borderColor: C.orange },
  rememberText: { fontSize: 12, color: C.subtext },
  forgot: { fontSize: 12, color: C.orange, fontWeight: "600" },

  maybeLaterBtn: { alignItems: "center", paddingVertical: 10, marginTop: 4, marginBottom: 4 },
  maybeLaterText: { color: C.orange, fontSize: 14, fontWeight: "700" },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { marginHorizontal: 12, color: C.subtext, fontSize: 12, fontWeight: "600" },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  socialBtnText: { color: C.text, fontWeight: "600", fontSize: 14 },

  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 28, flexWrap: "wrap" },
  signupText: { color: C.subtext, fontSize: 13 },
  signupLink: { color: C.orange, fontSize: 13, fontWeight: "700" },

  // Footer — no progress bar; just a top border, a text-link Back on the
  // left, and the solid pill Continue/Sign In button on the right.
  footer: {
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  footerControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: { paddingVertical: 12, paddingHorizontal: 10 },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
    textDecorationLine: "underline",
  },
  nextBtn: {
    backgroundColor: C.orange,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: C.white },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 },
  modalSub: { fontSize: 13, color: C.subtext, textAlign: "center", marginBottom: 24 },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.background,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  modalOptionText: { fontSize: 15, fontWeight: "700", color: C.text },
  modalCancel: { alignItems: "center", marginTop: 8, padding: 12 },
  modalCancelText: { color: C.subtext, fontWeight: "600", fontSize: 14 },
});