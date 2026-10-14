/**
 * Subscription Utilities for SkyHomes
 * Manages premium features and limits for different user roles
 */

export const TRIAL_DURATION_DAYS = 14;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface UserSubscriptionStatus {
  role: "tenant" | "landlord" | "realtor" | "admin";
  isPremium: boolean;
  isLandlordPremium: boolean;
  isTenantPremium: boolean;
  isRealtorPremium: boolean;
  isTrialActive?: boolean;
  trialDaysRemaining?: number;
}

/**
 * Get listing limits based on user role and premium status
 */
export function getListingLimit(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): number {
  if (role === "landlord") {
    // Landlords can list unlimited properties if premium
    return isPremium ? Infinity : Infinity; // Landlords always unlimited
  }
  if (role === "realtor") {
    // Realtors: 2 listings if free, unlimited if premium
    return isPremium ? Infinity : 2;
  }
  return Infinity;
}

/**
 * Check if a user can post a reel for a house.
 * - Free Realtor: Allowed (free for up to 2 houses)
 * - Premium Realtor: Allowed (unlimited houses & reels)
 * - Landlords: Allowed if premium
 */
export function canPostHouseReel(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): boolean {
  if (role === "realtor") {
    return true;
  }
  if (role === "landlord") {
    return isPremium;
  }
  return false;
}

/**
 * Check if a user can enable priority / boosted listing.
 * Only premium landlords and realtors can boost/prioritize listings.
 */
export function canEnablePriorityListing(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): boolean {
  return (role === "landlord" || role === "realtor") && isPremium;
}

/**
 * Get messaging limits based on user role and premium status
 */
export function getMessagingLimit(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): number {
  if (role === "tenant") {
    // Tenants: 4 landlords if free, unlimited if premium
    return isPremium ? Infinity : 4;
  }
  // Landlords and realtors have unlimited messaging
  return Infinity;
}

/**
 * Check if user can message a landlord
 */
export function canMessageLandlord(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean,
  currentMessageCount: number
): boolean {
  const limit = getMessagingLimit(role, isPremium);
  return currentMessageCount < limit;
}

/**
 * Check if user can add a listing
 */
export function canAddListing(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean,
  currentListingCount: number
): boolean {
  const limit = getListingLimit(role, isPremium);
  return currentListingCount < limit;
}

/**
 * Get premium features for landlord
 */
export function getLandlordPremiumFeatures(isPremium: boolean) {
  return {
    featuredBadge: isPremium,
    priorityListing: isPremium,
    adBoost: isPremium,
    analytics: isPremium,
    unlimitedListings: true, // Always unlimited for landlords
  };
}

/**
 * Get premium features for tenant
 */
export function getTenantPremiumFeatures(isPremium: boolean) {
  return {
    canPlaceInquiries: isPremium,
    unlimitedMessaging: isPremium,
    messagingLimit: isPremium ? Infinity : 4,
    advancedMapFeatures: isPremium,
    schoolsNearby: isPremium,
    hospitalsNearby: isPremium,
    mataturoutesNearby: isPremium,
    firstViewOfNewListings: isPremium,
    earlyAccessHours: 3,
  };
}

/**
 * Only premium tenants can place inquiries.
 */
export function canPlaceInquiry(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): boolean {
  if (role === "tenant" || !role) {
    return isPremium;
  }
  return true;
}

/**
 * Only premium landlords and realtors can post news updates.
 */
export function canPostNews(
  role: "tenant" | "landlord" | "realtor" | "admin" | string | undefined,
  isPremium: boolean
): boolean {
  return (role === "landlord" || role === "realtor") && isPremium;
}

/**
 * Get premium features for realtor
 */
export function getRealtorPremiumFeatures(isPremium: boolean) {
  return {
    unlimitedListings: isPremium,
    listingLimit: isPremium ? Infinity : 2,
    freeHouseReels: true,
    unlimitedReels: isPremium,
    canPostNews: isPremium,
    priorityListings: isPremium,
    featuredPlacement: isPremium,
    advancedAnalytics: isPremium,
    brandingOptions: isPremium,
  };
}

/**
 * Format messaging limit for display
 */
export function formatMessagingLimit(isPremium: boolean, currentCount?: number): string {
  const limit = getMessagingLimit("tenant", isPremium);
  if (limit === Infinity) {
    return "Unlimited";
  }
  if (currentCount !== undefined) {
    return `${currentCount}/${limit}`;
  }
  return `Up to ${limit}`;
}

/**
 * Format listing limit for display
 */
export function formatListingLimit(isPremium: boolean, currentCount?: number): string {
  const limit = getListingLimit("realtor", isPremium);
  if (limit === Infinity) {
    return "Unlimited";
  }
  if (currentCount !== undefined) {
    return `${currentCount}/${limit}`;
  }
  return `Up to ${limit}`;
}

/**
 * Check if a trial is currently active given its start date
 */
export function isTrialActive(startDate: string | number | Date | null | undefined): boolean {
  if (!startDate) return false;
  const startMs = typeof startDate === "number" ? startDate : new Date(startDate).getTime();
  if (isNaN(startMs)) return false;
  const now = Date.now();
  const elapsed = now - startMs;
  return elapsed >= 0 && elapsed < TRIAL_DURATION_MS;
}

/**
 * Calculate remaining days in the 14-day free trial (1 to 14, or 0 if expired)
 */
export function getTrialDaysRemaining(startDate: string | number | Date | null | undefined): number {
  if (!startDate) return 0;
  const startMs = typeof startDate === "number" ? startDate : new Date(startDate).getTime();
  if (isNaN(startMs)) return 0;
  const now = Date.now();
  const elapsed = now - startMs;
  if (elapsed < 0 || elapsed >= TRIAL_DURATION_MS) return 0;
  const msRemaining = TRIAL_DURATION_MS - elapsed;
  return Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

/**
 * Format trial badge / countdown label for display
 */
export function formatTrialBadge(daysRemaining: number): string {
  if (daysRemaining <= 0) return "Trial Expired";
  if (daysRemaining === 1) return "1 day left in trial";
  return `${daysRemaining} days left in trial`;
}

/**
 * Duration of early access in hours for newly uploaded properties.
 * During this 3-hour period, properties are exclusively visible to Premium Tenants,
 * Landlords, Realtors, and Admins.
 */
export const EARLY_ACCESS_HOURS = 3;
export const EARLY_ACCESS_MS = EARLY_ACCESS_HOURS * 60 * 60 * 1000;

/**
 * Check if a property is currently within its 3-hour early access window.
 * Returns false if no valid creation date is provided so legacy listings remain visible.
 */
export function isPropertyInEarlyAccess(
  createdAt: string | number | Date | null | undefined
): boolean {
  if (!createdAt) return false;
  const createdMs = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
  if (isNaN(createdMs)) return false;
  const elapsed = Date.now() - createdMs;
  return elapsed >= 0 && elapsed < EARLY_ACCESS_MS;
}

/**
 * Determines whether a user can view a property.
 * If the property is within the 3-hour early access window:
 * - Premium tenants (including active 14-day trial), landlords, realtors, and admins can view it.
 * - Free tenants / guest users cannot view it (hidden for 3 hours).
 * After 3 hours have passed, it is visible to everyone.
 */
export function canUserViewProperty(
  createdAt: string | number | Date | null | undefined,
  role: string | undefined,
  isPremium: boolean
): boolean {
  // If not in early access, everyone can view
  if (!isPropertyInEarlyAccess(createdAt)) {
    return true;
  }
  // If in early access, only premium users or non-tenant operators can view
  if (isPremium) {
    return true;
  }
  if (role === "landlord" || role === "realtor" || role === "admin") {
    return true;
  }
  // Free tenants and guests cannot view during early access period
  return false;
}

