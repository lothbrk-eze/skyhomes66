/**
 * Advanced Map Features Component
 * Shows premium map features: schools, hospitals, matatu routes
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

interface MapFeature {
  id: string;
  name: string;
  type: "school" | "hospital" | "matatu";
  distance?: number;
  latitude?: number;
  longitude?: number;
}

interface Props {
  isPremium: boolean;
  latitude?: number;
  longitude?: number;
  onFeaturePress?: (feature: MapFeature) => void;
}

export const AdvancedMapFeatures: React.FC<Props> = ({
  isPremium,
  latitude,
  longitude,
  onFeaturePress,
}) => {
  const [showFeatures, setShowFeatures] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    "school" | "hospital" | "matatu" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState<MapFeature[]>([]);

  const categories = [
    {
      id: "school",
      label: "Schools",
      icon: "school" as const,
      color: "#3B82F6",
    },
    {
      id: "hospital",
      label: "Hospitals",
      icon: "medical" as const,
      color: "#EF4444",
    },
    {
      id: "matatu",
      label: "Matatu Routes",
      icon: "bus" as const,
      color: "#F59E0B",
    },
  ];

  const loadFeatures = async (category: "school" | "hospital" | "matatu") => {
    if (!isPremium || !latitude || !longitude) return;

    setLoading(true);
    try {
      // Simulate loading features - in production, call actual API
      // const response = await axios.get(
      //   `${API_URL}/api/map-features/${category}?lat=${latitude}&lng=${longitude}`
      // );
      // setFeatures(response.data.features);

      // Mock data for demonstration
      const mockFeatures: { [key: string]: MapFeature[] } = {
        school: [
          { id: "s1", name: "Nairobi Academy", type: "school", distance: 0.5 },
          { id: "s2", name: "Kenya High School", type: "school", distance: 1.2 },
          { id: "s3", name: "Strathmore School", type: "school", distance: 1.8 },
        ],
        hospital: [
          { id: "h1", name: "Nairobi Hospital", type: "hospital", distance: 0.8 },
          { id: "h2", name: "Aga Khan Hospital", type: "hospital", distance: 1.5 },
          {
            id: "h3",
            name: "MP Shah Hospital",
            type: "hospital",
            distance: 2.1,
          },
        ],
        matatu: [
          { id: "m1", name: "Route 11 - CBD", type: "matatu", distance: 0.3 },
          { id: "m2", name: "Route 23 - Karen", type: "matatu", distance: 0.5 },
          { id: "m3", name: "Route 7 - Westlands", type: "matatu", distance: 0.8 },
        ],
      };

      setFeatures(mockFeatures[category] || []);
      setSelectedCategory(category);
    } catch (error) {
      console.log("Error loading features:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedContent}>
          <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
          <Text style={styles.lockedTitle}>Advanced Map Features</Text>
          <Text style={styles.lockedText}>
            Upgrade to Premium to discover nearby schools, hospitals, and matatu
            routes
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="map" size={20} color="#2563EB" />
          <Text style={styles.title}>Nearby Amenities</Text>
        </View>

        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => {
                loadFeatures(category.id as "school" | "hospital" | "matatu");
                setShowFeatures(true);
              }}
            >
              <View
                style={[styles.categoryIcon, { backgroundColor: category.color }]}
              >
                <Ionicons
                  name={category.icon}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.categoryLabel}>{category.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal
        visible={showFeatures}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFeatures(false);
          setSelectedCategory(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {categories.find((c) => c.id === selectedCategory)?.label ||
                  "Features"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFeatures(false);
                  setSelectedCategory(null);
                }}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : features.length > 0 ? (
              <View style={styles.featuresList}>
                {features.map((feature) => (
                  <TouchableOpacity
                    key={feature.id}
                    style={styles.featureItem}
                    onPress={() => {
                      onFeaturePress?.(feature);
                      setShowFeatures(false);
                    }}
                  >
                    <View
                      style={[
                        styles.featureIcon,
                        {
                          backgroundColor:
                            categories.find((c) => c.id === feature.type)
                              ?.color || "#9CA3AF",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          categories.find((c) => c.id === feature.type)?.icon ||
                          "location"
                        }
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={styles.featureInfo}>
                      <Text style={styles.featureName}>{feature.name}</Text>
                      {feature.distance && (
                        <Text style={styles.featureDistance}>
                          {feature.distance} km away
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#D1D5DB"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No features found nearby</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    color: "#111827",
  },
  categoriesGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  categoryCard: {
    alignItems: "center",
    flex: 1,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  lockedContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  lockedContent: {
    alignItems: "center",
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  lockedText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
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
    maxHeight: "80%",
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
  loaderContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  featuresList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  featureDistance: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
});

export default AdvancedMapFeatures;
