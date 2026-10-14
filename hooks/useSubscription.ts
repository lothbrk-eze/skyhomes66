import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { CustomerInfo } from "react-native-purchases";
import {
  ENTITLEMENTS,
  hasPremiumEntitlement,
  isStoreTrialActive,
  getActiveEntitlement,
} from "../lib/revenuecat";
import {
  isTrialActive as checkTrialActive,
  getTrialDaysRemaining,
  TRIAL_DURATION_MS,
} from "../lib/subscriptionUtils";

export const useSubscription = () => {
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLandlordPremium, setIsLandlordPremium] = useState(false);
  const [isTenantPremium, setIsTenantPremium] = useState(false);
  const [isRealtorPremium, setIsRealtorPremium] = useState(false);

  // 14-Day Free Trial States
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);

  const refreshSubscription = useCallback(async () => {
    try {
      setLoading(true);
      let info: CustomerInfo | null = null;
      try {
        info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
      } catch (err) {
        console.log("Purchases getCustomerInfo warning:", err);
      }

      // 1. Check RevenueCat Store Entitlements
      const hasLandlordPremiumStore = !!info?.entitlements.active[ENTITLEMENTS.LANDLORD_PREMIUM];
      const hasTenantPremiumStore = !!info?.entitlements.active[ENTITLEMENTS.TENANT_PREMIUM];
      const hasRealtorPremiumStore = !!info?.entitlements.active[ENTITLEMENTS.REALTOR_PREMIUM];
      const hasPaidStorePremium = info ? hasPremiumEntitlement(info) : false;
      const storeTrialActive = info ? isStoreTrialActive(info) : false;

      // 2. Check In-App 14-Day Free Trial via AsyncStorage
      const userId = await AsyncStorage.getItem("user_id");
      const trialKey = userId ? `skyhomes_trial_start_${userId}` : "skyhomes_trial_start";
      const usedKey = userId ? `skyhomes_trial_used_${userId}` : "skyhomes_trial_used";

      const [[, userTrialStart], [, globalTrialStart], [, userTrialUsed], [, globalTrialUsed]] =
        await AsyncStorage.multiGet([
          trialKey,
          "skyhomes_trial_start",
          usedKey,
          "skyhomes_trial_used",
        ]);

      const effectiveTrialStart = userTrialStart || globalTrialStart;
      const effectiveTrialUsed = userTrialUsed === "true" || globalTrialUsed === "true";

      const inAppTrialActive = checkTrialActive(effectiveTrialStart);
      const remainingDays = getTrialDaysRemaining(effectiveTrialStart);

      const activeTrial = storeTrialActive || inAppTrialActive;
      setIsTrialActive(activeTrial);
      setHasUsedTrial(effectiveTrialUsed || storeTrialActive);

      if (inAppTrialActive && effectiveTrialStart) {
        setTrialDaysRemaining(remainingDays);
        const endMs = new Date(effectiveTrialStart).getTime() + TRIAL_DURATION_MS;
        setTrialEndDate(new Date(endMs));
      } else if (storeTrialActive && info) {
        const ent = getActiveEntitlement(info);
        if (ent?.expirationDate) {
          const expDate = new Date(ent.expirationDate);
          setTrialEndDate(expDate);
          const msRemaining = expDate.getTime() - Date.now();
          setTrialDaysRemaining(Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))));
        } else {
          setTrialDaysRemaining(14);
          setTrialEndDate(null);
        }
      } else {
        setTrialDaysRemaining(0);
        setTrialEndDate(null);
      }

      // 3. Set Premium Flags (True if subscribed OR if 14-day trial is active)
      const premiumStatus = hasPaidStorePremium || activeTrial;
      setIsPremium(premiumStatus);
      setIsLandlordPremium(hasLandlordPremiumStore || activeTrial);
      setIsTenantPremium(hasTenantPremiumStore || activeTrial);
      setIsRealtorPremium(hasRealtorPremiumStore || activeTrial);
    } catch (error) {
      console.log("Subscription refresh error:", error);
      setIsPremium(false);
      setIsLandlordPremium(false);
      setIsTenantPremium(false);
      setIsRealtorPremium(false);
      setIsTrialActive(false);
      setTrialDaysRemaining(0);
      setTrialEndDate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const startFreeTrial = useCallback(
    async (targetUserId?: string): Promise<boolean> => {
      try {
        const uid = targetUserId || (await AsyncStorage.getItem("user_id")) || "";
        const nowIso = new Date().toISOString();
        const trialKey = uid ? `skyhomes_trial_start_${uid}` : "skyhomes_trial_start";
        const usedKey = uid ? `skyhomes_trial_used_${uid}` : "skyhomes_trial_used";

        await AsyncStorage.multiSet([
          [trialKey, nowIso],
          [usedKey, "true"],
          ["skyhomes_trial_start", nowIso],
          ["skyhomes_trial_used", "true"],
        ]);

        try {
          await Purchases.setAttributes({
            trial_status: "active",
            trial_start_date: nowIso,
          });
        } catch (rcErr) {
          console.log("RevenueCat setAttributes warning:", rcErr);
        }

        await refreshSubscription();
        return true;
      } catch (err) {
        console.log("Failed to start free trial:", err);
        return false;
      }
    },
    [refreshSubscription]
  );

  const resetTrial = useCallback(
    async (targetUserId?: string): Promise<void> => {
      try {
        const uid = targetUserId || (await AsyncStorage.getItem("user_id")) || "";
        const trialKey = uid ? `skyhomes_trial_start_${uid}` : "skyhomes_trial_start";
        const usedKey = uid ? `skyhomes_trial_used_${uid}` : "skyhomes_trial_used";

        await AsyncStorage.multiRemove([
          trialKey,
          usedKey,
          "skyhomes_trial_start",
          "skyhomes_trial_used",
        ]);

        try {
          await Purchases.setAttributes({
            trial_status: "expired",
          });
        } catch {}

        await refreshSubscription();
      } catch (err) {
        console.log("Failed to reset trial:", err);
      }
    },
    [refreshSubscription]
  );

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  return {
    loading,
    customerInfo,
    isPremium,
    isLandlordPremium,
    isTenantPremium,
    isRealtorPremium,
    isTrialActive,
    trialDaysRemaining,
    trialEndDate,
    hasUsedTrial,
    startFreeTrial,
    resetTrial,
    refreshSubscription,
  };
};