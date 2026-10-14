import React, { useState, useEffect } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import { router } from "expo-router";

const API_URL = "https://bombadir.pythonanywhere.com";

// ✅ SAME EMAILJS CONFIG AS SIGNUP
const EMAILJS_SERVICE_ID = "service_f5ysmxh";
const EMAILJS_TEMPLATE_ID = "template_0ma0g2q";
const EMAILJS_PUBLIC_KEY = "fm22xbY5U5AkcrACG";

const COLORS = {
  primaryDark: "#141E30",
  accent: "#2563EB",
  white: "#FFFFFF",
  border: "#D1D5DB",
  text: "#1A1A1A",
  subtext: "#6B7280",
  error: "#DC2626",
};

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email");

  const [email, setEmail] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [timer, setTimer] = useState(0);

  // ⏱️ TIMER
  useEffect(() => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // ✅ GENERATE OTP
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ✅ SEND OTP
  const sendOTP = async () => {
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const otp = generateOTP();

      const expiryTime = new Date(
        Date.now() + 15 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const payload = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: email.trim(),
          to_name: "User",
          time: expiryTime,
          otp,
          app_name: "SKYHOMES",
        },
      };

      await axios.post(
        "https://api.emailjs.com/api/v1.0/email/send",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      setGeneratedOtp(otp);
      setStep("reset");
      setTimer(60);

      Alert.alert("Success", "Verification code sent to your email");
    } catch (err: any) {
      console.log("OTP error:", err?.response?.data || err);
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🔁 RESEND
  const resendOTP = async () => {
    if (timer > 0) return;
    sendOTP();
  };

  // ✅ RESET PASSWORD
  const resetPassword = async () => {
    // Basic validation
    if (!enteredOtp) {
      setError("Enter verification code");
      return;
    }
    
    if (!newPassword) {
      setError("Enter new password");
      return;
    }
    
    if (!confirmPassword) {
      setError("Confirm your password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (enteredOtp !== generatedOtp) {
      setError("Invalid verification code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("email", email.trim());
      formData.append("password", newPassword);

      // Log what we're sending (for debugging)
      console.log("Sending reset request:", {
        email: email.trim(),
        password: newPassword
      });

      const response = await axios.post(`${API_URL}/api/reset-password`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Reset response:", response.data);

      Alert.alert(
        "Success", 
        response.data?.message || "Password reset successful",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/login");
            },
          },
        ]
      );
    } catch (err: any) {
      console.log("Reset error full:", err);
      console.log("Reset error response:", err?.response?.data);
      console.log("Reset error status:", err?.response?.status);
      
      // Show more specific error message
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.response?.status === 404) {
        setError("User not found. Please check your email.");
      } else if (err?.response?.status === 400) {
        setError("Invalid request. Please check your information.");
      } else {
        setError("Reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {step === "email" ? "Forgot Password" : "Reset Password"}
        </Text>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.info}>Processing...</Text>
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {step === "email" ? (
          <>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your registered email"
              placeholderTextColor={COLORS.subtext}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={sendOTP}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Sending..." : "Send Code"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor={COLORS.subtext}
              value={enteredOtp}
              onChangeText={setEnteredOtp}
              keyboardType="numeric"
              maxLength={6}
              editable={!loading}
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={COLORS.subtext}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!loading}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={COLORS.subtext}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />

            <Text style={styles.timer}>
              {timer > 0
                ? `Resend code in ${timer}s`
                : "Didn't receive code?"}
            </Text>

            <TouchableOpacity 
              onPress={resendOTP} 
              disabled={timer > 0 || loading}
            >
              <Text
                style={[
                  styles.resend,
                  (timer > 0 || loading) && { color: COLORS.subtext },
                ]}
              >
                Resend Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={resetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.primaryDark,
    marginBottom: 24,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 4,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: COLORS.accent,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  info: {
    textAlign: "center",
    color: COLORS.accent,
    marginBottom: 16,
    fontSize: 14,
    marginLeft: 8,
  },
  error: {
    textAlign: "center",
    color: COLORS.error,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: "500",
  },
  timer: {
    textAlign: "center",
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 8,
  },
  resend: {
    textAlign: "center",
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 20,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
});