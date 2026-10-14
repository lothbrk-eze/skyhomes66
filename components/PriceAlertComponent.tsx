/**
 * Price Alert Component
 * Allows premium tenants to set up price drop/rise alerts
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { API_URL } from "../lib/api";
import { formatCurrency } from "../lib/priceAlerts";

interface Props {
  isPremium: boolean;
  propertyId: string | number;
  propertyTitle: string;
  currentPrice: number;
  userId: string | number;
  onAlertSet?: (alertId: string) => void;
}

export const PriceAlertComponent: React.FC<Props> = ({
  isPremium,
  propertyId,
  propertyTitle,
  currentPrice,
  userId,
  onAlertSet,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [alertType, setAlertType] = useState<"drop" | "rise">("drop");
  const [alertPrice, setAlertPrice] = useState(String(currentPrice));
  const [loading, setLoading] = useState(false);
  const [hasAlert, setHasAlert] = useState(false);

  const handleSetAlert = async () => {
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price");
      return;
    }

    if (alertType === "drop" && price >= currentPrice) {
      Alert.alert(
        "Invalid Alert",
        "Alert price must be lower than current price for drop alerts"
      );
      return;
    }

    if (alertType === "rise" && price <= currentPrice) {
      Alert.alert(
        "Invalid Alert",
        "Alert price must be higher than current price for rise alerts"
      );
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("property_id", String(propertyId));
      formData.append("user_id", String(userId));
      formData.append("original_price", String(currentPrice));
      formData.append("alert_price", String(price));
      formData.append("alert_type", alertType);

      // In production, send to actual API endpoint
      // const response = await axios.post(
      //   `${API_URL}/api/price-alerts`,
      //   formData,
      //   { headers: { "Content-Type": "multipart/form-data" } }
      // );

      // Mock success
      setHasAlert(true);
      setShowModal(false);

      Alert.alert(
        "Alert Set",
        `You will be notified when ${propertyTitle} ${
          alertType === "drop" ? "drops below" : "rises above"
        } ${formatCurrency(price)}`
      );

      onAlertSet?.(String(propertyId));
    } catch (error) {
      console.log("Error setting price alert:", error);
      Alert.alert("Error", "Failed to set price alert. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
        <Text style={styles.lockedText}>Price Alerts (Premium)</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.alertButton, hasAlert && styles.alertButtonActive]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons
          name={hasAlert ? "notifications" : "notifications-outline"}
          size={16}
          color={hasAlert ? "#FFFFFF" : "#2563EB"}
        />
        <Text
          style={[styles.alertButtonText, hasAlert && styles.alertButtonTextActive]}
        >
          {hasAlert ? "Alert Active" : "Set Price Alert"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Price Alert</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.propertyTitle} numberOfLines={1}>
                {propertyTitle}
              </Text>
              <Text style={styles.currentPrice}>
                Current: {formatCurrency(currentPrice)}
              </Text>

              <View style={styles.alertTypeSection}>
                <Text style={styles.sectionLabel}>Alert Type</Text>
                <View style={styles.alertTypeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      alertType === "drop" && styles.typeButtonActive,
                    ]}
                    onPress={() => setAlertType("drop")}
                  >
                    <Ionicons
                      name="trending-down"
                      size={16}
                      color={alertType === "drop" ? "#FFFFFF" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        alertType === "drop" && styles.typeButtonTextActive,
                      ]}
                    >
                      Price Drops
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      alertType === "rise" && styles.typeButtonActive,
                    ]}
                    onPress={() => setAlertType("rise")}
                  >
                    <Ionicons
                      name="trending-up"
                      size={16}
                      color={alertType === "rise" ? "#FFFFFF" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        alertType === "rise" && styles.typeButtonTextActive,
                      ]}
                    >
                      Price Rises
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.alertPriceSection}>
                <Text style={styles.sectionLabel}>Alert Me When It</Text>
                <Text style={styles.alertCondition}>
                  {alertType === "drop" ? "Drops Below" : "Rises Above"}
                </Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>KES</Text>
                  <Text
                    style={styles.priceInput}
                    onPress={() => {
                      /* Could open number picker */
                    }}
                  >
                    {formatCurrency(parseFloat(alertPrice) || 0)}
                  </Text>
                </View>
                <Text style={styles.priceNote}>
                  You will get a notification at this price
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.setAlertButton, loading && styles.buttonDisabled]}
                onPress={handleSetAlert}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="notifications" size={16} color="#FFFFFF" />
                    <Text style={styles.setAlertButtonText}>Set Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  alertButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "transparent",
  },
  alertButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  alertButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  alertButtonTextActive: {
    color: "#FFFFFF",
  },
  lockedContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  lockedText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  alertTypeSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  alertTypeButtons: {
    flexDirection: "row",
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  typeButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  typeButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  typeButtonTextActive: {
    color: "#FFFFFF",
  },
  alertPriceSection: {
    marginBottom: 20,
  },
  alertCondition: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginVertical: 8,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginVertical: 10,
  },
  currencySymbol: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 6,
  },
  priceInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  priceNote: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },
  setAlertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  setAlertButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PriceAlertComponent;
