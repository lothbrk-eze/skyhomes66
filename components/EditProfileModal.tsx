import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  user: any;
  onSaveSuccess: (updatedUser: any) => void;
};

const C = {
  bg: "#F2F4F8",
  white: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  soft: "#F9FAFB",
  accent: "#FF385C",
  accentLight: "#FFF1F3",
  accentBorder: "#FFD7DE",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  green: "#059669",
  greenLight: "#ECFDF5",
  danger: "#DC2626",
};

export default function EditProfileModal({ visible, onClose, user, onSaveSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  // Landlord/realtor specific fields
  const [location, setLocation] = useState("");
  const [houseType, setHouseType] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setPassword("");
      setLocation(user.landlord_location || "");
      setHouseType(user.landlord_house_type || "");
    }
  }, [user, visible]);

  const handleSave = async () => {
    if (!username.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Validation Error", "Name, Email, and Phone are required.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("user_id", String(user.user_id || user.id));
      formData.append("username", username.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("phone", phone.trim());
      
      if (password.trim()) {
        formData.append("password", password.trim());
      }

      const role = user.role;
      if (role === "landlord" || role === "realtor") {
        formData.append("landlord_location", location.trim());
        formData.append("landlord_house_type", houseType.trim());
      }

      const response = await axios.post(`${API_URL}/api/update_profile`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.user) {
        Alert.alert("Success", "Profile updated successfully!");
        onSaveSuccess(response.data.user);
        onClose();
      } else {
        throw new Error("Invalid server response");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Update Failed",
        err?.response?.data?.message || err?.message || "An error occurred while updating profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const isLandlordOrRealtor = user?.role === "landlord" || user?.role === "realtor";

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Profile</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your name"
                placeholderTextColor={C.muted}
                editable={!loading}
              />

              {/* Email */}
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Enter email address"
                placeholderTextColor={C.muted}
                editable={!loading}
              />

              {/* Phone */}
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={C.muted}
                editable={!loading}
              />

              {/* Password */}
              <Text style={styles.label}>New Password (Optional)</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Leave blank to keep current password"
                placeholderTextColor={C.muted}
                editable={!loading}
              />

              {/* Landlord / Realtor specific fields */}
              {isLandlordOrRealtor && (
                <>
                  <Text style={styles.label}>Rental Location</Text>
                  <TextInput
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Enter rental location"
                    placeholderTextColor={C.muted}
                    editable={!loading}
                  />

                  <Text style={styles.label}>House Type</Text>
                  <TextInput
                    style={styles.input}
                    value={houseType}
                    onChangeText={setHouseType}
                    placeholder="e.g. Apartments, Bedsitters, Townhouses"
                    placeholderTextColor={C.muted}
                    editable={!loading}
                  />
                </>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.saveBtn, loading && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    width: "100%",
    maxHeight: "90%",
  },
  modalCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: C.text,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelBtnText: {
    color: C.subtext,
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: C.accent,
  },
  saveBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
  },
});
