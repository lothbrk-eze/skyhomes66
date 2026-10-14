import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { PurchasesPackage } from "react-native-purchases";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  pkg: PurchasesPackage;
  selected: boolean;
  onSelect: () => void;
  isOnetime?: boolean; // ADDED
};

export default function PlanCard({ pkg, selected, onSelect, isOnetime = false }: Props) {
  const product = pkg.product;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const title = (product.title || "").toLowerCase();
  const identifier = (product.identifier || "").toLowerCase();
  const description = (product.description || "").toLowerCase();

  const isYearly =
    !isOnetime && ( // CHANGED: yearly badge never shows for one-time
      title.includes("year") ||
      title.includes("annual") ||
      identifier.includes("year") ||
      identifier.includes("annual") ||
      description.includes("year") ||
      description.includes("annual")
    );

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: selected ? 1.015 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [selected, scaleAnim]);

  const priceString = product.priceString || "";

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onSelect}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
            borderColor: selected ? "#2563EB" : "#2A3244",
            backgroundColor: selected ? "#141F33" : "#0D1526",
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.radioOuter}>
            {selected && <View style={styles.radioInner} />}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {product.title}
          </Text>

          {/* CHANGED: show BEST VALUE only for yearly subscriptions, not one-time */}
          {isYearly && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>BEST VALUE</Text>
            </View>
          )}

          {/* ADDED: 14-Day Free Trial badge for subscriptions */}
          {!isOnetime && (
            <View style={styles.trialBadge}>
              <Ionicons name="sparkles" size={10} color="#FBBF24" />
              <Text style={styles.trialBadgeText}>14-DAY TRIAL</Text>
            </View>
          )}

          {/* ADDED: ONE TIME badge for one-time payments */}
          {isOnetime && (
            <View style={styles.onetimeBadge}>
              <Text style={styles.onetimeBadgeText}>ONE TIME</Text>
            </View>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{priceString}</Text>
          {/* CHANGED: no period shown for one-time payments */}
          {!isOnetime && (
            isYearly
              ? <Text style={styles.period}> / year</Text>
              : <Text style={styles.period}> / month</Text>
          )}
        </View>

        {/* ADDED: 14-Day Free Trial row for subscription plans */}
        {!isOnetime && (
          <View style={styles.trialRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#FBBF24" />
            <Text style={styles.trialText}>14 days free · Cancel anytime</Text>
          </View>
        )}

        {/* CHANGED: savings row only for yearly subscriptions */}
        {isYearly && (
          <View style={styles.savingsRow}>
            <Ionicons name="trending-down-outline" size={13} color="#86EFAC" />
            <Text style={styles.savingsText}>Saves ~$17 compared to monthly</Text>
          </View>
        )}

        {/* ADDED: one-time explanation row */}
        {isOnetime && (
          <View style={styles.savingsRow}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#86EFAC" />
            <Text style={styles.savingsText}>Pay once, access forever</Text>
          </View>
        )}

        {!!product.description && (
          <>
            <View style={styles.divider} />
            <Text style={styles.description}>{product.description}</Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  title: {
    flex: 1,
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  saveBadge: {
    backgroundColor: "rgba(252,92,2,0.18)",
    borderWidth: 1,
    borderColor: "rgba(252,92,2,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  saveBadgeText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  trialBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trialBadgeText: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  // ADDED: one-time badge style — green to distinguish from subscription
  onetimeBadge: {
    backgroundColor: "rgba(22,163,74,0.18)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onetimeBadgeText: {
    color: "#16A34A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  price: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  period: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },
  trialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
    marginBottom: 4,
  },
  trialText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "600",
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
    marginBottom: 2,
  },
  savingsText: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#1E2D44",
    marginVertical: 14,
  },
  description: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400",
  },
});