# SkyHomes Premium Subscription System

This document describes the complete premium subscription system implemented for SkyHomes, which uses Revenue Cat as the backend payment processor.

## Overview

The premium subscription system provides role-based features and limits for three user types: **Tenants**, **Landlords**, and **Realtors**.

---

## Revenue Cat Setup

**API Key**: `goog_ieYpnswExAJhuZhMaRITwWbgjbf`

### Entitlements
The system uses four main entitlements:
- `landlord_premium` - For premium landlords
- `tenant_premium` - For premium tenants  
- `realtor_premium` - For premium realtors
- `premium` - Fallback/generic premium (backward compatible)

---

## Premium Features by Role

### 🏠 LANDLORDS

#### Free Plan
- Unlimited property listings
- Standard listing priority
- Standard search visibility

#### Premium Plan ⭐
- **Featured Badge**: Premium badge appears on listings with purple star icon
- **Priority Visibility**: Listings appear higher in search results
- **Featured Reel**: Can upload featured property videos (30s max)
- **Ad Boost**: Listings get boosted visibility for 7 days
- **Analytics**: View listing impressions and inquiries

**Feature Implementation**:
- Added `is_featured` field to property creation form in `Addhouse.tsx`
- Featured listings display a purple premium badge in `Gethouse.tsx`
- Toggle in property form only available to premium landlords

---

### 👔 REALTORS

#### Free Plan
- **Listing Limit**: 2 active house listings maximum
- **Free House Reels**: Can upload video reel for free for both houses
- Standard search visibility
- Basic property management

#### Premium Plan ⭐
- **Unlimited Listings**: Can list unlimited properties
- **Unlimited Free Reels**: Add featured reels to unlimited listings
- **Post News**: Post real estate news and availability updates to the community feed
- **Priority Listings**: Priority ranking boosted to the top of search with purple Priority badge
- **Advanced Analytics**: Detailed inquiry statistics and buyer leads
- **Branding Options**: Custom property descriptions and styling

**Feature Implementation**:
- Property count tracking in `Addhouse.tsx`
- Listing limit enforced before submission and in `Landlorddashboard.tsx`
- Error message prompts upgrade when 2-house limit is reached
- `canAddListing()` utility function enforces 2-house limit
- `canPostHouseReel()` unlocks free reels for realtors
- `canEnablePriorityListing()` and `canPostNews()` guard priority listing and news posting for premium realtors

---

### 👨‍💼 TENANTS

#### Free Plan
- **Messaging Limit**: Can message up to 4 landlords
- Standard property browsing
- Save favorite properties
- Standard search filters

#### Premium Plan ⭐
- **Custom Inquiries**: Place custom house inquiries to match specific budget and criteria
- **Unlimited Messaging**: Contact unlimited landlords
- **Advanced Map Features**:
  - View nearby schools
  - View nearby hospitals
  - View nearby matatu routes
- **3-Hour Early Access**: Exclusive viewing of newly listed properties for the first 3 hours
- **Saved Searches**: Save multiple search preferences

**Feature Implementation**:
- Custom inquiry restriction enforced in `Inquiry.tsx`
- Messaging limit enforced in `NotificationsScreen.tsx`
- Direct message count tracked from unique landlords in inquiries
- `AdvancedMapFeatures.tsx` - Modal showing schools, hospitals, matatu routes
- `PremiumFeaturesDisplay.tsx` - Shows active features and limits

---

## Key Components

### Hooks
- **`useSubscription()`** (`hooks/useSubscription.ts`)
  - Tracks subscription status for all roles
  - Exports `isPremium`, `isLandlordPremium`, `isTenantPremium`, `isRealtorPremium`
  - Exports `ENTITLEMENTS` constant with all entitlement IDs

### Utilities
- **`subscriptionUtils.ts`** (`lib/subscriptionUtils.ts`)
  - `getListingLimit()` - Returns 3 for free realtors, unlimited for premium
  - `getMessagingLimit()` - Returns 4 for free tenants, unlimited for premium
  - `canAddListing()` - Check before adding property
  - `canMessageLandlord()` - Check before messaging
  - Premium feature getter functions

- **`priceAlerts.ts`** (`lib/priceAlerts.ts`)
  - `calculatePriceChange()` - Compute % change and direction
  - `shouldTriggerPriceAlert()` - Threshold-based alert logic
  - `formatPriceAlertMessage()` - Create alert notification text
  - `formatCurrency()` - Format prices in KES

### Components
- **`PremiumFeaturesDisplay.tsx`** - Shows active features, limits, and upgrade button
- **`AdvancedMapFeatures.tsx`** - Modal for viewing nearby amenities
- **`PriceAlertComponent.tsx`** - Set up price drop/rise alerts
- **`SubscriptionModal.tsx`** (enhanced) - Show subscription plans based on context

---

## Updated Components

### Addhouse.tsx
- Added import: `canAddListing` from `subscriptionUtils`
- Added states: `propertyCount`, `isFeaturedListing`, `loadingProperties`
- Added `useEffect` to load property count for realtors
- Added listing limit check in `submit()` function
- Added `is_featured` field to form data (only if premium landlord)
- Added featured listing toggle to UI

### Gethouse.tsx
- Added purple premium badge display for `is_featured` listings
- Badge shows "Premium" with star icon
- Displays alongside existing featured reel badge

### NotificationsScreen.tsx
- Added `useSubscription()` hook
- Added messaging limit check in `startDirectChat()`
- Added `directMessageCount` state
- Count unique landlords from inquiries to track limits
- Shows alert if tenant tries to message >4 landlords without premium

### TenantDashboard.tsx
- Ready to integrate `PremiumFeaturesDisplay` component
- Ready to integrate `AdvancedMapFeatures` component
- Ready to integrate `PriceAlertComponent` in property details

---

## Backend API Integration

### Expected Endpoints

1. **Get Property Count** (already exists)
   - POST `/api/landlord_properties`
   - Returns: `{ properties: [...] }`

2. **Create/Update Property** (modify endpoint)
   - POST `/api/addproperty`
   - New field: `is_featured` (boolean)
   - Should persist and return in property details

3. **Get Properties** (modify response)
   - GET `/api/getproperties`
   - Should include `is_featured` field in each property

4. **Price Alerts** (implement if not exists)
   - POST `/api/price-alerts` - Set up new alert
   - GET `/api/price-alerts` - Get user's alerts
   - Should track original price and alert threshold

5. **Map Features** (implement)
   - GET `/api/map-features/{type}?lat={lat}&lng={lng}` - Get nearby amenities
   - Types: `school`, `hospital`, `matatu`

---

## Usage Example

### For Tenant
```tsx
import { useSubscription } from "../hooks/useSubscription";
import { getMessagingLimit } from "../lib/subscriptionUtils";
import PremiumFeaturesDisplay from "./PremiumFeaturesDisplay";
import AdvancedMapFeatures from "./AdvancedMapFeatures";

function TenantScreen() {
  const { isTenantPremium } = useSubscription();
  const limit = getMessagingLimit("tenant", isTenantPremium);
  
  return (
    <>
      <PremiumFeaturesDisplay 
        role="tenant" 
        isPremium={isTenantPremium}
        messagingLimit={limit}
        currentMessageCount={3}
      />
      <AdvancedMapFeatures 
        isPremium={isTenantPremium}
        latitude={-1.2865}
        longitude={36.8172}
      />
    </>
  );
}
```

### For Realtor
```tsx
import { canAddListing } from "../lib/subscriptionUtils";

function AddPropertyScreen() {
  const { isRealtorPremium } = useSubscription();
  
  const handleAddProperty = async () => {
    if (!canAddListing("realtor", isRealtorPremium, propertyCount)) {
      Alert.alert("Limit reached", "Upgrade to Premium for unlimited listings");
      return;
    }
    // proceed with form submission
  };
}
```

---

## Subscription Tiers

Create these tiers in Revenue Cat dashboard:

### Landlord Premium
- Monthly: $9.99
- Annual: $99.99
- Entitlement: `landlord_premium`

### Tenant Premium
- Monthly: $4.99
- Annual: $49.99
- Entitlement: `tenant_premium`

### Realtor Premium
- Monthly: $19.99
- Annual: $199.99
- Entitlement: `realtor_premium`

---

---

## 🎁 14-Day Free Trial System

SkyHomes now includes a comprehensive 14-day free trial system for all premium features.

### Key Capabilities
- **Dual Layer Support**:
  1. **Instant In-App Free Trial**: 1-tap activation via `startFreeTrial()` in `useSubscription()`, stored in `AsyncStorage` (`skyhomes_trial_start_${userId}`, `skyhomes_trial_used_${userId}`). No credit card or store transaction required.
  2. **Store-Managed Free Trial**: Compatible with Apple App Store and Google Play introductory trial offers via RevenueCat (`periodType === "TRIAL"`).
- **Full Feature Unlock**:
  - While active, `isTrialActive = true`, and all role flags (`isPremium`, `isLandlordPremium`, `isTenantPremium`, `isRealtorPremium`) evaluate to `true`.
  - Landlords: Unlimited listings, featured property badge, priority visibility.
  - Realtors: Unlimited active listings (removes 3-listing cap), featured placement.
  - Tenants: Unlimited landlord messaging (removes 4-contact cap), advanced map features, price drop alerts, first view access.
- **Trial Lifecycle & Status**:
  - `trialDaysRemaining`: Real-time countdown from 14 days down to 1.
  - Visual badges and countdown banners in `SubscriptionModal`, `PlanCard`, `PremiumFeaturesDisplay`, `TenantDashboard`, and `Landlorddashboard`.
  - Once completed, users are gently prompted to subscribe to keep their premium perks.

---

## Testing Checklist

- [ ] Free trial can be activated with 1 tap from SubscriptionModal
- [ ] Active trial displays countdown banner with remaining days
- [ ] During trial, tenants can message unlimited landlords (>4)
- [ ] During trial, realtors can add unlimited listings (>2)
- [ ] During trial, landlords can enable `is_featured` badges on listings
- [ ] Trial state persists across app reloads and user sessions
- [ ] Subscribing to store package with free trial works correctly
- [ ] Free realtors can only add up to 2 house listings without premium/trial
- [ ] Free realtors can upload house reels for free for their 2 houses
- [ ] Premium realtors can add unlimited house listings and reels
- [ ] Premium realtors can post news updates and enable priority listings
- [ ] Priority listings show purple priority badge when `is_featured=true` and sort first
- [ ] Tenants can only message 4 landlords without premium/trial
- [ ] Premium tenants can message unlimited landlords
- [ ] Advanced map features show only for premium tenants
- [ ] Price alerts work for premium tenants
- [ ] Subscription modal shows correct plans for each role
- [ ] Purchasing a subscription updates user's premium status
- [ ] Restoring purchases works correctly
- [ ] Logout and login preserves subscription status

---

## Future Enhancements

1. Implement actual map features backend (schools, hospitals, matatu routes)
2. Add push notifications for price alerts
3. Add email notifications for price alerts
4. Analytics dashboard for landlords and realtors
5. [x] Trial period support (14-day free trial implemented)
6. Gift codes for premium access
7. Family sharing for subscriptions
8. Promo codes and discounts

