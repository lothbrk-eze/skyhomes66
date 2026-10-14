/**
 * Premium Features Display Component
 * Shows premium features and limits for users
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

interface Props {
  role: "tenant" | "landlord" | "realtor";
  isPremium: boolean;
  messagingLimit?: number;
  currentMessageCount?: number;
  listingLimit?: number;
  currentListingCount?: number;
  isTrialActive?: boolean;
  trialDaysRemaining?: number;
  onUpgrade?: () => void;
}

export const PremiumFeaturesDisplay: React.FC<Props> = ({
  role,
  isPremium,
  messagingLimit,
  currentMessageCount,
  listingLimit,
  currentListingCount,
  isTrialActive = false,
  trialDaysRemaining = 0,
  onUpgrade,
}) => {
  if (role === "tenant") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name={isPremium ? "star" : "star-outline"}
            size={20}
            color={isPremium ? "#FCD34D" : "#9CA3AF"}
          />
          <Text style={styles.title}>
            {isTrialActive
              ? "Premium Tenant (Trial)"
              : isPremium
              ? "Premium Tenant"
              : "Free Tenant"}
          </Text>
          {isTrialActive && (
            <View style={styles.trialPill}>
              <Ionicons name="sparkles" size={11} color="#D97706" />
              <Text style={styles.trialPillText}>
                {trialDaysRemaining > 0 ? `${trialDaysRemaining}d left` : "Trial"}
              </Text>
            </View>
          )}
        </View>

        {isTrialActive && (
          <View style={styles.trialBanner}>
            <Ionicons name="gift-outline" size={18} color="#D97706" />
            <View style={styles.trialBannerTextWrap}>
              <Text style={styles.trialBannerTitle}>14-Day Free Trial Active</Text>
              <Text style={styles.trialBannerSub}>
                {trialDaysRemaining > 0
                  ? `You have ${trialDaysRemaining} ${
                      trialDaysRemaining === 1 ? "day" : "days"
                    } remaining of full premium access.`
                  : "Your free trial ends today."}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.featuresList}>
          {/* Messaging Limit */}
          {messagingLimit !== undefined && (
            <View style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons
                  name="chatbubbles"
                  size={16}
                  color={isPremium ? "#10B981" : "#9CA3AF"}
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureLabel}>Message Landlords</Text>
                <Text style={styles.featureValue}>
                  {isPremium ? "Unlimited" : `${currentMessageCount}/${messagingLimit}`}
                </Text>
              </View>
            </View>
          )}

          {/* Advanced Map Features */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="map"
                size={16}
                color={isPremium ? "#10B981" : "#9CA3AF"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Advanced Map</Text>
              <Text style={styles.featureValue}>
                {isPremium
                  ? "Schools, Hospitals, Matatu Routes"
                  : "Coming with Premium"}
              </Text>
            </View>
          </View>

          {/* First View Access */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="eye"
                size={16}
                color={isPremium ? "#10B981" : "#9CA3AF"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>First View</Text>
              <Text style={styles.featureValue}>
                {isPremium ? "3-Hour Early Access" : "3-Hour Early Access (Premium)"}
              </Text>
            </View>
          </View>
        </View>

        {!isPremium && onUpgrade && (
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
            <Text style={styles.upgradeButtonText}>Start 14-Day Free Trial</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (role === "realtor") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name={isPremium ? "star" : "star-outline"}
            size={20}
            color={isPremium ? "#FCD34D" : "#9CA3AF"}
          />
          <Text style={styles.title}>
            {isTrialActive
              ? "Premium Realtor (Trial)"
              : isPremium
              ? "Premium Realtor"
              : "Free Realtor"}
          </Text>
          {isTrialActive && (
            <View style={styles.trialPill}>
              <Ionicons name="sparkles" size={11} color="#D97706" />
              <Text style={styles.trialPillText}>
                {trialDaysRemaining > 0 ? `${trialDaysRemaining}d left` : "Trial"}
              </Text>
            </View>
          )}
        </View>

        {isTrialActive && (
          <View style={styles.trialBanner}>
            <Ionicons name="gift-outline" size={18} color="#D97706" />
            <View style={styles.trialBannerTextWrap}>
              <Text style={styles.trialBannerTitle}>14-Day Free Trial Active</Text>
              <Text style={styles.trialBannerSub}>
                {trialDaysRemaining > 0
                  ? `You have ${trialDaysRemaining} ${
                      trialDaysRemaining === 1 ? "day" : "days"
                    } remaining of full premium realtor access.`
                  : "Your free trial ends today."}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.featuresList}>
          {/* Listing Limit */}
          {listingLimit !== undefined && (
            <View style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons
                  name="home"
                  size={16}
                  color={isPremium ? "#10B981" : "#9CA3AF"}
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureLabel}>House Listings</Text>
                <Text style={styles.featureValue}>
                  {isPremium ? "Unlimited" : `${currentListingCount ?? 0}/${listingLimit ?? 2} Houses`}
                </Text>
              </View>
            </View>
          )}

          {/* House Reels */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="videocam"
                size={16}
                color={isPremium ? "#10B981" : "#10B981"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>House Reels</Text>
              <Text style={styles.featureValue}>
                {isPremium ? "Unlimited (Free)" : "Free for your 2 Houses"}
              </Text>
            </View>
          </View>

          {/* Post News */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="newspaper"
                size={16}
                color={isPremium ? "#10B981" : "#9CA3AF"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Post Real Estate News</Text>
              <Text style={styles.featureValue}>
                {isPremium ? "Unlocked" : "Premium Feature"}
              </Text>
            </View>
          </View>

          {/* Priority Listings */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="star"
                size={16}
                color={isPremium ? "#10B981" : "#9CA3AF"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Priority Listings</Text>
              <Text style={styles.featureValue}>
                {isPremium ? "Top Search Placement" : "Premium Feature"}
              </Text>
            </View>
          </View>

          {/* Advanced Analytics */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons
                name="bar-chart"
                size={16}
                color={isPremium ? "#10B981" : "#9CA3AF"}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Analytics</Text>
              <Text style={styles.featureValue}>
                {isPremium ? "Detailed Statistics" : "Basic Statistics"}
              </Text>
            </View>
          </View>
        </View>

        {!isPremium && onUpgrade && (
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
            <Text style={styles.upgradeButtonText}>Start 14-Day Free Trial</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
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
  trialPill: {
    marginLeft: "auto",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trialPillText: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "700",
  },
  trialBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trialBannerTextWrap: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 1,
  },
  trialBannerSub: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 16,
  },
  featuresList: {
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 2,
  },
  featureValue: {
    fontSize: 12,
    color: "#6B7280",
  },
  upgradeButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 8,
  },
});

export default PremiumFeaturesDisplay;
