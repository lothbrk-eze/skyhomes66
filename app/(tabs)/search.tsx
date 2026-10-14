import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import axios from "axios";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
// import Chatbot from "../../components/Chatbot"; // SkyHomesAI chatbot — disabled for now
 
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isSaleListing, parseAmount } from "./../../lib/skyhomesaiSearch";
import { useSubscription } from "../../hooks/useSubscription";
import { canUserViewProperty } from "../../lib/subscriptionUtils";

const { width } = Dimensions.get("window");

const API_URL = "https://bombadir.pythonanywhere.com";
const IMAGE_BASE_URL = "https://bombadir.pythonanywhere.com/static/images/";

const COLORS = {
  bg: "#F0F5FF",
  surface: "#FFFFFF",
  surface2: "#F2F2F7",
  border: "#E4E4E9",
  white: "#FFFFFF",
  muted: "#8E8E9A",
  lightMuted: "#5E5E6E",
  accent: "#1E40AF",
  card: "#FFFFFF",
  error: "#DC2626",
  success: "#16a34a",
  mapCard: "#FFFFFF",
  mapBorder: "#E4E4E9",
  mapText: "#1E40AF",
  mapSubtext: "#5E5E6E",
  primary: "#1E40AF",
  primaryLight: "#DBEAFE",
  tabActive: "#1E40AF",
  tabInactive: "#93B4DA",
  filterActive: "#1E40AF",
  filterActiveBg: "#1E40AF",
  filterActiveText: "#FFFFFF",
  overlay: "rgba(0,0,0,0.45)",
  modalBg: "#FFFFFF",
  selectedBg: "#1E40AF",
  selectedText: "#FFFFFF",
};

// ─── Filter Options ───────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { label: "All Types", value: "" },
  { label: "Bedsitter", value: "bedsitter" },
  { label: "Single Room", value: "single" },
  { label: "Studio", value: "studio" },
  { label: "1 Bedroom", value: "1 bedroom" },
  { label: "2 Bedroom", value: "2 bedroom" },
  { label: "3 Bedroom", value: "3 bedroom" },
];

const RENT_RANGES = [
  { label: "Any Rent", min: 0, max: Infinity },
  { label: "Under KES 5,000", min: 0, max: 5000 },
  { label: "KES 5,000 – 10,000", min: 5000, max: 10000 },
  { label: "KES 10,000 – 20,000", min: 10000, max: 20000 },
  { label: "KES 20,000 – 40,000", min: 20000, max: 40000 },
  { label: "KES 40,000 – 80,000", min: 40000, max: 80000 },
  { label: "Above KES 80,000", min: 80000, max: Infinity },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type House = {
  property_id?: number;
  id?: number;
  title: string;
  property_type?: string;
  listing_type?: string;
  address?: string;
  latitude?: string | number;
  longitude?: string | number;
  monthly_rent?: string | number;
  sale_price?: string | number;
  deposit_amount?: string | number;
  description?: string;
  images?: string;
  image?: string;
  is_featured?: boolean | number | string;
  created_at?: string;
  date_added?: string;
};

type RentRange = { label: string; min: number; max: number };

// ─── Dropdown Modal ───────────────────────────────────────────────────────────

type DropdownOption = { label: string; value?: string; min?: number; max?: number };

function FilterDropdown<T extends DropdownOption>({
  visible,
  options,
  selectedLabel,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean;
  options: T[];
  selectedLabel: string;
  onSelect: (opt: T) => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.dropdownSheet}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </Pressable>
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {options.map((opt, i) => {
              const isSelected = opt.label === selectedLabel;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      isSelected && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={COLORS.white} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const webRef = useRef<WebView | null>(null);

  const getHousePrice = (h: House) => {
    const isSale = isSaleListing(h);
    const salePrice = parseAmount(h.sale_price);
    const rentPrice = parseAmount(h.monthly_rent);
    return { isSale, displayPrice: isSale ? salePrice : rentPrice };
  };

  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [localQuery, setLocalQuery] = useState("");

  // Filter state
  const [selectedType, setSelectedType] = useState(PROPERTY_TYPES[0]);
  const [selectedRent, setSelectedRent] = useState<RentRange>(RENT_RANGES[0]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showRentDropdown, setShowRentDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchHouses = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(`${API_URL}/api/getproperties`);
      const data = response.data;
      if (Array.isArray(data)) {
        setHouses(data);
      } else if (Array.isArray(data.properties)) {
        setHouses(data.properties);
      } else {
        setHouses([]);
      }
    } catch {
      setError("Failed to load houses");
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  const { isPremium } = useSubscription();
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchHouses();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const parsed = JSON.parse(raw);
          const u = parsed?.user ? parsed.user : parsed;
          setUserRole(u?.role);
        }
      } catch {}
    })();
  }, []);

  const filteredHouses = useMemo(() => {
    const list = houses.filter((h) => {
      // 3-hour Early Access: during the first 3 hours, listing is hidden from free tenants & guests
      const createdAt = (h as any).created_at || (h as any).date_added || (h as any).created;
      if (!canUserViewProperty(createdAt, userRole, isPremium)) {
        return false;
      }

      // Text search
      if (localQuery.trim()) {
        const q = localQuery.trim().toLowerCase();
        const matches =
          (h.title || "").toLowerCase().includes(q) ||
          (h.address || "").toLowerCase().includes(q) ||
          (h.property_type || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Property type filter
      if (selectedType.value) {
        const hType = (h.property_type || "").toLowerCase();
        if (!hType.includes(selectedType.value.toLowerCase())) return false;
      }

      // Price filter
      const { displayPrice } = getHousePrice(h);
      if (displayPrice < selectedRent.min || displayPrice > selectedRent.max) return false;

      return true;
    });

    // Sort: featured (boosted) listings first
    return [...list].sort((a, b) => {
      const aFeatured = !!(
        a.is_featured === true ||
        a.is_featured === 1 ||
        a.is_featured === "1" ||
        a.is_featured === "true"
      );
      const bFeatured = !!(
        b.is_featured === true ||
        b.is_featured === 1 ||
        b.is_featured === "1" ||
        b.is_featured === "true"
      );
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;
      return 0;
    });
  }, [houses, localQuery, selectedType, selectedRent, userRole, isPremium]);

  const mapHouses = useMemo(() => {
    return filteredHouses.filter(
      (house) =>
        house.latitude !== undefined &&
        house.longitude !== undefined &&
        !isNaN(Number(house.latitude)) &&
        !isNaN(Number(house.longitude))
    );
  }, [filteredHouses]);

  const initialRegion = useMemo(() => {
    if (mapHouses.length > 0) {
      return {
        latitude: Number(mapHouses[0].latitude),
        longitude: Number(mapHouses[0].longitude),
      };
    }
    return { latitude: -1.286389, longitude: 36.817223 };
  }, [mapHouses]);

  const activeFilterCount =
    (selectedType.value ? 1 : 0) + (selectedRent.min > 0 || selectedRent.max < Infinity ? 1 : 0);

  const clearFilters = () => {
    setSelectedType(PROPERTY_TYPES[0]);
    setSelectedRent(RENT_RANGES[0]);
    setLocalQuery("");
  };

  const getHouseId = (house: House) => house.property_id || house.id;

  const getHouseImage = (house: House) => {
    const rawImage = house.images || house.image;
    if (!rawImage) return "https://via.placeholder.com/400x250.png?text=No+Image";
    try {
      const parsed = JSON.parse(rawImage);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstImage = String(parsed[0]).trim();
        return firstImage.startsWith("http") ? firstImage : `${IMAGE_BASE_URL}${firstImage}`;
      }
    } catch {}
    if (typeof rawImage === "string" && rawImage.includes(",")) {
      const firstImage = rawImage.split(",")[0].trim();
      return firstImage.startsWith("http") ? firstImage : `${IMAGE_BASE_URL}${firstImage}`;
    }
    const imageString = String(rawImage).trim();
    return imageString.startsWith("http") ? imageString : `${IMAGE_BASE_URL}${imageString}`;
  };

  const openHouseDetails = (house: House) => {
    const houseId = getHouseId(house);
    if (!houseId) { Alert.alert("Error", "House ID not found"); return; }
    router.push({ pathname: "/house-details", params: { id: String(houseId) } });
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderTopTabs = () => (
    <View style={styles.tabsWrapper}>
      <Pressable style={styles.tabButton} onPress={() => setViewMode("list")}>
        <View style={styles.tabInner}>
          <Ionicons name="list-outline" size={22} color={viewMode === "list" ? COLORS.tabActive : COLORS.tabInactive} />
          <Text style={[styles.tabText, viewMode === "list" && styles.tabTextActive]}>List View</Text>
        </View>
        {viewMode === "list" && <View style={styles.activeUnderline} />}
      </Pressable>
      <Pressable style={styles.tabButton} onPress={() => setViewMode("map")}>
        <View style={styles.tabInner}>
          <Ionicons name="map-outline" size={22} color={viewMode === "map" ? COLORS.tabActive : COLORS.tabInactive} />
          <Text style={[styles.tabText, viewMode === "map" && styles.tabTextActive]}>Map View</Text>
        </View>
        {viewMode === "map" && <View style={styles.activeUnderline} />}
      </Pressable>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchBarRow}>
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by location, title, type..."
          placeholderTextColor={COLORS.muted}
          value={localQuery}
          onChangeText={setLocalQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {localQuery.length > 0 && (
          <Pressable onPress={() => setLocalQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.muted} />
          </Pressable>
        )}
      </View>

      {/* Filter icon button */}
      <Pressable
        style={[styles.filterIconBtn, (showFilters || activeFilterCount > 0) && styles.filterIconBtnActive]}
        onPress={() => setShowFilters((v) => !v)}
        hitSlop={6}
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={(showFilters || activeFilterCount > 0) ? COLORS.white : COLORS.primary}
        />
        {activeFilterCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  const renderFilters = () => {
    if (!showFilters) return null;
    return (
      <View style={styles.filtersRow}>
        {/* Property Type Dropdown */}
        <Pressable
          style={[styles.filterChip, selectedType.value ? styles.filterChipActive : null]}
          onPress={() => setShowTypeDropdown(true)}
        >
        <Ionicons
          name="business-outline"
          size={14}
          color={selectedType.value ? COLORS.white : COLORS.primary}
        />
        <Text style={[styles.filterChipText, selectedType.value && styles.filterChipTextActive]}>
          {selectedType.label}
        </Text>
        <Ionicons
          name="chevron-down"
          size={13}
          color={selectedType.value ? COLORS.white : COLORS.muted}
        />
      </Pressable>

      {/* Rent Range Dropdown */}
      <Pressable
        style={[
          styles.filterChip,
          (selectedRent.min > 0 || selectedRent.max < Infinity) ? styles.filterChipActive : null,
        ]}
        onPress={() => setShowRentDropdown(true)}
      >
        <Ionicons
          name="cash-outline"
          size={14}
          color={(selectedRent.min > 0 || selectedRent.max < Infinity) ? COLORS.white : COLORS.primary}
        />
        <Text
          style={[
            styles.filterChipText,
            (selectedRent.min > 0 || selectedRent.max < Infinity) && styles.filterChipTextActive,
          ]}
          numberOfLines={1}
        >
          {selectedRent.label}
        </Text>
        <Ionicons
          name="chevron-down"
          size={13}
          color={(selectedRent.min > 0 || selectedRent.max < Infinity) ? COLORS.white : COLORS.muted}
        />
      </Pressable>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Pressable style={styles.clearChip} onPress={clearFilters}>
          <Ionicons name="close-circle-outline" size={15} color={COLORS.error} />
          <Text style={styles.clearChipText}>Clear</Text>
        </Pressable>
      )}
    </View>
    );
  };

  const renderHouseCard = ({ item }: { item: House }) => {
    const { isSale, displayPrice } = getHousePrice(item);
    return (
      <Pressable style={styles.card} onPress={() => openHouseDetails(item)}>
        <Image source={{ uri: getHouseImage(item) }} style={styles.cardImage} />
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <View style={styles.typeBadge}>
              <Ionicons name="business-outline" size={13} color={COLORS.primary} />
              <Text style={styles.cardType}>
                {item.property_type || "Property"} {isSale ? "(For Sale)" : "(For Rent)"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color={COLORS.muted} />
            <Text style={styles.cardAddress}>{item.address || "Address not available"}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              KES {displayPrice.toLocaleString()}
              <Text style={styles.priceSmall}>{isSale ? " (Sale Price)" : " / month"}</Text>
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.description}>
            {item.description || "No description available"}
          </Text>
          <View style={styles.actionRow}>
            <View style={styles.detailsButton}>
              <Text style={styles.detailsButtonText}>View Details</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const mapHtml = useMemo(() => {
    const housesPayload = mapHouses
      .map((h) => {
        const { isSale, displayPrice } = getHousePrice(h);
        return {
          id: String(getHouseId(h) ?? ""),
          title: String(h.title ?? "Property"),
          lat: Number(h.latitude),
          lng: Number(h.longitude),
          price: `KES ${displayPrice.toLocaleString()}${isSale ? " (Sale Price)" : " / month"}`,
        };
      })
      .filter((h) => h.id && Number.isFinite(h.lat) && Number.isFinite(h.lng));

    const centerLat = Number(initialRegion.latitude);
    const centerLng = Number(initialRegion.longitude);

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F9F9FB; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function() {
        const houses = ${JSON.stringify(housesPayload)};
        const map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        const bounds = [];
        houses.forEach((h) => {
          const m = L.marker([h.lat, h.lng]).addTo(map);
          m.bindPopup('<b>' + (h.title || 'Property') + '</b><br/>' + (h.price || ''));
          m.on('click', () => {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open', id: h.id }));
            }
          });
          bounds.push([h.lat, h.lng]);
        });
        if (bounds.length === 1) { map.setView(bounds[0], 14); }
        else if (bounds.length > 1) { map.fitBounds(bounds, { padding: [40, 40] }); }
      })();
    </script>
  </body>
</html>`;
  }, [mapHouses, initialRegion]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {renderTopTabs()}
      {renderSearchBar()}
      {renderFilters()}

      {!loading && !error && (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            {filteredHouses.length}{" "}
            {filteredHouses.length === 1 ? "property" : "properties"} found
            {localQuery.trim() ? ` for "${localQuery.trim()}"` : ""}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.infoText}>Loading houses...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={[styles.clearButton, { marginTop: 12 }]} onPress={fetchHouses}>
            <Text style={styles.clearButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : viewMode === "list" ? (
        <FlatList
          data={filteredHouses}
          keyExtractor={(item, index) => String(item.property_id || item.id || index)}
          renderItem={renderHouseCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchHouses}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons name="search-outline" size={42} color={COLORS.muted} />
              <Text style={styles.infoText}>
                {localQuery.trim() || activeFilterCount > 0
                  ? "No properties match your filters"
                  : "No houses found"}
              </Text>
              {activeFilterCount > 0 && (
                <Pressable style={styles.clearButton} onPress={clearFilters}>
                  <Text style={styles.clearButtonText}>Clear Filters</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : (
        <View style={styles.mapWrapper}>
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html: mapHtml }}
            style={styles.map}
            javaScriptEnabled
            domStorageEnabled
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg?.type === "open" && msg?.id) {
                  router.push({ pathname: "/house-details", params: { id: String(msg.id) } });
                }
              } catch {}
            }}
          />
          <View style={styles.mapTopCard}>
            <View style={styles.mapTopCardLeft}>
              <Ionicons name="location" size={16} color={COLORS.mapText} />
              <Text style={styles.mapTopCardTitle}>Property Map</Text>
            </View>
            <Text style={styles.mapTopCardText}>
              {mapHouses.length} location{mapHouses.length === 1 ? "" : "s"} found
            </Text>
          </View>
        </View>
      )}

      {/* Property Type Dropdown Modal */}
      <FilterDropdown
        visible={showTypeDropdown}
        options={PROPERTY_TYPES}
        selectedLabel={selectedType.label}
        onSelect={(opt) => setSelectedType(opt)}
        onClose={() => setShowTypeDropdown(false)}
        title="Property Type"
      />

      {/* Rent Range Dropdown Modal */}
      <FilterDropdown
        visible={showRentDropdown}
        options={RENT_RANGES}
        selectedLabel={selectedRent.label}
        onSelect={(opt) => setSelectedRent(opt as RentRange)}
        onClose={() => setShowRentDropdown(false)}
        title="Rent per Month"
      />

      {/* <Chatbot bottomOffset={72} /> */}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Tabs
  tabsWrapper: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 10,
  },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  tabText: { fontSize: 17, fontWeight: "800", color: COLORS.tabInactive },
  tabTextActive: { color: COLORS.tabActive },
  activeUnderline: {
    width: "100%",
    height: 3,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // Search bar
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    gap: 10,
  },
  searchBarWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterIconBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 999,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
  },

  // ── Filter chips row ──────────────────────────────────────────────────────
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: (width - 32 - 8 * 2) / 2 - 4,
    flexShrink: 1,
  },
  filterChipActive: {
    backgroundColor: COLORS.filterActiveBg,
    borderColor: COLORS.filterActiveBg,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    flexShrink: 1,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.error,
  },

  // Results count
  resultsRow: { paddingHorizontal: 18, paddingVertical: 8 },
  resultsText: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },

  // List
  listContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#1E40AF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardImage: { width: "100%", height: 210, resizeMode: "cover", backgroundColor: COLORS.surface2 },
  cardBody: { padding: 14 },
  topRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 8 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  cardType: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  cardAddress: { flex: 1, fontSize: 14, color: COLORS.lightMuted },
  priceRow: { marginTop: 12, marginBottom: 6 },
  price: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  priceSmall: { fontSize: 13, fontWeight: "500", color: COLORS.muted },
  description: { marginTop: 6, fontSize: 14, color: COLORS.lightMuted, lineHeight: 20 },
  actionRow: { marginTop: 14 },
  detailsButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  detailsButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },

  // Map
  mapWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.mapBorder,
    backgroundColor: COLORS.mapCard,
    position: "relative",
    shadowColor: "#1E40AF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  map: { width: width - 32, height: "100%" },
  mapTopCard: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#1E40AF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  mapTopCardLeft: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  mapTopCardTitle: { color: COLORS.mapText, fontSize: 15, fontWeight: "800" },
  mapTopCardText: { color: COLORS.mapSubtext, fontSize: 13, fontWeight: "600" },

  // Empty state
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  infoText: { marginTop: 10, fontSize: 15, color: COLORS.muted, textAlign: "center" },
  errorText: { fontSize: 15, color: COLORS.error, fontWeight: "700", textAlign: "center" },
  clearButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },

  // ── Dropdown Modal ────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  dropdownSheet: {
    backgroundColor: COLORS.modalBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.primary,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginHorizontal: 12,
    borderRadius: 12,
    marginTop: 2,
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.selectedBg,
    borderColor: "transparent",
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  dropdownItemTextSelected: {
    color: COLORS.selectedText,
    fontWeight: "800",
  },
});