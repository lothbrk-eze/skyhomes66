import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_URL } from "../lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string | number;
  onUploadSuccess: (updatedUser: any) => void;
};

const C = {
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
  green: "#059669",
};

export default function ReUploadModal({ visible, onClose, userId, onUploadSuccess }: Props) {
  const [idPhoto, setIdPhoto] = useState<any>(null);
  const [proofOfOwnership, setProofOfOwnership] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (type: "id" | "proof") => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow gallery access to select photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (type === "id") {
          setIdPhoto(asset);
        } else {
          setProofOfOwnership(asset);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleUpload = async () => {
    if (!idPhoto || !proofOfOwnership) {
      Alert.alert("Missing Files", "Both ID photo and proof of ownership are required.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("user_id", String(userId));

      formData.append("id_photo", {
        uri: idPhoto.uri,
        name: idPhoto.fileName || `id_${Date.now()}.jpg`,
        type: idPhoto.mimeType || "image/jpeg",
      } as any);

      formData.append("proof_of_ownership", {
        uri: proofOfOwnership.uri,
        name: proofOfOwnership.fileName || `proof_${Date.now()}.jpg`,
        type: proofOfOwnership.mimeType || "image/jpeg",
      } as any);

      const response = await axios.post(`${API_URL}/api/reupload_verification`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.user) {
        Alert.alert(
          "Success",
          "Verification documents re-submitted successfully! They are now pending admin review."
        );
        onUploadSuccess(response.data.user);
        onClose();
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Upload Failed",
        err?.response?.data?.message || err?.message || "Failed to upload verification documents."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Re-submit Verification Documents</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Please select and upload a clear photo of your ID card and your proof of property ownership document.
            </Text>

            {/* ID Photo Picker */}
            <Text style={styles.label}>ID Photo *</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, idPhoto && styles.pickerBtnActive]}
              onPress={() => pickImage("id")}
              disabled={loading}
            >
              {idPhoto ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: idPhoto.uri }} style={styles.previewImage} />
                  <Text style={styles.pickerTextActive} numberOfLines={1}>
                    {idPhoto.fileName || "id_photo_selected.jpg"}
                  </Text>
                </View>
              ) : (
                <View style={styles.pickerInner}>
                  <Ionicons name="card-outline" size={24} color={C.muted} />
                  <Text style={styles.pickerText}>Select ID Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Proof of Ownership Picker */}
            <Text style={styles.label}>Proof of Property Ownership *</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, proofOfOwnership && styles.pickerBtnActive]}
              onPress={() => pickImage("proof")}
              disabled={loading}
            >
              {proofOfOwnership ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: proofOfOwnership.uri }} style={styles.previewImage} />
                  <Text style={styles.pickerTextActive} numberOfLines={1}>
                    {proofOfOwnership.fileName || "proof_document_selected.jpg"}
                  </Text>
                </View>
              ) : (
                <View style={styles.pickerInner}>
                  <Ionicons name="document-text-outline" size={24} color={C.muted} />
                  <Text style={styles.pickerText}>Select Proof of Ownership</Text>
                </View>
              )}
            </TouchableOpacity>
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
              style={[styles.btn, styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleUpload}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Documents</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
  modalCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    flex: 1,
    marginRight: 10,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: C.subtext,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginBottom: 6,
    marginTop: 14,
  },
  pickerBtn: {
    backgroundColor: C.soft,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
  },
  pickerBtnActive: {
    borderColor: C.accent,
    borderStyle: "solid",
    backgroundColor: C.accentLight,
  },
  pickerInner: {
    alignItems: "center",
    gap: 6,
  },
  pickerText: {
    fontSize: 14,
    color: C.subtext,
    fontWeight: "600",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "flex-start",
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: C.white,
  },
  pickerTextActive: {
    fontSize: 14,
    color: C.accent,
    fontWeight: "700",
    flex: 1,
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
  submitBtn: {
    backgroundColor: C.accent,
  },
  submitBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
  },
});
