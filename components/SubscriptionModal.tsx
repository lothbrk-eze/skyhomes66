/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PlanCard from "./PlanCard";
import { hasPremiumEntitlement, openManageSubscriptions } from "../lib/revenuecat";
import { useSubscription } from "../hooks/useSubscription";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLater: () => void;
  onSubscribed?: (customerInfo: CustomerInfo) => void;
  context?: "listing_boost" | "realtor_signup" | "tenant_premium" | "landlord_onetime" | "realtor_onetime";
  requireSubscription?: boolean;
};

// ADDED: landlord_onetime and realtor_onetime copy
const CONTEXT_COPY = {
  listing_boost: {
    heading: "Boost Your\nListing Visibility",
    sub: "Give your properties priority placement and reach renters who are actively searching in your area. Includes a 14-day free trial.",
    benefits: [
      "14-day free trial with full premium access",
      "Priority visibility across search results",
      "Featured placement for premium listings",
      "More exposure, more qualified inquiries",
      "Place unlimited listings with a single subscription",
    ],
    cta: "Start 14-Day Free Trial",
    note: "14-day free trial included. Cancel anytime from Google Play / App Store before the trial ends and you won't be charged.",
    isOnetime: false,
  },
  realtor_signup: {
    heading: "Upgrade to\nRealtor Premium",
    sub: "Get unlimited house listings, post real estate news updates, and boost your listings with priority placement. Start with a free 7-day trial — no card required.",
    benefits: [
      "7-day free trial — no payment method needed",
      "Unlimited house listings (Free tier limited to 2 houses)",
      "Free house reels included for all listings",
      "Post real estate news & availability updates",
      "Priority listings sorted at top of search results",
      "Direct inquiry management & buyer leads",
    ],
    cta: "Start 7-Day Free Trial",
    note: "7-day free trial. No card required. After trial ends, purchase Realtor Premium to keep your access.",
    isOnetime: false,
  },
  tenant_premium: {
    heading: "Upgrade to\nTenant Premium",
    sub: "Place custom house inquiries, communicate directly with landlords, and get early access to new listings. Includes 14-day free trial.",
    benefits: [
      "Place custom house inquiries to match your budget & needs",
      "14-day free trial — test all premium features",
      "Direct communication with verified landlords",
      "3-hour exclusive early access to new properties",
      "Unlimited messaging and saved searches",
    ],
    cta: "Start 14-Day Free Trial",
    note: "14-day free trial included. Cancel anytime from Google Play / App Store before the trial ends and you won't be charged.",
    isOnetime: false,
  },
  // ADDED: landlord one-time payment copy
  landlord_onetime: {
    heading: "Activate Your\nLandlord Account",
    sub: "Complete a one-time payment to unlock your landlord dashboard and start listing your properties.",
    benefits: [
      "One-time payment — never charged again",
      "Full access to landlord dashboard",
      "List unlimited properties",
      "Account activated immediately after payment",
    ],
    cta: "Pay & Activate Account",
    note: "This is a one-time fee. You will never be charged again for account access.",
    isOnetime: true,
  },
  // ADDED: realtor one-time payment copy
  realtor_onetime: {
    heading: "Activate Your\nRealtor PRO Account",
    sub: "Complete a one-time PRO payment to unlock your realtor dashboard and all listing tools.",
    benefits: [
      "One-time payment — never charged again",
      "Full access to Realtor PRO dashboard",
      "List and manage unlimited properties",
      "Account activated immediately after payment",
    ],
    cta: "Pay & Activate PRO Account",
    note: "This is a one-time fee. You will never be charged again for account access.",
    isOnetime: true,
  },
};

// ADDED: one-time contexts for easy checking
const ONETIME_CONTEXTS = ["landlord_onetime", "realtor_onetime"];

export default function SubscriptionModal({
  visible,
  onClose,
  onLater,
  onSubscribed,
  context = "listing_boost",
  requireSubscription = false,
}: Props) {
  const copy = CONTEXT_COPY[context];
  const isOnetime = ONETIME_CONTEXTS.includes(context); // ADDED

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [hasSeenTrialBanner, setHasSeenTrialBanner] = useState<boolean>(true);

  const {
    isTrialActive,
    trialDaysRemaining,
    hasUsedTrial,
    startFreeTrial,
    refreshSubscription,
  } = useSubscription();

  useEffect(() => {
    if (!visible || context !== "listing_boost") {
      setHasSeenTrialBanner(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem("skyhomes_landlord_trial_banner_seen");
        if (active) {
          setHasSeenTrialBanner(seen === "true");
          // Mark it so it only displays once
          if (seen !== "true") {
            await AsyncStorage.setItem("skyhomes_landlord_trial_banner_seen", "true");
          }
        }
      } catch {
        if (active) setHasSeenTrialBanner(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, context]);

  const dismissTrialBanner = async () => {
    setHasSeenTrialBanner(true);
    try {
      await AsyncStorage.setItem("skyhomes_landlord_trial_banner_seen", "true");
    } catch {}
  };

  const handleStartInAppTrial = async () => {
    try {
      setLoadingTrial(true);
      const success = await startFreeTrial();
      if (success) {
        Alert.alert(
          "🎉 14-Day Free Trial Activated!",
          "You now have 14 days of full access to all premium features with zero charge. Enjoy!",
          [
            {
              text: "Explore Features",
              onPress: () => {
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert("Trial Error", "Could not activate your free trial right now. Please try again.");
      }
    } catch (err: any) {
      Alert.alert("Trial Error", err?.message || "Could not activate free trial.");
    } finally {
      setLoadingTrial(false);
    }
  };

  // REALTOR: 7-day free trial via RevenueCat Grant API (no card needed)
  const handleStartRealtorTrial = async () => {
    try {
      setLoadingTrial(true);

      const userId = await AsyncStorage.getItem("user_id");
      const rcAppUserId = await AsyncStorage.getItem("user_id"); // RC is configured with user_id as appUserID

      if (!userId || !rcAppUserId) {
        Alert.alert("Error", "Could not identify your account. Please log in again.");
        return;
      }

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("rc_app_user_id", rcAppUserId);

      const response = await fetch(
        "https://bombadir.pythonanywhere.com/api/start_realtor_trial",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (response.status === 400 && data.already_used) {
        Alert.alert(
          "Trial Already Used",
          "You have already used your free realtor trial. Purchase Realtor Premium to continue."
        );
        return;
      }

      if (!response.ok || !data.success) {
        Alert.alert("Trial Failed", data.message || "Could not activate trial. Please try again.");
        return;
      }

      // Refresh subscription — RC now has realtor_premium active
      await refreshSubscription();

      Alert.alert(
        "🎉 7-Day Trial Activated!",
        "You now have 7 days of full Realtor Premium access — no payment needed. Enjoy!",
        [{ text: "Explore Features", onPress: () => onClose() }]
      );
    } catch (err: any) {
      Alert.alert("Trial Error", err?.message || "Could not activate free trial. Check your connection.");
    } finally {
      setLoadingTrial(false);
    }
  };



  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
        cleanupTimer.current = null;
      }
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 90,
          friction: 12,
        }),
      ]).start();
    } else {
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();
      cleanupTimer.current = setTimeout(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(60);
        setSelectedPackage(null);
        cleanupTimer.current = null;
      }, 300);
    }
    return () => {
      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
        cleanupTimer.current = null;
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const loadOfferings = async () => {
      try {
        setLoadingOfferings(true);
        const offerings = await Purchases.getOfferings();
        const current = offerings.current ?? null;
        if (!mounted) return;
        setOffering(current);
        if (current?.availablePackages?.length) {
          const filtered = filterPackages(current.availablePackages, context);
          const sorted = sortPackages(filtered);
          setSelectedPackage(sorted[0] ?? null);
        } else {
          setSelectedPackage(null);
        }
      } catch (error) {
        console.log("Failed to load offerings:", error);
        Alert.alert("Unavailable", "Could not load payment options right now. Please try again.");
      } finally {
        if (mounted) setLoadingOfferings(false);
      }
    };
    loadOfferings();
    return () => { mounted = false; };
  }, [visible]);

  const packages = useMemo(() => {
    if (!offering?.availablePackages?.length) return [];
    return sortPackages(filterPackages(offering.availablePackages, context));
  }, [offering, context]);

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert("Select a plan", "Please choose a plan first.");
      return;
    }
    try {
      setLoading(true);
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

      // CHANGED: for one-time, check entitlement by product ID
      // for subscriptions, use hasPremiumEntitlement as before
      let isActive = false;
      if (isOnetime) {
        // check if any active entitlement matches our product
        const activeEntitlements = Object.values(customerInfo.entitlements.active);
        isActive = activeEntitlements.some(
          (e) => e.productIdentifier === selectedPackage.product.identifier
        );
      } else {
        isActive = hasPremiumEntitlement(customerInfo);
      }

      if (isActive) {
        // CHANGED: success message differs for one-time vs subscription
        Alert.alert(
          isOnetime ? "Payment Successful!" : "Subscription Active",
          isOnetime
            ? "Your account has been activated successfully."
            : "Your listings can now receive priority visibility and increased exposure to renters."
        );
        onSubscribed?.(customerInfo);
        onClose();
      } else {
        Alert.alert(
          isOnetime ? "Payment Pending" : "Subscription Pending",
          "Your purchase was received but access is not active yet. Please try restoring purchases."
        );
      }
    } catch (error: any) {
      if (error?.userCancelled) return;
      Alert.alert(
        isOnetime ? "Payment Failed" : "Purchase Failed",
        error?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      const isPremiumActive = hasPremiumEntitlement(customerInfo);
      if (isPremiumActive) {
        Alert.alert("Restored", "Your access has been restored successfully.");
        onSubscribed?.(customerInfo);
        onClose();
      } else {
        Alert.alert(
          "Nothing to Restore",
          isOnetime
            ? "We could not find a previous payment for this account."
            : "We could not find an active premium subscription to restore."
        );
      }
    } catch (error: any) {
      Alert.alert("Restore Failed", error?.message || "Could not restore purchases right now.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={requireSubscription ? () => {} : onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {!requireSubscription && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.heading}>{copy.heading}</Text>
            <Text style={styles.subheading}>{copy.sub}</Text>

            {/* Active 14-Day Free Trial Banner (Dull & displayed once only for Landlord Premium) */}
            {context === "listing_boost" && isTrialActive && !hasSeenTrialBanner && (
              <View style={styles.activeTrialBanner}>
                <Ionicons name="time-outline" size={15} color="#94A3B8" />
                <Text style={styles.activeTrialText}>
                  {trialDaysRemaining > 0
                    ? `14-day trial active · ${trialDaysRemaining} ${
                        trialDaysRemaining === 1 ? "day" : "days"
                      } left`
                    : "14-day trial active"}
                </Text>
                <TouchableOpacity onPress={dismissTrialBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.benefitsBox}>
              {copy.benefits.map((b, i) => (
                <BenefitRow key={i} text={b} last={i === copy.benefits.length - 1} />
              ))}
            </View>

            {/* 14-Day Free Trial Direct Activation (Dull & displayed once only for Landlord Premium) */}
            {context === "listing_boost" && !isOnetime && !hasUsedTrial && !isTrialActive && !hasSeenTrialBanner && (
              <>
                <View style={styles.trialCard}>
                  <View style={styles.trialCardHeader}>
                    <View style={styles.trialIconWrap}>
                      <Ionicons name="gift-outline" size={16} color="#94A3B8" />
                    </View>
                    <View style={styles.trialCardTexts}>
                      <Text style={styles.trialCardTitle}>14-day free trial available</Text>
                      <Text style={styles.trialCardSub}>
                        Try all premium features free for 14 days. No charge today.
                      </Text>
                    </View>
                    <TouchableOpacity onPress={dismissTrialBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.startTrialBtn}
                    onPress={async () => {
                      await dismissTrialBanner();
                      handleSubscribe();
                    }}
                    disabled={loadingTrial || loading}
                  >
                    {loadingTrial ? (
                      <ActivityIndicator color="#CBD5E1" size="small" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={15} color="#94A3B8" />
                        <Text style={styles.startTrialBtnText}>Start 14-Day Free Trial via Store</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CHOOSE A PLAN</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {/* CHANGED: hide plan picker label for one-time since there's only one option */}
            <View style={styles.planHeader}>
              <Text style={styles.sectionTitle}>
                {isOnetime ? "Payment" : "Choose your plan"}
              </Text>
              {!isOnetime && packages.length > 1 && (
                <Text style={styles.planCount}>{packages.length} options</Text>
              )}
            </View>

            {loadingOfferings ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loaderText}>Loading…</Text>
              </View>
            ) : packages.length > 0 ? (
              packages.map((pkg) => (
                <PlanCard
                  key={pkg.identifier}
                  pkg={pkg}
                  selected={selectedPackage?.identifier === pkg.identifier}
                  onSelect={() => setSelectedPackage(pkg)}
                />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="wifi-outline" size={22} color="#334155" />
                <Text style={styles.emptyText}>No plans available right now.</Text>
              </View>
            )}

            <Text style={styles.note}>{copy.note}</Text>

            {/* REALTOR: 7-day free trial (no card) as primary CTA, purchase below */}
            {context === "realtor_signup" ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[
                    styles.subscribeBtn,
                    loadingTrial && styles.disabledBtn,
                  ]}
                  onPress={handleStartRealtorTrial}
                  disabled={loadingTrial || loading}
                >
                  {loadingTrial ? (
                    <ActivityIndicator color="#0B1220" size="small" />
                  ) : (
                    <>
                      <Ionicons name="gift-outline" size={17} color="#0B1220" />
                      <Text style={styles.subscribeBtnText}>
                        Start 7-Day Free Trial
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR PURCHASE NOW</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[
                    styles.subscribeBtn,
                    { backgroundColor: "#1E2D44" },
                    (loading || loadingOfferings || !selectedPackage) && styles.disabledBtn,
                  ]}
                  onPress={handleSubscribe}
                  disabled={loading || loadingOfferings || !selectedPackage}
                >
                  {loading ? (
                    <ActivityIndicator color="#F8FAFC" size="small" />
                  ) : (
                    <>
                      <Text style={[styles.subscribeBtnText, { color: "#F8FAFC" }]}>
                        Purchase Realtor Premium
                      </Text>
                      <Ionicons name="arrow-forward" size={17} color="#F8FAFC" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.subscribeBtn,
                  (loading || loadingOfferings || !selectedPackage) && styles.disabledBtn,
                ]}
                onPress={handleSubscribe}
                disabled={loading || loadingOfferings || !selectedPackage}
              >
                {loading ? (
                  <ActivityIndicator color="#0B1220" size="small" />
                ) : (
                  <>
                    <Text style={styles.subscribeBtnText}>
                      {isOnetime
                        ? copy.cta
                        : isTrialActive
                        ? "Subscribe Now"
                        : "Start 14-Day Free Trial"}
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#0B1220" />
                  </>
                )}
              </TouchableOpacity>
            )}


            <View style={styles.secondaryRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.secondaryBtn, restoring && styles.disabledBtn]}
                onPress={handleRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <ActivityIndicator color="#94A3B8" size="small" />
                ) : (
                  <Text style={styles.secondaryBtnText}>Restore purchases</Text>
                )}
              </TouchableOpacity>

              {!requireSubscription && (
                <>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.secondaryBtn}
                    onPress={onLater}
                  >
                    <Text style={styles.secondaryBtnText}>Maybe later</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* CHANGED: hide subscription legal text for one-time payments */}
            {!isOnetime && (
              <View style={{ alignItems: "center", marginTop: 10, paddingBottom: 16 }}>
                <Text style={styles.legal}>
                  Subscriptions renew automatically. You can cancel or manage your plan anytime in your app store settings.
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 8, paddingVertical: 4 }}
                  onPress={openManageSubscriptions}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: "#60A5FA", fontSize: 13, textDecorationLine: "underline" }}>
                    Manage or cancel existing subscription in store
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function BenefitRow({ text, last }: { text: string; last: boolean }) {
  return (
    <View style={[styles.benefitRow, last && { marginBottom: 0 }]}>
      <View style={styles.checkWrap}>
        <Ionicons name="checkmark" size={11} color="#0B1220" />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function filterPackages(packages: PurchasesPackage[], context: string) {
  const filtered = packages.filter((pkg) => {
    const prodId = (pkg.product.identifier || "").toLowerCase();
    if (context === "landlord_onetime") return prodId.includes("landlord") && prodId.includes("signup");
    if (context === "realtor_onetime")  return prodId.includes("realtor") && prodId.includes("signup");
    if (context === "tenant_premium")   return prodId.includes("tenant");
    if (context === "realtor_signup")   return prodId.includes("realtor");
    if (context === "listing_boost")    return prodId.includes("hoodhomes_landlord") || prodId.includes("landlord");
    return true;
  });
  return filtered.length > 0 ? filtered : packages;
}

function sortPackages(packages: PurchasesPackage[]) {
  return [...packages].sort((a, b) => {
    const aMonthly = isMonthlyPackage(a);
    const bMonthly = isMonthlyPackage(b);
    if (aMonthly && !bMonthly) return -1;
    if (!aMonthly && bMonthly) return 1;
    return 0;
  });
}

function isMonthlyPackage(pkg: PurchasesPackage) {
  const t = (pkg.product.title || "").toLowerCase();
  const id = (pkg.product.identifier || "").toLowerCase();
  const d = (pkg.product.description || "").toLowerCase();
  return t.includes("month") || id.includes("month") || d.includes("month");
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0A1628",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "93%",
    borderTopWidth: 1,
    borderColor: "#1E2D44",
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#1E2D44",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111F35",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#1E2D44",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 32,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252,92,2,0.1)",
    borderWidth: 1,
    borderColor: "rgba(252,92,2,0.25)",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  heading: {
    color: "#F8FAFC",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  subheading: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
    fontWeight: "400",
  },
  benefitsBox: {
    backgroundColor: "#0D1E36",
    borderWidth: 1,
    borderColor: "#162236",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  checkWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  planCount: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "500",
  },
  loaderWrap: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    color: "#334155",
    fontSize: 13,
  },
  emptyBox: {
    backgroundColor: "#0D1E36",
    borderWidth: 1,
    borderColor: "#162236",
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: "#334155",
    fontSize: 14,
    textAlign: "center",
  },
  note: {
    color: "#334155",
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 20,
    fontWeight: "400",
  },
  subscribeBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  subscribeBtnText: {
    color: "#0B1220",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    gap: 0,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: "#475569",
    fontSize: 13.5,
    fontWeight: "600",
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: "#1E2D44",
  },
  legal: {
    color: "#1E2D44",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  activeTrialBanner: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderWidth: 1,
    borderColor: "#1E2D44",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  activeTrialText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  trialCard: {
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    borderWidth: 1,
    borderColor: "#1E2D44",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  trialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  trialIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  trialCardTexts: {
    flex: 1,
  },
  trialCardTitle: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  trialCardSub: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
  },
  startTrialBtn: {
    backgroundColor: "#162238",
    borderWidth: 1,
    borderColor: "#22334D",
    borderRadius: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  startTrialBtnText: {
    color: "#CBD5E1",
    fontSize: 13.5,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E2D44",
  },
  dividerText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});