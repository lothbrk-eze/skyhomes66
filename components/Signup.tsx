import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
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

const EMAILJS_SERVICE_ID = "service_a7h9fwm";
const EMAILJS_TEMPLATE_ID = "template_0ma0g2q";
const EMAILJS_PUBLIC_KEY = "fm22xbY5U5AkcrACG";

const API_URL = "https://bombadir.pythonanywhere.com";

const WEB_CLIENT_ID =
  "250434053132-3ah0dbosmpsm6a6a7t3og6eka8frej41.apps.googleusercontent.com";

// Same palette/spacing scale as Addhouse.tsx, so the signup wizard reads as
// the same "series of screens" pattern as the add-property flow.
const C = {
  blue: "#2563EB",
  orange: "#2563EB",
  orangeTint: "#EFF6FF",
  blueTint: "#EFF6FF",
  background: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  subtext: "#6B7280",
  mutedText: "#9CA3AF",
  white: "#FFFFFF",
  errorText: "#DC2626",
  errorDim: "#FEE2E2",
  successText: "#16A34A",
  successDim: "#DCFCE7",
};

// Classy black gradient for the primary Next/Sign Up button — a deep
// charcoal-to-black diagonal sheen instead of a flat fill.
const BLACK_BTN_GRADIENT = ["#3A3A3C", "#000000"] as const;

type Role = "tenant" | "landlord" | "realtor";

const ROLES: { key: Role; label: string; icon: string }[] = [
  { key: "tenant", label: "Tenant", icon: "person-outline" },
  { key: "landlord", label: "Landlord", icon: "business-outline" },
  { key: "realtor", label: "Realtor", icon: "briefcase-outline" },
];

const Signup = () => {
  const params = useLocalSearchParams();
  const { login: saveSession } = useAuth();
  const insets = useSafeAreaInsets();

  const isGoogleParam = params.isGoogle === "true";
  const [googleAuth, setGoogleAuth] = useState<{ idToken: string } | null>(null);
  const isGoogle = isGoogleParam || !!googleAuth;

  const [form, setForm] = useState({ username: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<Role>("tenant");
  const [idPhoto, setIdPhoto] = useState<any>(null);
  const [proofOfOwnership, setProofOfOwnership] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  // Landlord / realtor rental details
  const [landlordLocation, setLandlordLocation] = useState("");
  const [landlordHouseType, setLandlordHouseType] = useState("");

  // Step state
  const [step, setStep] = useState(0);
  const totalSteps = role === "tenant" ? 2 : 4;

  useEffect(() => {
    if (isGoogleParam) {
      setForm((prev) => ({
        ...prev,
        email: (params.email as string) || "",
        username: (params.username as string) || "",
        password: "google_account_placeholder", // Dummy password to pass validation
      }));
      if (params.role) {
        setRole(params.role as Role);
      }
    }
  }, [params]);

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

  const handleChange = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const formatPhone = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, "");
    if (v.startsWith("+254")) return v;
    if (v.startsWith("254")) return `+${v}`;
    if (v.startsWith("0")) return `+254${v.substring(1)}`;
    return v;
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow gallery access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) setIdPhoto(result.assets[0]);
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const pickProofImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow gallery access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) setProofOfOwnership(result.assets[0]);
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleGoogleSignup = async (selectedRole: Role) => {
    setRole(selectedRole);
    Alert.alert("Google Sign-In Disabled", "Google Sign-In is temporarily disabled.");
  };

  const handleGoogleSignupDirect = async () => {
    handleGoogleSignup(role);
  };

  const submit = async () => {
    if (loading) return;
    setMessage({ type: "", text: "" });
    const { username, email, phone, password } = form;
    const u = username.trim(),
      em = email.trim().toLowerCase(),
      ph = phone.trim(),
      pw = password.trim();
    if (!u || !em || !ph || !pw) {
      setMessage({ type: "error", text: "Please fill all required fields." });
      return;
    }
    if (pw.length < 4) {
      setMessage({ type: "error", text: "Password must be at least 4 characters." });
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      setMessage({ type: "error", text: "Please accept the Terms & Privacy Policy." });
      return;
    }
    if ((role === "landlord" || role === "realtor") && (!idPhoto || !proofOfOwnership)) {
      setMessage({
        type: "error",
        text: `${role === "realtor" ? "Realtors" : "Landlords"} must provide both an ID photo and proof of ownership.`,
      });
      return;
    }
    if (role === "landlord" || role === "realtor") {
      if (!landlordLocation.trim() || !landlordHouseType.trim()) {
        setMessage({
          type: "error",
          text: "Please fill in your rental location and house type.",
        });
        return;
      }
    }
    setLoading(true);
    try {
      let otp = "";
      if (!isGoogle) {
        otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        await axios.post(
          "https://api.emailjs.com/api/v1.0/email/send",
          {
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
              to_email: em,
              to_name: u,
              time: expiryTime,
              otp,
              app_name: "SKYHOMES",
            },
          },
          { headers: { "Content-Type": "application/json" } }
        );
      }

      await AsyncStorage.setItem(
        "pending_signup",
        JSON.stringify({
          username: u,
          email: em,
          phone: formatPhone(ph),
          password: pw,
          role,
          acceptedTerms,
          acceptedPrivacy,
          otp,
          otpCreatedAt: Date.now(),
          isGoogle,
          googleIdToken: isGoogle
            ? googleAuth?.idToken || (params.googleIdToken as string) || null
            : null,
          landlord_location:
            role === "landlord" || role === "realtor"
              ? landlordLocation.trim()
              : null,
          landlord_house_type:
            role === "landlord" || role === "realtor"
              ? landlordHouseType.trim()
              : null,
          idPhoto:
            role !== "tenant" && idPhoto
              ? {
                  uri: idPhoto.uri,
                  fileName: idPhoto.fileName || `id_${Date.now()}.jpg`,
                  mimeType: idPhoto.mimeType || "image/jpeg",
                }
              : null,
          proofOfOwnership:
            role !== "tenant" && proofOfOwnership
              ? {
                  uri: proofOfOwnership.uri,
                  fileName: proofOfOwnership.fileName || `proof_${Date.now()}.jpg`,
                  mimeType: proofOfOwnership.mimeType || "image/jpeg",
                }
              : null,
        })
      );

      if (isGoogle) {
        setMessage({ type: "success", text: "Details saved. Redirecting to complete setup..." });
        router.push("/verify-email?isGoogle=true");
      } else {
        setMessage({ type: "success", text: "Verification code sent to your email." });
        router.push("/verify-email");
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to submit registration. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setMessage({ type: "", text: "" });
    if (step === 0) {
      const { username, email, phone, password } = form;
      if (!username.trim() || !email.trim() || !phone.trim()) {
        setMessage({ type: "error", text: "Please fill all required fields." });
        return;
      }
      if (!email.includes("@")) {
        setMessage({ type: "error", text: "Please enter a valid email address." });
        return;
      }
      if (!isGoogle && password.trim().length < 4) {
        setMessage({ type: "error", text: "Password must be at least 4 characters." });
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (role !== "tenant") {
        if (!idPhoto || !proofOfOwnership) {
          setMessage({
            type: "error",
            text: `${role === "realtor" ? "Realtors" : "Landlords"} must provide both an ID photo and proof of ownership.`,
          });
          return;
        }
        setStep(2);
      }
    } else if (step === 2) {
      if (role !== "tenant") {
        if (!landlordLocation.trim() || !landlordHouseType.trim()) {
          setMessage({
            type: "error",
            text: "Please fill in your rental location and house type.",
          });
          return;
        }
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    setMessage({ type: "", text: "" });
    if (step === 0) {
      router.push("/login");
      return;
    }
    setStep(step - 1);
  };

  const renderVerificationStep = () => {
    return (
      <View style={s.stepContainer}>
        <Text style={s.stepTitle}>Identity & Ownership Documents</Text>
        <Text style={s.stepSubtitle}>
          Upload your documents to complete your profile and ensure safety on SkyHomes.
        </Text>

        <View style={s.idNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={C.orange} />
          <Text style={s.idNoticeText}>
            Your documents are uploaded and securely kept on file for account authenticity and platform safety.
          </Text>
        </View>

        <Text style={s.label}>ID Photo *</Text>
        {idPhoto ? (
          <TouchableOpacity style={s.previewCard} onPress={pickImage} activeOpacity={0.85}>
            <Image source={{ uri: idPhoto.uri }} style={s.previewImg} />
            <View style={s.imgOverlay}>
              <Ionicons name="camera-outline" size={16} color={C.white} />
              <Text style={s.imgOverlayText}>Change ID Photo</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.uploadBtn} onPress={pickImage} activeOpacity={0.9}>
            <Ionicons name="cloud-upload-outline" size={24} color={C.orange} />
            <Text style={s.uploadBtnText}>Pick ID Photo *</Text>
          </TouchableOpacity>
        )}

        <Text style={s.label}>Land lease agreement document * or any other ownership document</Text>
        {proofOfOwnership ? (
          <TouchableOpacity style={s.previewCard} onPress={pickProofImage} activeOpacity={0.85}>
            <Image source={{ uri: proofOfOwnership.uri }} style={s.previewImg} />
            <View style={s.imgOverlay}>
              <Ionicons name="camera-outline" size={16} color={C.white} />
              <Text style={s.imgOverlayText}>Change Document</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.uploadBtn} onPress={pickProofImage} activeOpacity={0.9}>
            <Ionicons name="cloud-upload-outline" size={24} color={C.orange} />
            <Text style={s.uploadBtnText}>Pick Ownership Document *</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRentalDetailsStep = () => {
    return (
      <View style={s.stepContainer}>
        <Text style={s.stepTitle}>Rental Details</Text>
        <Text style={s.stepSubtitle}>Provide details about your properties.</Text>

        <Text style={s.label}>Area / Location of your rentals *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Westlands, Nairobi"
          placeholderTextColor={C.mutedText}
          value={landlordLocation}
          onChangeText={setLandlordLocation}
        />

        <Text style={s.label}>Main type of houses you rent *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Bedsitters, 1-bedroom"
          placeholderTextColor={C.mutedText}
          value={landlordHouseType}
          onChangeText={setLandlordHouseType}
        />
      </View>
    );
  };

  const renderAgreementsStep = () => {
    return (
      <View style={s.stepContainer}>
        <Text style={s.stepTitle}>Agreements</Text>
        <Text style={s.stepSubtitle}>Please review and accept our policies to finish signing up.</Text>

        <View style={s.legalSection}>
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setAcceptedTerms((v) => !v)}
            activeOpacity={0.85}
          >
            <View style={[s.checkbox, acceptedTerms && s.checkboxActive]}>
              {acceptedTerms && (
                <Ionicons name="checkmark" size={11} color={C.white} />
              )}
            </View>
            <Text style={s.checkLabel}>
              Agree With{" "}
              <Text
                style={s.checkLink}
                onPress={() => router.push("/terms" as any)}
              >
                Terms & Condition
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setAcceptedPrivacy((v) => !v)}
            activeOpacity={0.85}
          >
            <View style={[s.checkbox, acceptedPrivacy && s.checkboxActive]}>
              {acceptedPrivacy && (
                <Ionicons name="checkmark" size={11} color={C.white} />
              )}
            </View>
            <Text style={s.checkLabel}>
              Agree With{" "}
              <Text
                style={s.checkLink}
                onPress={() => router.push("/privacy-policy" as any)}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          {role === "landlord" && (
            <TouchableOpacity onPress={() => router.push("/landlord-agreement" as any)}>
              <Text style={[s.checkLink, { marginTop: 8 }]}>
                Read Landlord Agreement →
              </Text>
            </TouchableOpacity>
          )}
          {role === "realtor" && (
            <TouchableOpacity onPress={() => router.push("/realtor-agreement" as any)}>
              <Text style={[s.checkLink, { marginTop: 8 }]}>
                Read Realtor Agreement →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderBasicDetailsStep = () => {
    return (
      <View style={s.stepContainer}>
        <View style={s.roleRow}>
          {ROLES.map(({ key, label, icon }) => {
            const active = role === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.roleBtn, active && s.roleBtnActive]}
                onPress={() => setRole(key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={icon as any}
                  size={13}
                  color={active ? C.white : C.subtext}
                />
                <Text style={[s.roleLabel, active && s.roleLabelActive]}>
                  {label}
                </Text>
                {key === "realtor" && (
                  <View style={[s.proBadge, active && s.proBadgeActive]}>
                    <Text style={[s.proBadgeText, active && s.proBadgeTextActive]}>
                      PRO
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!isGoogle && (
          <>
            <TouchableOpacity
              style={s.socialBtn}
              onPress={handleGoogleSignupDirect}
              activeOpacity={0.85}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={C.orange} size="small" />
              ) : (
                <Ionicons name="logo-google" size={20} color="#4285F4" />
              )}
              <Text style={s.socialBtnText}>
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divText}>Or sign up manually</Text>
              <View style={s.divLine} />
            </View>
          </>
        )}

        <Text style={s.label}>Full Name *</Text>
        <TextInput
          style={s.input}
          placeholder="Enter Your Name"
          placeholderTextColor={C.mutedText}
          value={form.username}
          onChangeText={(v) => handleChange("username", v)}
        />

        <Text style={s.label}>Email *</Text>
        <TextInput
          style={[s.input, isGoogle && { backgroundColor: "#EAEAEA", color: "#666" }]}
          editable={!isGoogle}
          placeholder="Enter Your Email"
          placeholderTextColor={C.mutedText}
          value={form.email}
          onChangeText={(v) => handleChange("email", v)}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={s.label}>Phone *</Text>
        <TextInput
          style={s.input}
          placeholder="0712 345 678"
          placeholderTextColor={C.mutedText}
          value={form.phone}
          onChangeText={(v) => handleChange("phone", v)}
          keyboardType="phone-pad"
        />

        {!isGoogle && (
          <>
            <Text style={s.label}>Password *</Text>
            <View style={s.pwWrap}>
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                placeholder="Min 4 characters"
                placeholderTextColor={C.mutedText}
                secureTextEntry={!pwVisible}
                value={form.password}
                onChangeText={(v) => handleChange("password", v)}
              />
              <TouchableOpacity
                onPress={() => setPwVisible((p) => !p)}
                style={s.eyeBtn}
              >
                <Ionicons
                  name={pwVisible ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={C.subtext}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return renderBasicDetailsStep();
      case 1:
        return role === "tenant" ? renderAgreementsStep() : renderVerificationStep();
      case 2:
        return role === "tenant" ? null : renderRentalDetailsStep();
      case 3:
        return role === "tenant" ? null : renderAgreementsStep();
      default:
        return null;
    }
  };

  const isLastStep = step === totalSteps - 1;
  const disabled = loading || googleLoading || !acceptedTerms || !acceptedPrivacy;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.brand}>skyhomes</Text>
        <Text style={s.brandSub}>Create an account to get started</Text>
      </View>

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!message.text && (
          <View style={[s.msgBox, message.type === "error" ? s.msgError : s.msgSuccess]}>
            <Ionicons
              name={message.type === "error" ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={16}
              color={message.type === "error" ? C.errorText : C.successText}
            />
            <Text
              style={[
                s.msgText,
                { color: message.type === "error" ? C.errorText : C.successText },
              ]}
            >
              {message.text}
            </Text>
          </View>
        )}

        {renderStepContent()}
      </ScrollView>

      {/* Footer navigation — progress bar removed; just Back (text link)
          and the solid pill Next/Sign Up button. */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.footerControls}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Text style={s.backBtnText}>{step === 0 ? "Sign In" : "Back"}</Text>
          </TouchableOpacity>

          {isLastStep ? (
            <TouchableOpacity
              onPress={submit}
              disabled={disabled}
              activeOpacity={0.88}
              style={disabled && s.nextBtnDisabled}
            >
              <LinearGradient
                colors={BLACK_BTN_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.nextBtn}
              >
                {loading ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <Text style={s.nextBtnText}>Sign Up</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleNext} activeOpacity={0.88}>
              <LinearGradient
                colors={BLACK_BTN_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.nextBtn}
              >
                <Text style={s.nextBtnText}>Next</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Signup;

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
  brandSub: { fontSize: 13, color: C.subtext, marginTop: 2 },

  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  msgError: { backgroundColor: C.errorDim, borderColor: "#FCA5A5" },
  msgSuccess: { backgroundColor: C.successDim, borderColor: "#86EFAC" },
  msgText: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },

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

  roleRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  roleBtnActive: { backgroundColor: C.orange, borderColor: C.orange },
  roleLabel: { color: C.subtext, fontSize: 12, fontWeight: "700" },
  roleLabelActive: { color: C.white },
  proBadge: {
    backgroundColor: "#EEEEEE",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  proBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  proBadgeText: { color: C.subtext, fontSize: 8, fontWeight: "900" },
  proBadgeTextActive: { color: C.white },

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
    marginBottom: 4,
  },
  socialBtnText: { color: C.text, fontWeight: "600", fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { marginHorizontal: 12, color: C.subtext, fontSize: 12, fontWeight: "600" },

  idNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.orangeTint,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  idNoticeText: { color: C.orange, fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "600" },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.orange,
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 16,
    backgroundColor: C.orangeTint,
  },
  uploadBtnText: { color: C.orange, fontSize: 15, fontWeight: "700" },
  previewCard: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  previewImg: { width: "100%", height: 150, resizeMode: "cover" },
  imgOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8,
  },
  imgOverlayText: { color: C.white, fontSize: 12, fontWeight: "700" },

  legalSection: { gap: 12 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActive: { backgroundColor: C.orange, borderColor: C.orange },
  checkLabel: { color: C.subtext, fontSize: 13, lineHeight: 20, flex: 1 },
  checkLink: { color: C.orange, fontWeight: "700" },

  // Footer — no progress bar; just a top border, a text-link Back on the
  // left, and the solid pill Next/Sign Up button on the right.
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
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnDisabled: { opacity: 0.55 },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.3,
  },
});