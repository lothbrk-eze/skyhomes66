// Addhouse.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Linking,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import SubscriptionModal from "./SubscriptionModal";
import { useSubscription } from "../hooks/useSubscription";
import { canAddListing, canPostHouseReel, getListingLimit } from "../lib/subscriptionUtils";
import VideoPreview from "./VideoPreview";
import ReUploadModal from "./ReUploadModal";

const API_URL = "https://bombadir.pythonanywhere.com";

const defaultRegion = {
  latitude: -1.286389,
  longitude: 36.817223,
};

const amenityOptions = [
  "wifi",
  "parking",
  "gym",
  "security",
  "water",
  "furnished",
  "balcony",
];

const MAX_IMAGES = 8;

type SectionProps = {
  id: string;
  title: string;
  openSection: string;
  setOpenSection: React.Dispatch<React.SetStateAction<string>>;
  children: React.ReactNode;
};

type PickedVideo = {
  uri: string;
  type: string;
  name: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Section = ({
  id,
  title,
  openSection,
  setOpenSection,
  children,
}: SectionProps) => {
  const isOpen = openSection === id;

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.85}
        onPress={() => setOpenSection(isOpen ? "" : id)}
      >
        <Text style={styles.sectionHeaderText}>{title}</Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color="#111827"
        />
      </TouchableOpacity>

      {isOpen && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

const formatReverseAddress = (place: Location.LocationGeocodedAddress) => {
  if (!place) return "";

  const parts = [
    place.name,
    place.street,
    place.district,
    place.city,
    place.region,
    place.country,
  ].filter(Boolean);

  return parts.join(", ");
};

const Addhouse = () => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const { isPremium, refreshSubscription } = useSubscription();
  const [subscriptionVisible, setSubscriptionVisible] = useState(false);
  const [reUploadVisible, setReUploadVisible] = useState(false);

  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [listingType, setListingType] = useState<"rent" | "sale">("rent");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [unitsAvailable, setUnitsAvailable] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [leaseDuration, setLeaseDuration] = useState("");
  const [utilitiesIncluded, setUtilitiesIncluded] = useState("No");
  const [utilitiesBreakdown, setUtilitiesBreakdown] = useState("");
  const [landlordNumber, setLandlordNumber] = useState("");
  const [agentPhoneNumber, setAgentPhoneNumber] = useState("");

  const [images, setImages] = useState<any[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  const [videoTour, setVideoTour] = useState<PickedVideo | null>(null);
  const [featuredReel, setFeaturedReel] = useState<PickedVideo | null>(null);

  const [region, setRegion] = useState(defaultRegion);
  const [marker, setMarker] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [locationSearch, setLocationSearch] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [step, setStep] = useState(0);
  const totalSteps = 6;
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isFeaturedListing, setIsFeaturedListing] = useState(false);
  const [propertyCount, setPropertyCount] = useState(0);
  const [loadingPropertyCount, setLoadingPropertyCount] = useState(false);

  const mapRef = useRef<WebView | null>(null);

  const isLoggedIn = !!loggedUser;
  const isLandlord = loggedUser?.role === "landlord";
  const isRealtor = loggedUser?.role === "realtor";
  const canAddProperty = isLandlord || isRealtor;
  const canAddFeaturedReel = canPostHouseReel(loggedUser?.role, isPremium);
  const isRealtorLimitReached = isRealtor && !isPremium && propertyCount >= 2;

  // Fetch realtor property count to enforce free plan 2-house limit
  useEffect(() => {
    const fetchPropertyCount = async () => {
      if (!loggedUser?.user_id || loggedUser?.role !== "realtor") return;
      try {
        setLoadingPropertyCount(true);
        const fd = new FormData();
        fd.append("landlord_id", String(loggedUser.user_id));
        const res = await axios.post(`${API_URL}/api/landlord_properties`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const props = res.data?.properties || [];
        setPropertyCount(props.length);
      } catch (err) {
        console.log("Failed to fetch property count:", err);
      } finally {
        setLoadingPropertyCount(false);
      }
    };
    fetchPropertyCount();
  }, [loggedUser]);

  // Enforce listing type based on role
  useEffect(() => {
    if (isRealtor) {
      setListingType("sale");
    } else if (isLandlord) {
      setListingType("rent");
    }
  }, [isRealtor, isLandlord]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        const username = await AsyncStorage.getItem("username");
        const role = await AsyncStorage.getItem("role");
        const email = await AsyncStorage.getItem("email");
        const phone = await AsyncStorage.getItem("phone");

        if (!stored && !username && !email && !phone) {
          setLoggedUser(null);
          return;
        }

        let parsed: any = null;
        if (stored) {
          try {
            parsed = JSON.parse(stored);
          } catch {
            parsed = null;
          }
        }

        const user = parsed?.user ? parsed.user : parsed;

        const normalizedUser = {
          ...(user || {}),
          user_id: user?.user_id || user?.id || null,
          username: user?.username || username || "",
          email: user?.email || email || "",
          phone: user?.phone || phone || "",
          role: user?.role || role || "",
        };

        setLoggedUser(normalizedUser);

        if (normalizedUser?.phone && !landlordNumber) {
          setLandlordNumber(normalizedUser.phone);
        }
      } catch {
        setLoggedUser(null);
      }
    };

    loadUser();
  }, [landlordNumber]);

  const resetForm = () => {
    setTitle("");
    setPropertyType("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    // Restore role-appropriate default
    setListingType(isRealtor ? "sale" : "rent");
    setMonthlyRent("");
    setDepositAmount("");
    setSalePrice("");
    setUnitsAvailable("");
    setAmenities([]);
    setDescription("");
    setAvailabilityStatus("available");
    setLeaseDuration("");
    setUtilitiesIncluded("No");
    setUtilitiesBreakdown("");
    setAgentPhoneNumber("");
    setImages([]);
    setCoverImageIndex(0);
    setVideoTour(null);
    setFeaturedReel(null);
    setLocationSearch("");
    setRegion(defaultRegion);
    setMarker(null);
    setStep(0);
    setIsFeaturedListing(false);
  };

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((item) => item !== amenity)
        : [...prev, amenity]
    );
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow gallery access.");
      return;
    }

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can upload up to ${MAX_IMAGES} images only.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
    });

    if (!result.canceled && result.assets?.length) {
      const nextImages = [...images, ...result.assets].slice(0, MAX_IMAGES);
      setImages(nextImages);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (coverImageIndex === index) {
        setCoverImageIndex(0);
      } else if (coverImageIndex > index) {
        setCoverImageIndex(coverImageIndex - 1);
      }
      return next;
    });
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow gallery access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets?.length) {
      const video = result.assets[0];

      const pickedVideo: PickedVideo = {
        uri: video.uri,
        type: video.mimeType || "video/mp4",
        name: video.fileName || "tour.mp4",
      };

      setVideoTour(pickedVideo);
    }
  };

  const pickFeaturedReel = async () => {
    if (!canAddFeaturedReel) {
      setSubscriptionVisible(true);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow gallery access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 30,
    });

    if (!result.canceled && result.assets?.length) {
      const video = result.assets[0];

      const pickedVideo: PickedVideo = {
        uri: video.uri,
        type: video.mimeType || "video/mp4",
        name: video.fileName || "featured_reel.mp4",
      };

      setFeaturedReel(pickedVideo);
    }
  };

  const removeVideo = () => {
    setVideoTour(null);
  };

  const removeFeaturedReel = () => {
    setFeaturedReel(null);
  };

  const searchLocationOnMap = async () => {
    try {
      if (!locationSearch.trim()) {
        Alert.alert("Enter location", "Please type a location or address first.");
        return;
      }

      setSearchingLocation(true);
      setError("");

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Location permission is required to search places on the map."
        );
        return;
      }

      const results = await Location.geocodeAsync(locationSearch.trim());

      if (!results || results.length === 0) {
        Alert.alert("Not found", "No matching location was found.");
        return;
      }

      const first = results[0];
      const lat = first.latitude;
      const lng = first.longitude;

      setLatitude(String(lat));
      setLongitude(String(lng));
      setMarker({ latitude: lat, longitude: lng });

      const nextRegion = {
        latitude: lat,
        longitude: lng,
      };

      setRegion(nextRegion);
      mapRef.current?.injectJavaScript(
        `window.__skyhomesSetMarker && window.__skyhomesSetMarker(${lat}, ${lng}); true;`
      );

      if (!address.trim()) {
        setAddress(locationSearch.trim());
      }
    } catch (err) {
      console.log("Geocode search error:", err);
      Alert.alert("Search failed", "Could not search for that location.");
    } finally {
      setSearchingLocation(false);
    }
  };

  const mapClick = async (lat: number, lng: number) => {
    setLatitude(String(lat));
    setLongitude(String(lng));
    setMarker({ latitude: lat, longitude: lng });

    const nextRegion = {
      latitude: lat,
      longitude: lng,
    };

    setRegion(nextRegion);
    mapRef.current?.injectJavaScript(
      `window.__skyhomesSetMarker && window.__skyhomesSetMarker(${lat}, ${lng}); true;`
    );
    setError("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const reversed = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (reversed.length > 0) {
        const formatted = formatReverseAddress(reversed[0]);
        if (formatted) {
          setAddress(formatted);
          setLocationSearch(formatted);
        }
      }
    } catch (err) {
      console.log("Reverse geocode error:", err);
    }
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow location access.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setLatitude(String(lat));
      setLongitude(String(lng));
      setMarker({ latitude: lat, longitude: lng });

      const nextRegion = {
        latitude: lat,
        longitude: lng,
      };

      setRegion(nextRegion);
      mapRef.current?.injectJavaScript(
        `window.__skyhomesSetMarker && window.__skyhomesSetMarker(${lat}, ${lng}); true;`
      );

      try {
        const reversed = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (reversed.length > 0) {
          const formatted = formatReverseAddress(reversed[0]);
          if (formatted) {
            setAddress(formatted);
            setLocationSearch(formatted);
          }
        }
      } catch (err) {
        console.log("Reverse geocode current location error:", err);
      }
    } catch {
      Alert.alert("Location error", "Failed to get current location.");
    }
  };

  const submit = async () => {
    setLoading(true);
    setLoadingText("Uploading property, please wait...");
    setSuccess("");
    setError("");

    try {
      if (!isLoggedIn) {
        setError("Please log in first.");
        return;
      }

      if (!canAddProperty) {
        setError("Only landlords and realtors can add properties.");
        return;
      }

      if (isRealtor && !canAddListing("realtor", isPremium, propertyCount)) {
        const limitMsg =
          "Free realtors can only post a maximum of 2 houses. Upgrade to Realtor Premium for unlimited listings, priority listings, and news updates.";
        setError(limitMsg);
        Alert.alert("Listing Limit Reached", limitMsg, [
          { text: "Later", style: "cancel" },
          { text: "Upgrade to Premium", onPress: () => setSubscriptionVisible(true) },
        ]);
        return;
      }

      if (
        !title ||
        !propertyType ||
        !address ||
        !landlordNumber ||
        !unitsAvailable
      ) {
        setError("Please fill all required fields.");
        return;
      }

      if (listingType === "rent") {
        if (!monthlyRent || !depositAmount) {
          setError("Monthly rent and deposit amount are required for rent listings.");
          return;
        }
      } else {
        if (!salePrice) {
          setError("Sale price is required for sale listings.");
          return;
        }
      }

      if (!latitude || !longitude) {
        setError("Please select the property location.");
        return;
      }

      if (images.length === 0) {
        setError("Please upload at least one property image.");
        return;
      }

      const formdata = new FormData();
      formdata.append("title", title);
      formdata.append("property_type", propertyType);
      formdata.append("listing_type", listingType);
      formdata.append("address", address);
      formdata.append("latitude", latitude);
      formdata.append("longitude", longitude);
      formdata.append("units_available", unitsAvailable);
      formdata.append("amenities", JSON.stringify(amenities));
      formdata.append("description", description);
      formdata.append("availability_status", availabilityStatus);
      formdata.append("utilities_breakdown", utilitiesBreakdown);
      formdata.append("landlord_id", String(loggedUser.user_id));
      formdata.append("landlord_number", landlordNumber);
      formdata.append("agent_phone_number", agentPhoneNumber);
      formdata.append("cover_image_index", String(coverImageIndex));
      formdata.append("is_featured", String(isFeaturedListing && isPremium && (isLandlord || isRealtor)));
      formdata.append("created_at", new Date().toISOString());

      if (listingType === "rent") {
        formdata.append("monthly_rent", monthlyRent);
        formdata.append("deposit_amount", depositAmount);
        formdata.append("lease_duration", leaseDuration);
        formdata.append("utilities_included", utilitiesIncluded);
      } else {
        formdata.append("sale_price", salePrice);
        formdata.append("monthly_rent", "");
        formdata.append("deposit_amount", "");
        formdata.append("lease_duration", "");
        formdata.append("utilities_included", "");
      }

      images.forEach((img, index) => {
        formdata.append("images", {
          uri: img.uri,
          name: img.fileName || `property_${index}.jpg`,
          type: img.mimeType || "image/jpeg",
        } as any);
      });

      if (videoTour) {
        formdata.append("video_tour", {
          uri: videoTour.uri,
          name: videoTour.name || "tour.mp4",
          type: videoTour.type || "video/mp4",
        } as any);
      }

      if (featuredReel) {
        if (!canAddFeaturedReel) {
          Alert.alert(
            "Featured Reel Locked",
            "Only subscribed landlords or realtors can add a featured reel. Your house will be uploaded without the reel."
          );
          setFeaturedReel(null);
        } else {
          formdata.append("featured_video", {
            uri: featuredReel.uri,
            name: featuredReel.name || "featured_reel.mp4",
            type: featuredReel.type || "video/mp4",
          } as any);
          formdata.append("featured_title", title);
        }
      }

      const response = await axios.post(`${API_URL}/api/addproperty`, formdata, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const successMsg = response.data.message || "Property added successfully.";
      setSuccess(successMsg);

      // Notify all users about the newly uploaded house
      try {
        const notifyForm = new FormData();
        const priceNum = Number(listingType === "rent" ? monthlyRent : salePrice);
        const formattedPrice = isNaN(priceNum) || priceNum <= 0
          ? (listingType === "rent" ? "Rent on request" : "Contact agent for price")
          : `KES ${priceNum.toLocaleString()}`;
        
        const priceLabelText = listingType === "rent" ? `${formattedPrice}/month` : `${formattedPrice}`;
        const notifyMessageText = `A new house has been uploaded: "${title}" in ${address || "unknown location"} for ${priceLabelText}.`;
        
        notifyForm.append("message", notifyMessageText);
        notifyForm.append("title", "New House Uploaded");
        
        await axios.post(`${API_URL}/api/admin/send_notification`, notifyForm, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        console.log("Upload notification sent to all users successfully");
      } catch (notifyErr: any) {
        console.log("FAILED TO SEND UPLOAD NOTIFICATION:", notifyErr?.response?.data || notifyErr.message);
      }

      Alert.alert(
        "Success",
        successMsg,
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              router.replace("/(tabs)");
            },
          },
        ]
      );
    } catch (err: any) {
      console.log("UPLOAD ERROR:", err?.response?.data || err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to add property"
      );
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const openInExternalMap = () => {
    if (marker) {
      const url = `https://www.openstreetmap.org/?mlat=${marker.latitude}&mlon=${marker.longitude}#map=16/${marker.latitude}/${marker.longitude}`;
      Linking.openURL(url);
    }
  };

  const mapHtml = React.useMemo(() => {
    const centerLat = Number(region.latitude);
    const centerLng = Number(region.longitude);
    const markerLat = marker ? Number(marker.latitude) : null;
    const markerLng = marker ? Number(marker.longitude) : null;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F8FAFC; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function() {
        const map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        let marker = null;

        function setMarker(lat, lng) {
          if (marker) {
            marker.setLatLng([lat, lng]);
          } else {
            marker = L.marker([lat, lng]).addTo(map);
          }
          map.setView([lat, lng], 16);
        }

        window.__skyhomesSetMarker = setMarker;

        map.on('click', function(e) {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          setMarker(lat, lng);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick', lat, lng }));
          }
        });

        ${markerLat != null && markerLng != null ? `setMarker(${markerLat}, ${markerLng});` : ""}
      })();
    </script>
  </body>
</html>`;
  }, [region.latitude, region.longitude, marker]);

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Login Required</Text>
        <Text style={styles.subText}>
          You must log in as a landlord or realtor before adding a property.
        </Text>
        <TouchableOpacity
          style={styles.successButton}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.successButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!canAddProperty) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.subText}>
          Only users logged in as landlords or realtors can add properties.
        </Text>
      </View>
    );
  }

  if ((isLandlord || isRealtor) && loggedUser?.verification_status === "rejected") {
    return (
      <View style={styles.center}>
        <Ionicons name="close-circle" size={48} color="#DC2626" style={{ marginBottom: 12 }} />
        <Text style={styles.errorTitle}>Verification Failed</Text>
        <Text style={styles.subText}>
          Your submitted documents were rejected. Please upload new, clear photos of your ID
          and proof of ownership so the admin can review and approve your account.
        </Text>
        <TouchableOpacity
          style={[styles.successButton, { backgroundColor: "#DC2626", marginTop: 20, flexDirection: "row", gap: 8 }]}
          onPress={() => setReUploadVisible(true)}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.successButtonText}>Re-upload Documents</Text>
        </TouchableOpacity>
        {reUploadVisible && loggedUser?.user_id && (
          <ReUploadModal
            visible={reUploadVisible}
            onClose={() => setReUploadVisible(false)}
            userId={loggedUser.user_id}
            onUploadSuccess={async (updatedUser) => {
              try {
                const rawUser = updatedUser?.user ? updatedUser.user : updatedUser;
                const storedStr = await AsyncStorage.getItem("user");
                let parsed = storedStr ? JSON.parse(storedStr) : {};
                const merged = { ...(parsed?.user ? parsed.user : parsed), ...rawUser };
                await AsyncStorage.setItem("user", JSON.stringify(merged));
                setLoggedUser(merged);
              } catch (e) {
                console.error("Failed to persist re-upload:", e);
              }
              setReUploadVisible(false);
            }}
          />
        )}
      </View>
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Basic Info</Text>
            <Text style={styles.stepSubtitle}>
              Let&apos;s start with the basics of your property.
            </Text>

            <Text style={styles.label}>Property Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: Sunset Apartments"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Property Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="Examples: apartment, bedsitter"
              placeholderTextColor="#9CA3AF"
              value={propertyType}
              onChangeText={setPropertyType}
            />

            <Text style={styles.label}>Listing Type</Text>
            <View style={styles.listingTypeBadge}>
              <Ionicons
                name={listingType === "rent" ? "home-outline" : "briefcase-outline"}
                size={18}
                color="#2563EB"
              />
              <Text style={styles.listingTypeBadgeText}>
                {listingType === "rent" ? "For Rent" : "For Sale"}
              </Text>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Location</Text>
            <Text style={styles.stepSubtitle}>
              Where is this property located?
            </Text>

            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: South B, Nairobi"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={setAddress}
            />

            <Text style={styles.label}>Search on Map</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Search area"
                placeholderTextColor="#9CA3AF"
                value={locationSearch}
                onChangeText={setLocationSearch}
              />
              <TouchableOpacity
                style={styles.mapSearchBtn}
                onPress={searchLocationOnMap}
                disabled={searchingLocation}
              >
                {searchingLocation ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="search" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.currentLocBtn}
              onPress={useCurrentLocation}
            >
              <Ionicons name="location-outline" size={18} color="#2563EB" />
              <Text style={styles.currentLocText}>Use Current Location</Text>
            </TouchableOpacity>

            <View style={styles.mapContainer}>
              <WebView
                ref={mapRef}
                originWhitelist={["*"]}
                source={{ html: mapHtml }}
                style={styles.map}
                javaScriptEnabled
                domStorageEnabled
                onMessage={(e) => {
                  try {
                    const msg = JSON.parse(e.nativeEvent.data);
                    if (
                      msg?.type === "mapClick" &&
                      msg?.lat != null &&
                      msg?.lng != null
                    ) {
                      mapClick(Number(msg.lat), Number(msg.lng));
                    }
                  } catch {}
                }}
              />
              {marker && (
                <TouchableOpacity
                  style={styles.mapOverlay}
                  onPress={openInExternalMap}
                >
                  <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.mapOverlayText}>Tap to open in Maps</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.hintText}>
              📍 Drag map or tap to place the marker at property location
            </Text>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Pricing & Units</Text>
            <Text style={styles.stepSubtitle}>
              Set the price and availability.
            </Text>

            {listingType === "rent" ? (
              <>
                <Text style={styles.label}>Monthly Rent (KES) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 15,000 or 15k"
                  placeholderTextColor="#9CA3AF"
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  keyboardType="default"
                />
                <Text style={styles.label}>Deposit Amount (KES) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 15,000 or 15k"
                  placeholderTextColor="#9CA3AF"
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  keyboardType="default"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Sale Price (KES) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5,000,000 or 5m"
                  placeholderTextColor="#9CA3AF"
                  value={salePrice}
                  onChangeText={setSalePrice}
                  keyboardType="default"
                />
              </>
            )}

            <Text style={styles.label}>Number of Units Available *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 3"
              placeholderTextColor="#9CA3AF"
              value={unitsAvailable}
              onChangeText={setUnitsAvailable}
              keyboardType="numeric"
            />
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Property Details</Text>
            <Text style={styles.stepSubtitle}>
              What makes this property special?
            </Text>

            <Text style={styles.label}>Amenities</Text>
            <View style={styles.amenitiesWrap}>
              {amenityOptions.map((amenity) => {
                const selected = amenities.includes(amenity);
                return (
                  <TouchableOpacity
                    key={amenity}
                    style={[
                      styles.amenityChip,
                      selected && styles.amenityChipActive,
                    ]}
                    onPress={() => toggleAmenity(amenity)}
                  >
                    <Text
                      style={[
                        styles.amenityText,
                        selected && styles.amenityTextActive,
                      ]}
                    >
                      {amenity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the property..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Availability Status</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. available, coming soon"
              placeholderTextColor="#9CA3AF"
              value={availabilityStatus}
              onChangeText={setAvailabilityStatus}
            />

            {listingType === "rent" && (
              <>
                <Text style={styles.label}>Lease Duration</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. monthly, 6 months"
                  placeholderTextColor="#9CA3AF"
                  value={leaseDuration}
                  onChangeText={setLeaseDuration}
                />
                <Text style={styles.label}>Utilities Included</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Water and WiFi"
                  placeholderTextColor="#9CA3AF"
                  value={utilitiesIncluded}
                  onChangeText={setUtilitiesIncluded}
                />
              </>
            )}

            <Text style={styles.label}>Utilities Breakdown</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Detailed breakdown..."
              placeholderTextColor="#9CA3AF"
              value={utilitiesBreakdown}
              onChangeText={setUtilitiesBreakdown}
              multiline
            />
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Photos & Video</Text>
            <Text style={styles.stepSubtitle}>
              Showcase your property with great media.
            </Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
              <Ionicons name="images-outline" size={24} color="#2563EB" />
              <Text style={styles.uploadBtnText}>
                {images.length > 0
                  ? `Selected ${images.length} / ${MAX_IMAGES} Images`
                  : "Pick Property Images *"}
              </Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.previewRow}
              >
                {images.map((img, index) => (
                  <View key={`${img.uri}-${index}`} style={styles.previewCard}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setCoverImageIndex(index)}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.previewImage}
                      />
                      {coverImageIndex === index && (
                        <View style={styles.coverBadge}>
                          <Ionicons name="star" size={12} color="#FFFFFF" />
                          <Text style={styles.coverBadgeText}>Cover</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.uploadBtn} onPress={pickVideo}>
              <Ionicons name="videocam-outline" size={24} color="#2563EB" />
              <Text style={styles.uploadBtnText}>
                {videoTour ? "Change Video Tour" : "Pick Video Tour (optional)"}
              </Text>
            </TouchableOpacity>

            {!!videoTour && (
              <View style={styles.videoCard}>
                <VideoPreview
                  uri={videoTour.uri}
                  style={styles.videoPreview}
                  nativeControls
                  contentFit="cover"
                  loop
                  shouldPlay
                />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={removeVideo}
                >
                  <Text style={styles.removeMediaButtonText}>Remove Video</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.uploadBtn,
                !canAddFeaturedReel && { opacity: 0.7 },
              ]}
              onPress={pickFeaturedReel}
              activeOpacity={0.9}
            >
              <Ionicons name="star-outline" size={24} color="#2563EB" />
              <Text style={styles.uploadBtnText}>
                {canAddFeaturedReel
                  ? featuredReel
                    ? "Change Featured Reel"
                    : isRealtor && !isPremium
                    ? "Pick Free Featured Reel (For This House)"
                    : isRealtor && isPremium
                    ? "Pick Featured Reel (Unlimited)"
                    : "Pick Featured Reel (Premium)"
                  : "Unlock Featured Reel (Subscribe)"}
              </Text>
            </TouchableOpacity>

            {!canAddFeaturedReel && (
              <Text style={styles.lockHint}>
                🔒 Featured reels are available to subscribed landlords only.
              </Text>
            )}

            {isRealtor && !isPremium && (
              <Text style={styles.freeReelHint}>
                ✨ Free house reel included for your listing.
              </Text>
            )}

            {!!featuredReel && (
              <View style={styles.videoCard}>
                <VideoPreview
                  uri={featuredReel.uri}
                  style={styles.videoPreview}
                  nativeControls
                  contentFit="cover"
                  loop
                  shouldPlay
                />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={removeFeaturedReel}
                >
                  <Text style={styles.removeMediaButtonText}>Remove Reel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Contact & Submit</Text>
            <Text style={styles.stepSubtitle}>
              Almost done! Add contact details.
            </Text>

            <Text style={styles.label}>Landlord Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0712345678"
              placeholderTextColor="#9CA3AF"
              value={landlordNumber}
              onChangeText={setLandlordNumber}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Agent Phone Number (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0712345678"
              placeholderTextColor="#9CA3AF"
              value={agentPhoneNumber}
              onChangeText={setAgentPhoneNumber}
              keyboardType="phone-pad"
            />

            {/* Boost Listing Section */}
            {(isLandlord || isRealtor) && (
              <View style={styles.boostContainer}>
                <View style={styles.boostHeader}>
                  <Ionicons name="rocket-outline" size={18} color="#7C3AED" />
                  <Text style={styles.boostTitle}>Priority Listing (Boost)</Text>
                  {isPremium ? (
                    <View style={styles.premiumBadgeSmall}>
                      <Text style={styles.premiumBadgeTextSmall}>Active Features</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.unlockBadge}
                      activeOpacity={0.8}
                      onPress={() => setSubscriptionVisible(true)}
                    >
                      <Ionicons name="lock-closed" size={10} color="#7C3AED" />
                      <Text style={styles.unlockBadgeText}>Unlock with Premium</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.boostDescription}>
                  Prioritize your property at the top of search results. Boosted listings are viewed first.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.boostButton,
                    isFeaturedListing && styles.boostButtonActive,
                    !isPremium && styles.boostButtonDisabled,
                  ]}
                  activeOpacity={isPremium ? 0.8 : 0.9}
                  onPress={() => {
                    if (isPremium) {
                      setIsFeaturedListing(!isFeaturedListing);
                    } else {
                      setSubscriptionVisible(true);
                    }
                  }}
                >
                  <Ionicons
                    name={isFeaturedListing ? "star" : "star-outline"}
                    size={16}
                    color={isFeaturedListing ? "#FFFFFF" : isPremium ? "#7C3AED" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.boostButtonText,
                      isFeaturedListing && styles.boostButtonTextActive,
                      !isPremium && styles.boostButtonTextDisabled,
                    ]}
                  >
                    {isFeaturedListing ? "Priority Listing Enabled" : "Enable Priority Listing"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!!loadingText && (
              <Text style={styles.infoText}>{loadingText}</Text>
            )}
            {!!success && <Text style={styles.successText}>{success}</Text>}
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SubscriptionModal
        visible={subscriptionVisible}
        context={isRealtor ? "realtor_signup" : "listing_boost"}
        onClose={() => setSubscriptionVisible(false)}
        onLater={() => setSubscriptionVisible(false)}
        onSubscribed={async () => {
          await refreshSubscription();
          setSubscriptionVisible(false);
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.headerBtnText}>Save & exit</Text>
        </TouchableOpacity>
      </View>

      {isRealtorLimitReached && (
        <View style={styles.limitWarningBanner}>
          <Ionicons name="alert-circle" size={20} color="#D97706" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.limitWarningTitle}>2 House Limit Reached</Text>
            <Text style={styles.limitWarningText}>
              Free realtors can post a maximum of 2 houses. Upgrade to Realtor Premium for unlimited listings, priority listings, and news updates.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.limitWarningBtn}
            onPress={() => setSubscriptionVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.limitWarningBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <View style={styles.progressBar}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= step && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.footerControls}>
          {step > 0 ? (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}

          {step < totalSteps - 1 ? (
            <TouchableOpacity
              onPress={() => setStep(step + 1)}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, loading && { opacity: 0.7 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.nextBtnText}>Upload Property</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Addhouse;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    lineHeight: 38,
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 30,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  hintText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  listingTypeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  listingTypeOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  listingTypeActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  listingTypeDisabled: {
    opacity: 0.5,
  },
  listingTypeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  listingTypeTextActive: {
    color: "#2563EB",
  },
  listingTypeTextDisabled: {
    color: "#9CA3AF",
  },
  listingTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listingTypeBadgeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },
  realtorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  realtorNoticeText: {
    flex: 1,
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },
  mapSearchBtn: {
    backgroundColor: "#2563EB",
    width: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  currentLocText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 15,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapOverlayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  amenitiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 8,
  },
  amenityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 10,
    marginBottom: 10,
  },
  amenityChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  amenityText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  amenityTextActive: {
    color: "#FFFFFF",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 16,
    backgroundColor: "#EFF6FF",
  },
  uploadBtnText: {
    color: "#2563EB",
    fontSize: 16,
    fontWeight: "700",
  },
  previewRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  previewCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
    position: "relative",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  coverBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coverBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  videoCard: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  videoPreview: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  removeMediaButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    alignItems: "center",
  },
  removeMediaButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  lockHint: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
    marginTop: -8,
  },
  // ─── Section component styles ───────────────────────────────────────────────
  sectionCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F9FAFB",
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // ────────────────────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingBottom: 30,
  },
  progressBar: {
    flexDirection: "row",
    height: 4,
    width: "100%",
    backgroundColor: "#E5E7EB",
  },
  progressSegment: {
    flex: 1,
    backgroundColor: "transparent",
  },
  progressSegmentActive: {
    backgroundColor: "#2563EB",
  },
  footerControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textDecorationLine: "underline",
  },
  nextBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  successText: {
    color: "#16A34A",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 8,
  },
  subText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  successButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  boostContainer: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  boostHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  boostTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4C1D95",
    marginLeft: 6,
  },
  premiumBadgeSmall: {
    backgroundColor: "#DDD6FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    marginLeft: "auto",
  },
  premiumBadgeTextSmall: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4C1D95",
  },
  unlockBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    marginLeft: "auto",
  },
  unlockBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6D28D9",
    marginLeft: 3,
  },
  boostDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 14,
  },
  boostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  boostButtonActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  boostButtonDisabled: {
    opacity: 0.6,
  },
  boostButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
  },
  boostButtonTextActive: {
    color: "#FFFFFF",
  },
  boostButtonTextDisabled: {
    color: "#6B7280",
  },
  freeReelHint: {
    fontSize: 12,
    color: "#059669",
    marginTop: 6,
    fontWeight: "500",
  },
  limitWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 8,
  },
  limitWarningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  limitWarningText: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 16,
  },
  limitWarningBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  limitWarningBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});