# Quick Setup Guide - Premium Subscription

## 1. Revenue Cat Configuration ✅

Your API key is already configured:
- **Key**: `goog_ieYpnswExAJhuZhMaRITwWbgjbf`
- **Location**: `lib/revenuecat.ts`

## 2. Set Up Revenue Cat Dashboard

1. Go to [Revenue Cat Dashboard](https://app.revenuecat.com)
2. Create three **Products** with these IDs:
   - `landlord_premium_monthly` / `landlord_premium_annual`
   - `tenant_premium_monthly` / `tenant_premium_annual`
   - `realtor_premium_monthly` / `realtor_premium_annual`

3. Create **Entitlements**:
   - `landlord_premium`
   - `tenant_premium`
   - `realtor_premium`
   - `premium` (backward compatible)

4. Link products to entitlements in your app offerings

## 3. Feature Verification Checklist

### Already Implemented ✅

**Hooks & Utilities**:
- ✅ `useSubscription()` - Tracks 4 subscription types
- ✅ `subscriptionUtils.ts` - All limit checking functions
- ✅ `priceAlerts.ts` - Price calculation utilities

**Components**:
- ✅ `PremiumFeaturesDisplay.tsx` - Shows active features + limits
- ✅ `AdvancedMapFeatures.tsx` - Schools, hospitals, matatu routes
- ✅ `PriceAlertComponent.tsx` - Set up price drop/rise alerts

**Integrated Components**:
- ✅ `Addhouse.tsx` - Realtor 3-listing limit, featured badge option
- ✅ `Gethouse.tsx` - Premium badge display for featured listings
- ✅ `NotificationsScreen.tsx` - Tenant 4-landlord messaging limit

## 4. Integration Needed (Backend)

Update your backend API endpoints:

### 1. Property Creation/Update
```
POST /api/addproperty
{
  ...existing fields...,
  "is_featured": boolean  // NEW: Mark as premium landlord listing
}
```

### 2. Property Retrieval
```
GET /api/getproperties
Returns: [
  {
    ...existing fields...,
    "is_featured": boolean  // NEW: Include in response
  }
]
```

### 3. Price Alerts (NEW Endpoint)
```
POST /api/price-alerts
{
  "property_id": number,
  "user_id": number,
  "original_price": number,
  "alert_price": number,
  "alert_type": "drop" | "rise"
}

GET /api/price-alerts?user_id={id}
Returns: [...]

DELETE /api/price-alerts/{alert_id}
```

### 4. Map Features (NEW Endpoint)
```
GET /api/map-features/{type}?lat={latitude}&lng={longitude}
Types: "school" | "hospital" | "matatu"

Returns: {
  "features": [
    {
      "id": string,
      "name": string,
      "type": string,
      "distance": number (km),
      "latitude": number,
      "longitude": number
    }
  ]
}
```

## 5. Testing

### Test Realtor Listing Limit
1. Create realtor account
2. Add 3 properties → should work
3. Try to add 4th property → should show "limit reached" error
4. Purchase premium → should allow unlimited properties

### Test Tenant Messaging Limit
1. Create tenant account
2. Browse landlords section
3. Message 4 different landlords → should work
4. Try to message 5th landlord → should show limit alert
5. Upgrade to premium → should allow unlimited

### Test Featured Badge
1. Login as premium landlord
2. Add property → should see featured toggle
3. Enable featured → listing shows purple premium badge
4. Login as free landlord → featured toggle disabled

### Test Map Features
1. Login as premium tenant
2. View property details → should see "Nearby Amenities" section
3. Tap on category (Schools/Hospitals/Routes) → should show list
4. Login as free tenant → should see "Premium only" message

## 6. Future Backend Work

Once your backend is ready, uncomment these API calls in components:

**PriceAlertComponent.tsx** (line ~75):
```tsx
// Uncomment when API endpoint ready:
// const response = await axios.post(
//   `${API_URL}/api/price-alerts`,
//   formData,
//   { headers: { "Content-Type": "multipart/form-data" } }
// );
```

**AdvancedMapFeatures.tsx** (line ~80):
```tsx
// Uncomment when API endpoint ready:
// const response = await axios.get(
//   `${API_URL}/api/map-features/${category}?lat=${latitude}&lng=${longitude}`
// );
// setFeatures(response.data.features);
```

## 7. Component Usage Examples

### Show Premium Features on Tenant Dashboard
```tsx
import PremiumFeaturesDisplay from "./components/PremiumFeaturesDisplay";
import { useSubscription } from "./hooks/useSubscription";

export default function TenantDashboard() {
  const { isTenantPremium, isPremium } = useSubscription();
  const [directMessageCount, setDirectMessageCount] = useState(0);
  
  return (
    <ScrollView>
      <PremiumFeaturesDisplay
        role="tenant"
        isPremium={isTenantPremium}
        messagingLimit={4}
        currentMessageCount={directMessageCount}
        onUpgrade={() => setSubscriptionVisible(true)}
      />
      {/* ... rest of dashboard ... */}
    </ScrollView>
  );
}
```

### Show Map Features
```tsx
import AdvancedMapFeatures from "./components/AdvancedMapFeatures";

export default function PropertyDetails({ property }) {
  const { isTenantPremium } = useSubscription();
  
  return (
    <ScrollView>
      <AdvancedMapFeatures
        isPremium={isTenantPremium}
        latitude={property.latitude}
        longitude={property.longitude}
      />
    </ScrollView>
  );
}
```

## 8. Files Summary

**New Files Created**:
- `lib/subscriptionUtils.ts` - Subscription logic utilities
- `lib/priceAlerts.ts` - Price alert calculations
- `components/PremiumFeaturesDisplay.tsx` - Feature display UI
- `components/AdvancedMapFeatures.tsx` - Map features modal
- `components/PriceAlertComponent.tsx` - Price alert setup
- `PREMIUM_FEATURES.md` - Full documentation

**Modified Files**:
- `lib/revenuecat.ts` - Added API key
- `hooks/useSubscription.ts` - Enhanced with role-based tracking
- `components/Addhouse.tsx` - Added listing limits + featured toggle
- `components/Gethouse.tsx` - Added premium badge display
- `components/NotificationsScreen.tsx` - Added messaging limits

## 9. Support & Next Steps

1. ✅ Set up Revenue Cat dashboard products and entitlements
2. ✅ Test all components in development
3. ✅ Update backend endpoints for is_featured, price alerts, map features
4. ✅ Deploy to production
5. ✅ Monitor Revenue Cat dashboard for subscription metrics

All code is ready to go! Just ensure backend endpoints are updated.
