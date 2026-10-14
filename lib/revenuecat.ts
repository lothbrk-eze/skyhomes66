import { Linking, Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";

export const ENTITLEMENTS = {
  LANDLORD_PREMIUM: "landlord_premium",
  TENANT_PREMIUM: "tenant_premium",
  REALTOR_PREMIUM: "realtor_premium",
  PREMIUM: "premium",
};

const RC_KEYS = {
  ios: "goog_ieYpnswExAJhuZhMaRITwWbgjbf",
  android: "goog_xJEVzpgeGfVfZGaOzERKiKlWsrz",
};

export async function configureRevenueCat(appUserID?: string) {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

  const apiKey = Platform.OS === "ios" ? RC_KEYS.ios : RC_KEYS.android;

  if (!apiKey) {
    throw new Error("RevenueCat public SDK key is missing.");
  }

  await Purchases.configure(
    appUserID
      ? { apiKey, appUserID }
      : { apiKey }
  );
}

export async function getOfferings() {
  return Purchases.getOfferings();
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) return false;

  const active = customerInfo.entitlements.active;
  return !!(
    active[ENTITLEMENTS.LANDLORD_PREMIUM] ||
    active[ENTITLEMENTS.TENANT_PREMIUM] ||
    active[ENTITLEMENTS.REALTOR_PREMIUM] ||
    active[ENTITLEMENTS.PREMIUM]
  );
}

export function getActiveEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) return null;
  const active = customerInfo.entitlements.active;
  return (
    active[ENTITLEMENTS.LANDLORD_PREMIUM] ||
    active[ENTITLEMENTS.TENANT_PREMIUM] ||
    active[ENTITLEMENTS.REALTOR_PREMIUM] ||
    active[ENTITLEMENTS.PREMIUM] ||
    null
  );
}

export function isStoreTrialActive(customerInfo: CustomerInfo | null): boolean {
  const entitlement = getActiveEntitlement(customerInfo);
  if (!entitlement) return false;
  return entitlement.periodType === "TRIAL";
}

export async function restoreRevenueCatPurchases() {
  return Purchases.restorePurchases();
}

/**
 * Open native store subscriptions management screen (Google Play / Apple App Store)
 * allowing users to view, change, or cancel their subscription in 1 tap.
 */
export async function openManageSubscriptions() {
  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(
        Platform.OS === "ios"
          ? "https://support.apple.com/HT202039"
          : "https://support.google.com/googleplay/answer/7018481"
      );
    }
  } catch (err) {
    console.log("Could not open store subscriptions URL:", err);
  }
}
