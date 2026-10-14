import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
  Dimensions,
  ScrollView,
} from "react-native";
import axios from "axios";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { VideoView, useVideoPlayer } from "expo-video";
import { isSaleListing, parseAmount, resolveListingKind } from "../lib/skyhomesaiSearch";
import { useSubscription } from "../hooks/useSubscription";
import { canUserViewProperty } from "../lib/subscriptionUtils";
import SubscriptionModal from "./SubscriptionModal";

const API_URL = "https://bombadir.pythonanywhere.com";
const IMAGE_BASE_URL = "https://bombadir.pythonanywhere.com/static/images/";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_IMAGE_WIDTH = SCREEN_WIDTH;
const CARD_IMAGE_HEIGHT = CARD_IMAGE_WIDTH * (11 / 20);

const COLORS = {
  bg: "#F0F5FF", // Cool blue-tinted background
  white: "#FFFFFF",
  black: "#000000",
  text: "#0F172A", // Deep blue-black text
  subtext: "#4B6CB7", // Blue-grey subtext
  line: "#DBEAFE", // Blue-tinted divider line
  accent: "#1E40AF", // Deep blue accents/buttons
  orange: "#2563EB",
  orangeTint: "#EFF6FF",
  star: "#FFC043", // Global gold star color
  heartBg: "rgba(255,255,255,0.95)",
  chipBg: "#DBEAFE",
  chipActiveBg: "#2563EB",
  chipText: "#1E40AF",
  chipActiveText: "#FFFFFF",
  searchBg: "#FFFFFF",
  inputText: "#0F172A",
  shadow: "rgba(37, 99, 235, 0.06)",
  error: "#E11900", // High contrast red
  saleTag: "#2563EB",
};

const CATEGORIES = [
  { id: "All", label: "All stays", icon: "business-outline" },
  { id: "Apartment", label: "Apartments", icon: "home-outline" },
  { id: "Studio", label: "Studios", icon: "cube-outline" },
  { id: "Bedsitter", label: "Bedsitters", icon: "apps-outline" },
  { id: "Single Room", label: "Single Rooms", icon: "person-outline" },
];

type UserType = {
  user_id: number | string | null;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
} | null;

type HouseType = {
  is_featured?: boolean;
  property_id: number | string;
  title?: string;
  property_type?: string;
  listing_type?: string;
  description?: string;
  address?: string;
  location?: string;
  monthly_rent?: number | string;
  sale_price?: number | string;
  deposit_amount?: number | string;
  units_available?: number | string;
  images?: any;
  featured_video?: string;
  featured_title?: string;
  is_featured_reel?: boolean;
  is_verified?: boolean;
  created_at?: string;
  date_added?: string;
};

type ReelType = {
  property_id: number | string;
  title?: string;
  address?: string;
  listing_type?: "rent" | "sale" | string;
  monthly_rent?: number | string;
  sale_price?: number | string;
  images?: any;
  featured_video?: string;
  featured_title?: string;
  created_at?: string;
  date_added?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toFullMediaUrl = (value: any): string => {
  const str = String(value || "").trim();
  if (!str) return "";
  return str.startsWith("http") ? str : IMAGE_BASE_URL + str;
};

const parseImagesStatic = (images: any): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images
      .map((img) => {
        const value = String(img).trim();
        if (!value) return null;
        return value.startsWith("http") ? value : IMAGE_BASE_URL + value;
      })
      .filter(Boolean) as string[];
  }
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) {
      return parsed
        .map((img) => {
          const value = String(img).trim();
          if (!value) return null;
          return value.startsWith("http") ? value : IMAGE_BASE_URL + value;
        })
        .filter(Boolean) as string[];
    }
  } catch {}
  if (typeof images === "string") {
    return images
      .split(",")
      .map((img) => img.trim())
      .filter(Boolean)
      .map((img) => (img.startsWith("http") ? img : IMAGE_BASE_URL + img));
  }
  return [];
};

// A house shows as a card only when it is a rent listing.
// listing_type="sale" → reel; listing_type="rent" → card;
// no listing_type set → card only if sale_price is absent/zero.
const isRentListing = (item: HouseType | ReelType): boolean => {
  const type = String(item.listing_type || "").toLowerCase().trim();
  if (type === "sale") return false;
  if (type === "rent") return true;
  const sp = parseAmount(item.sale_price);
  return sp <= 0;
};

// ─── Inline Autoplay Reel Card ────────────────────────────────────────────────
const ReelCard = React.memo(({
  item,
  isActive,
  onPress,
}: {
  item: ReelType;
  isActive: boolean;
  onPress: () => void;
}) => {
  const videoUri = !item.featured_video
    ? ""
    : item.featured_video.startsWith("http")
    ? item.featured_video
    : IMAGE_BASE_URL + item.featured_video;

  const player = useVideoPlayer(videoUri || "", (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    if (!videoUri) return;
    try {
      if (isActive) {
        player.play();
        const timer = setTimeout(() => {
          try { player.pause(); } catch {}
        }, 6000);
        return () => clearTimeout(timer);
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive, videoUri, player]);

  const coverImage =
    parseImagesStatic(item.images)[0] ||
    "https://via.placeholder.com/500x700.png?text=Featured";

  const isSale = isSaleListing(item);
  const displayPrice = isSale ? parseAmount(item.sale_price) : parseAmount(item.monthly_rent);

  return (
    // Plain View, not Touchable — the tap is handled by the dedicated
    // Pressable overlay below. VideoView is backed by a native SurfaceView
    // on Android, which on some devices is hardware-composited ABOVE the
    // rest of the view hierarchy regardless of z-index, silently eating
    // touches meant for a wrapping TouchableOpacity. The overlay + elevation
    // combo below forces the tap target back on top reliably.
    <View style={styles.reelCard}>
      {videoUri ? (
        <View
          pointerEvents="none"
          style={styles.reelImage}
          renderToHardwareTextureAndroid
        >
          <VideoView
            player={player}
            style={[styles.reelImage, { borderRadius: 24 }]}
            nativeControls={false}
            contentFit="cover"
            pointerEvents="none"
          />
        </View>
      ) : (
        <Image source={{ uri: coverImage }} style={styles.reelImage} />
      )}

      {/* Sale badge – top-left corner */}
      {isSale && (
        <View style={styles.reelSaleBadge} pointerEvents="none">
          <Ionicons name="pricetag" size={11} color={COLORS.white} />
          <Text style={styles.reelSaleBadgeText}>For Sale</Text>
        </View>
      )}

      <View style={styles.reelOverlay} pointerEvents="none">
        <Text style={styles.reelTitle} numberOfLines={1}>
          {item.featured_title || item.title || "Featured Home"}
        </Text>
        {isSale ? (
          displayPrice > 0 && (
            <Text style={styles.reelPrice}>
              KES {displayPrice.toLocaleString()}
            </Text>
          )
        ) : (
          displayPrice > 0 && (
            <Text style={styles.reelPrice}>
              {`KES ${displayPrice.toLocaleString()}/mo`}
            </Text>
          )
        )}
      </View>

      {/* Dedicated touch-catcher, rendered last so it sits above the
          SurfaceView-backed VideoView. Android needs `elevation`, not just
          zIndex, to actually win the stacking order for touch dispatch
          against a native surface. */}
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: false }}
        style={({ pressed }) => [
          StyleSheet.absoluteFillObject,
          { borderRadius: 24, overflow: "hidden", zIndex: 10, opacity: pressed ? 0.85 : 1 },
        ]}
      />
    </View>
  );
});
ReelCard.displayName = "ReelCard";

// ─── Sticky Search Bar ────────────────────────────────────────────────────────
const StickySearchBar = React.memo(({
  locationQuery,
  setLocationQuery,
}: {
  locationQuery: string;
  setLocationQuery: (text: string) => void;
}) => (
  <View style={styles.stickySearchWrap}>
    <View style={styles.stickySearchBar}>
      <Ionicons name="search-outline" size={17} color="#8F96A3" />
      <TextInput
        style={styles.stickySearchInput}
        placeholder="Search houses in any location"
        placeholderTextColor="#A1A7B3"
        value={locationQuery}
        onChangeText={setLocationQuery}
        returnKeyType="search"
      />
      {locationQuery.length > 0 && (
        <Pressable onPress={() => setLocationQuery("")} hitSlop={8}>
          <Ionicons name="close-circle" size={17} color="#A1A7B3" />
        </Pressable>
      )}
    </View>
  </View>
));
StickySearchBar.displayName = "StickySearchBar";

// ─── FlatList Header ──────────────────────────────────────────────────────────
const HousesListHeader = React.memo(({
  featuredReels,
  placesCount,
  activeReelId,
  setActiveReelId,
  onReelPress,
  isPremium,
  onUpgradePress,
}: {
  featuredReels: ReelType[];
  placesCount: number;
  activeReelId: string | null;
  setActiveReelId: (id: string | null) => void;
  onReelPress: (item: ReelType) => void;
  isPremium?: boolean;
  onUpgradePress?: () => void;
}) => {
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        setActiveReelId(String(viewableItems[0].item.property_id));
      } else {
        setActiveReelId(null);
      }
    },
    [setActiveReelId]
  );

  return (
    <View>
      {featuredReels.length > 0 && (
        <View style={styles.reelsSection}>
          <View style={styles.reelsHeader}>
            {/* Updated heading to reflect mixed content */}
            <Text style={styles.reelsHeading}>Featured</Text>
          </View>
          <FlatList
            ref={flatListRef}
            data={featuredReels}
            horizontal
            keyExtractor={(item) => `reel-${item.property_id}`}
            renderItem={({ item }) => (
              <ReelCard
                item={item}
                isActive={activeReelId === String(item.property_id)}
                onPress={() => onReelPress(item)}
              />
            )}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig.current}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reelsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
      <View style={styles.sectionTop}>
        <View>
          <Text style={styles.sectionTitle}>Popular stays</Text>
          <Text style={styles.sectionCount}>{placesCount} places</Text>
        </View>
        {!isPremium && onUpgradePress && (
          <TouchableOpacity
            style={styles.upgradeHeaderBtn}
            onPress={onUpgradePress}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={13} color="#2563EB" />
            <Text style={styles.upgradeHeaderBtnText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
HousesListHeader.displayName = "HousesListHeader";

// ─── Main Component ───────────────────────────────────────────────────────────
const Gethouse = () => {
  const [loading, setLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [houses, setHouses] = useState<HouseType[]>([]);
  const [featuredReels, setFeaturedReels] = useState<ReelType[]>([]);
  const [error, setError] = useState("");

  const [locationQuery, setLocationQuery] = useState("");
  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  const { isPremium, loading: subscriptionLoading, refreshSubscription } = useSubscription();
  const [loggedUser, setLoggedUser] = useState<UserType>(null);
  const [savedHouseIds, setSavedHouseIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const paywallContext = useMemo(() => {
    if (loggedUser?.role === "realtor") return "realtor_signup";
    if (loggedUser?.role === "landlord") return "listing_boost";
    return "tenant_premium";
  }, [loggedUser?.role]);

  const hasInitialized = useRef(false);

  const parseImages = useCallback((images: any): string[] => parseImagesStatic(images), []);

  const normalizeStoredUser = useCallback(async (): Promise<UserType> => {
    try {
      const savedUser = await AsyncStorage.getItem("user");
      const savedUserName = await AsyncStorage.getItem("username");
      const savedRole = await AsyncStorage.getItem("role");
      const savedEmail = await AsyncStorage.getItem("email");
      const savedPhone = await AsyncStorage.getItem("phone");

      let normalizedUser: UserType = null;

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const user = parsedUser?.user ? parsedUser.user : parsedUser;
        normalizedUser = {
          user_id: user?.user_id ?? user?.id ?? null,
          username: user?.username ?? savedUserName ?? "",
          email: user?.email ?? savedEmail ?? "",
          phone: user?.phone ?? savedPhone ?? "",
          role: user?.role ?? savedRole ?? "",
        };
      } else if (savedUserName || savedEmail || savedPhone) {
        normalizedUser = {
          user_id: null,
          username: savedUserName ?? "",
          role: savedRole ?? "",
          email: savedEmail ?? "",
          phone: savedPhone ?? "",
        };
      }
      setLoggedUser(normalizedUser);
      return normalizedUser;
    } catch {
      setLoggedUser(null);
      return null;
    }
  }, []);

  const refreshSavedHouses = useCallback(async (activeUser?: UserType) => {
    try {
      if (!activeUser?.user_id) { setSavedHouseIds([]); return; }
      const formData = new FormData();
      formData.append("user_id", String(activeUser.user_id));
      const response = await axios.post(`${API_URL}/api/my_saved_houses`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const savedList = Array.isArray(response.data) ? response.data : response.data?.houses || [];
      setSavedHouseIds(savedList.map((item: any) => String(item.property_id)));
    } catch {
      setSavedHouseIds([]);
    }
  }, []);

  // ─── UPDATED: fetchFeaturedReels now merges sale listings into reels ────────
  const fetchFeaturedReels = useCallback(async (allHouses?: HouseType[]) => {
    try {
      const [featuredRes] = await Promise.all([
        axios.get(`${API_URL}/api/featured_properties`),
      ]);

      const featured: ReelType[] = Array.isArray(featuredRes.data) ? featuredRes.data : [];

      // Convert sale listings from the main house list into reel entries
      const source = allHouses ?? houses;
      const saleAsReels: ReelType[] = source
        .filter((h) => isSaleListing(h))
        .map((h) => ({
          property_id: h.property_id,
          title: h.title,
          address: h.address,
          listing_type: "sale" as const,
          sale_price: h.sale_price,
          monthly_rent: h.monthly_rent,
          images: h.images,
          featured_video: h.featured_video,
          featured_title: h.featured_title,
        }));

      // Merge: sale listings first, then featured API entries overwrite by id
      const map = new Map<string, ReelType>();
      saleAsReels.forEach((r) => map.set(String(r.property_id), r));
      featured.forEach((r) => map.set(String(r.property_id), r));

      const merged = Array.from(map.values());
      setFeaturedReels(merged);
      if (merged.length > 0) setActiveReelId(String(merged[0].property_id));
    } catch {
      setFeaturedReels([]);
    }
  }, [houses]);

  const fetchHouses = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading("Please wait...");
      setError("");
      const response = await axios.get(`${API_URL}/api/getproperties`);
      const data: HouseType[] = Array.isArray(response.data) ? response.data : [];
      setHouses(data);
      // Pass the fresh data directly so fetchFeaturedReels doesn't read stale state
      return data;
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load houses");
      return [] as HouseType[];
    } finally {
      if (showLoader) setLoading("");
    }
  }, []);

  const init = useCallback(async () => {
    try {
      setLoading("Please wait...");
      setError("");
      const normalizedUser = await normalizeStoredUser();
      // Fetch houses first so sale listings are available for the reels merge
      const allHouses = await fetchHouses(false);
      await Promise.all([
        fetchFeaturedReels(allHouses),
        refreshSavedHouses(normalizedUser),
      ]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load houses");
    } finally {
      setLoading("");
    }
  }, [normalizeStoredUser, refreshSavedHouses, fetchHouses, fetchFeaturedReels]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    init();
  }, [init]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const normalizedUser = await normalizeStoredUser();
      const allHouses = await fetchHouses(false);
      await Promise.all([
        fetchFeaturedReels(allHouses),
        refreshSavedHouses(normalizedUser),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHouses, fetchFeaturedReels, normalizeStoredUser, refreshSavedHouses]);

  const combinedHouses = useMemo<HouseType[]>(() => {
    const map = new Map<string, HouseType>();

    houses.forEach((house) => {
      map.set(String(house.property_id), {
        ...house,
        is_featured_reel: false,
        created_at: (house as any).created_at,
        date_added: (house as any).date_added,
        is_featured: Boolean(
          (house as any).is_featured === true ||
          (house as any).is_featured === 1 ||
          (house as any).is_featured === "1" ||
          (house as any).is_featured === "true"
        ),
      });
    });

    featuredReels.forEach((reel) => {
      const id = String(reel.property_id);
      const existing = map.get(id);
      if (existing) {
        map.set(id, {
          ...existing,
          featured_video: reel.featured_video,
          featured_title: reel.featured_title,
          is_featured_reel: true,
          created_at: (reel as any).created_at || existing.created_at,
          date_added: (reel as any).date_added || existing.date_added,
        });
      }
      // Sale-only or reel-only entries are intentionally NOT added to combinedHouses
      // — they live exclusively in the reels strip.
    });

    return Array.from(map.values());
  }, [houses, featuredReels]);

  // ─── UPDATED: cards show rent listings only, sorted by is_featured DESC ────
  const filteredHouses = useMemo(() => {
    const list = combinedHouses.filter((house) => {
      // Only rent listings appear as cards
      if (!isRentListing(house)) return false;
      // Location search
      const location = (house.address || house.location || "").toLowerCase();
      if (locationQuery.trim() && !location.includes(locationQuery.trim().toLowerCase())) return false;

      // 3-hour Early Access: during the first 3 hours after upload, listing is visible ONLY to premium tenants, landlords, realtors, admins
      const createdAt = (house as any).created_at || (house as any).date_added || (house as any).created;
      if (!canUserViewProperty(createdAt, loggedUser?.role, isPremium)) {
        return false;
      }

      return true;
    });

    // Sort: featured (boosted) listings first
    return [...list].sort((a, b) => {
      const aFeatured = !!a.is_featured;
      const bFeatured = !!b.is_featured;
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;
      return 0;
    });
  }, [combinedHouses, locationQuery, loggedUser?.role, isPremium]);

  const visibleFeaturedReels = useMemo(() => {
    return featuredReels.filter((reel) => {
      const createdAt = (reel as any).created_at || (reel as any).date_added || (reel as any).created;
      return canUserViewProperty(createdAt, loggedUser?.role, isPremium);
    });
  }, [featuredReels, loggedUser?.role, isPremium]);

  const goToDetails = useCallback((propertyId: number | string) => {
    router.push({ pathname: "/house-details", params: { id: String(propertyId) } });
  }, []);

  const goToReelViewer = useCallback(
    (reel: ReelType) => {
      const list = featuredReels
        .map((r) => ({
          id: String(r.property_id),
          video: toFullMediaUrl(r.featured_video),
          title: r.featured_title || r.title || "Featured Home",
          listing_type: r.listing_type,
          sale_price: r.sale_price || 0,
          monthly_rent: r.monthly_rent || 0,
        }))
        .filter((r) => r.id && r.video);
      const initialIndex = Math.max(0, list.findIndex((x) => x.id === String(reel.property_id)));
      router.push({
        pathname: "/featured-reels" as any,
        params: { reels: JSON.stringify(list), index: String(initialIndex) },
      });
    },
    [featuredReels]
  );

  const handleSaveHouse = useCallback(
    async (propertyId: number | string) => {
      try {
        if (!loggedUser?.user_id) {
          Alert.alert("Login required", "Please login first to save houses.");
          return;
        }
        const propertyIdStr = String(propertyId);
        setSavingId(propertyIdStr);
        const isSaved = savedHouseIds.includes(propertyIdStr);
        const formData = new FormData();
        formData.append("user_id", String(loggedUser.user_id));
        formData.append("property_id", propertyIdStr);

        if (isSaved) {
          await axios.post(`${API_URL}/api/remove_saved_house`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setSavedHouseIds((prev) => prev.filter((id) => id !== propertyIdStr));
          Alert.alert("Removed", "House removed from saved.");
        } else {
          await axios.post(`${API_URL}/api/save_house`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setSavedHouseIds((prev) => (prev.includes(propertyIdStr) ? prev : [...prev, propertyIdStr]));
          Alert.alert("Saved", "House saved.");
        }
      } catch (err: any) {
        Alert.alert("Error", err?.response?.data?.message || "Failed to update saved houses.");
      } finally {
        setSavingId(null);
      }
    },
    [loggedUser, savedHouseIds]
  );

  const getDisplayLocation = (item: HouseType) =>
    item.address || item.location || "Location not available";

  const renderHouseCard = useCallback(
    ({ item }: { item: HouseType }) => {
      const propertyId = String(item.property_id);
      const imageList = parseImages(item.images);
      const coverImage = imageList[0] || "https://via.placeholder.com/700x500.png?text=No+Image";
      const isSaved = savedHouseIds.includes(propertyId);
      const isSaving = savingId === propertyId;
      const rentPrice = parseAmount(item.monthly_rent);

      return (
        <TouchableOpacity activeOpacity={0.92} style={styles.card} onPress={() => goToDetails(item.property_id)}>
          <View style={styles.imageWrap}>
            <Image source={{ uri: coverImage }} style={styles.cardImage} />

            {/* Price tag – bottom-left */}
            {rentPrice > 0 && (
              <View style={styles.priceTag}>
                <Text style={styles.priceTagAmount}>KES {rentPrice.toLocaleString()}</Text>
                <Text style={styles.priceTagMonth}>/mo</Text>
              </View>
            )}

            {/* Featured badge for reel items */}
            {item.is_featured_reel && (
              <View style={styles.featuredBadge}>
                <Ionicons name="play-circle" size={12} color="#fff" />
                <Text style={styles.featuredBadgeText}>Featured</Text>
              </View>
            )}

            {/* Priority listing badge */}
            {item.is_featured && !item.is_featured_reel && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.featuredBadgeText}>Priority</Text>
              </View>
            )}

            {/* Heart / save button */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.heartBtn}
              onPress={() => handleSaveHouse(item.property_id)}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={20}
                  color={isSaved ? COLORS.accent : "#9CA3AF"}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || "Modern Apartment in Nairobi"}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={COLORS.subtext} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {getDisplayLocation(item)}
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={11} color={COLORS.star} />
                <Text style={styles.ratingText}>4.9</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.detailsBtn}
                onPress={() => goToDetails(item.property_id)}
              >
                <Text style={styles.detailsBtnText}>View Details</Text>
                <Ionicons name="arrow-forward" size={13} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [goToDetails, handleSaveHouse, parseImages, savedHouseIds, savingId]
  );

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>{loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.mainContent}>
        <StickySearchBar locationQuery={locationQuery} setLocationQuery={setLocationQuery} />
        <FlatList
          style={styles.list}
          data={filteredHouses}
          keyExtractor={(item) => String(item.property_id)}
          renderItem={renderHouseCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <HousesListHeader
              featuredReels={visibleFeaturedReels}
              placesCount={filteredHouses.length}
              activeReelId={activeReelId}
              setActiveReelId={setActiveReelId}
              onReelPress={goToReelViewer}
              isPremium={isPremium}
              onUpgradePress={() => setPaywallVisible(true)}
            />
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="home-outline" size={42} color={COLORS.subtext} />
              <Text style={styles.emptyTitle}>No houses found</Text>
              <Text style={styles.emptyText}>Try changing the search term.</Text>
            </View>
          }
          ListFooterComponent={
            error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={{ height: 26 }} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
              progressBackgroundColor={COLORS.white}
            />
          }
        />

        <SubscriptionModal
          visible={paywallVisible}
          context={paywallContext}
          requireSubscription={false}
          onClose={() => setPaywallVisible(false)}
          onLater={() => setPaywallVisible(false)}
          onSubscribed={async () => {
            setPaywallVisible(false);
            await refreshSubscription();
          }}
        />
      </View>
    </View>
  );
};

export default Gethouse;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  mainContent: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 26 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  loadingText: { marginTop: 12, color: COLORS.text, fontSize: 15, fontWeight: "600" },

  stickySearchWrap: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  stickySearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  stickySearchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },

  reelsSection: { marginTop: 20 },
  reelsHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reelsHeading: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  reelsList: { paddingLeft: 20, paddingRight: 8 },
  reelCard: {
    width: 170,
    height: 250,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden",
  },
  reelImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: "#EDEFF3",
    borderRadius: 24,
  },
  reelOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 48,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: "transparent",
  },
  reelTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelPrice: {
    marginTop: 4,
    color: "#F3F4F6",
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Sale badge on reel cards
  reelSaleBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reelSaleBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  sectionTop: {
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  sectionCount: { fontSize: 13, fontWeight: "700", color: COLORS.subtext },
  upgradeHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  upgradeHeaderBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },

  card: {
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 0,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrap: { position: "relative" },
  cardImage: {
    width: CARD_IMAGE_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    resizeMode: "cover",
    backgroundColor: "#EDEFF3",
  },

  priceTag: {
    position: "absolute",
    left: 0,
    bottom: 0,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceTagAmount: { color: COLORS.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  priceTagMonth: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", marginLeft: 2 },

  featuredBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(17,17,17,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  featuredBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },

  verifiedBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    backgroundColor: COLORS.heartBg,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  cardInfo: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { color: COLORS.subtext, fontSize: 12, fontWeight: "500", flex: 1 },

  cardActions: { alignItems: "flex-end", gap: 8 },

  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFF8EC",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ratingText: { color: "#92600A", fontSize: 12, fontWeight: "800" },

  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailsBtnText: { color: COLORS.white, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 50 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "800", color: COLORS.text },
  emptyText: { marginTop: 6, textAlign: "center", color: COLORS.subtext, fontSize: 14 },
  errorBox: {
    marginTop: 18,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { color: COLORS.error, textAlign: "center", fontSize: 13, fontWeight: "700" },
});