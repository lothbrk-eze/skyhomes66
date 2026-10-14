import React, { useMemo, useState } from "react";
import { Tabs, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Text,
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 50 : 52;

const COLORS = {
  background: "#F0F4FF",
  headerBg: "#0B1426",
  tabBg: "#0B1426",
  white: "#FFFFFF",
  black: "#0B1426",
  text: "#FFFFFF",
  subtext: "#7BA4D4",
  border: "#1E3560",
  card: "#132040",
  accent: "#2563EB",
  soft: "#1E3560",
  overlay: "rgba(11,20,38,0.65)",
  activeTab: "#FFFFFF",
  inactiveTab: "#4D7AB0",
};

// ─── Header Left: Brand ───────────────────────────────────────────────────────
const HeaderLeft = () => (
  <View style={styles.headerLeftWrap}>
    <Text style={styles.brand}>skyhomes</Text>
  </View>
);

// ─── Profile Dropdown ─────────────────────────────────────────────────────────
const ProfileDropdown = ({
  visible,
  onClose,
  onProfile,
  onLogout,
  username,
}: {
  visible: boolean;
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
  username: string;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.profileDropdown}>
        <View style={styles.profileTop}>
          <Ionicons name="person-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.profileTopText} numberOfLines={1}>
            {username || "My Account"}
          </Text>
        </View>
        <TouchableOpacity style={styles.dropdownItem} activeOpacity={0.85} onPress={onProfile}>
          <Ionicons name="person-outline" size={17} color={COLORS.white} />
          <Text style={styles.dropdownItemText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownItem} activeOpacity={0.85} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={17} color="#FF6B6B" />
          <Text style={[styles.dropdownItemText, { color: "#FF6B6B" }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── Header Right ─────────────────────────────────────────────────────────────
const HeaderRight = ({
  username,
  role,
  isLoggedIn,
  onOpenProfileMenu,
}: {
  username: string | null;
  role: string | null;
  isLoggedIn: boolean;
  onOpenProfileMenu: () => void;
}) => {
  const canList =
    role === "landlord" ||
    role === "Landlord" ||
    role === "realtor" ||
    role === "Realtor";

  if (isLoggedIn && username) {
    return (
      <View style={styles.headerRightRow}>
        {canList && (
          <TouchableOpacity
            style={styles.listPropertyButton}
            activeOpacity={0.85}
            onPress={() => router.push("/add-house")}
          >
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.listPropertyButtonText}>List Property</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.welcomeBox}
          onPress={onOpenProfileMenu}
        >
          <Ionicons name="person-circle-outline" size={18} color={COLORS.white} />
          <Text style={styles.welcomeText} numberOfLines={1}>{username}</Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.subtext} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.authButtonsWrap}>
      <TouchableOpacity
        style={styles.signInButton}
        activeOpacity={0.85}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.signUpButton}
        activeOpacity={0.85}
        onPress={() => router.push("/signup")}
      >
        <Text style={styles.signUpButtonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── More Drawer ──────────────────────────────────────────────────────────────
const MoreDrawer = ({
  visible,
  onClose,
  anchorBottom,
}: {
  visible: boolean;
  onClose: () => void;
  anchorBottom: number;
}) => {
  const goTo = (path: "/profile" | "/about-us" | "/contact-us" | "/inquiry" | "/news-tab") => {
    onClose();
    setTimeout(() => router.push(path as any), 120);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.drawer, { bottom: anchorBottom }]}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>More</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.drawerItem} activeOpacity={0.85} onPress={() => goTo("/about-us")}>
            <View style={styles.drawerIconBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.white} />
            </View>
            <View style={styles.drawerTextBox}>
              <Text style={styles.drawerItemText}>About Us</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerItem} activeOpacity={0.85} onPress={() => goTo("/contact-us")}>
            <View style={styles.drawerIconBox}>
              <Ionicons name="call-outline" size={16} color={COLORS.white} />
            </View>
            <View style={styles.drawerTextBox}>
              <Text style={styles.drawerItemText}>Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerItem} activeOpacity={0.85} onPress={() => goTo("/inquiry")}>
            <View style={styles.drawerIconBox}>
              <Ionicons name="chatbubbles-outline" size={16} color={COLORS.white} />
            </View>
            <View style={styles.drawerTextBox}>
              <Text style={styles.drawerItemText}>Inquiry</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerItem} activeOpacity={0.85} onPress={() => goTo("/news-tab")}>
            <View style={styles.drawerIconBox}>
              <Ionicons name="newspaper-outline" size={16} color={COLORS.white} />
            </View>
            <View style={styles.drawerTextBox}>
              <Text style={styles.drawerItemText}>News</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Custom Header ────────────────────────────────────────────────────────────
const CustomHeader = ({
  username,
  role,
  isLoggedIn,
  onOpenProfileMenu,
}: {
  username: string | null;
  role: string | null;
  isLoggedIn: boolean;
  onOpenProfileMenu: () => void;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.customHeaderContainer, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <HeaderLeft />
        <HeaderRight
          username={username}
          role={role}
          isLoggedIn={isLoggedIn}
          onOpenProfileMenu={onOpenProfileMenu}
        />
      </View>
    </View>
  );
};

// ─── Tab Layout ───────────────────────────────────────────────────────────────
function TabLayoutContent() {
  // ── Pull everything from AuthContext — no more raw AsyncStorage reads ──────
  const { logout, username, role, isLoggedIn } = useAuth();

  const [moreVisible, setMoreVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const moreDrawerBottom = insets.bottom + TAB_BAR_HEIGHT + 10;

  const handleLogout = async () => {
    setProfileMenuVisible(false);
    setMoreVisible(false);
    await logout(); // clears AsyncStorage AND resets context state atomically
    
  };

  const handleProfileOpen = () => {
    setProfileMenuVisible(false);
    router.push("/profile");
  };

  const iconMap = useMemo(
    () => ({
      index: { active: "home", inactive: "home-outline" },
      search: { active: "search", inactive: "search-outline" },
      saved: { active: "heart", inactive: "heart-outline" },
      notifications: { active: "notifications", inactive: "notifications-outline" },
      more: { active: "menu", inactive: "menu-outline" },
    }),
    []
  );

  return (
    <>
      <MoreDrawer
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        anchorBottom={moreDrawerBottom}
      />
      <ProfileDropdown
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
        onProfile={handleProfileOpen}
        onLogout={handleLogout}
        username={username ?? ""}
      />

      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: COLORS.activeTab,
          tabBarInactiveTintColor: COLORS.inactiveTab,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,

          tabBarStyle: {
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 6,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.tabBg,
            zIndex: 999,
            elevation: 999,
            shadowOpacity: 0,
          },

          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            marginTop: 0,
          },

          header: () => (
            <CustomHeader
              username={username}
              role={role}
              isLoggedIn={isLoggedIn}
              onOpenProfileMenu={() => setProfileMenuVisible(true)}
            />
          ),

          sceneStyle: { backgroundColor: COLORS.background },

          tabBarIcon: ({ color, focused }) => {
            const routeName = route.name as keyof typeof iconMap;
            const iconName =
              iconMap[routeName]?.[focused ? "active" : "inactive"] || "ellipse-outline";
            return (
              <View>
                <Ionicons name={iconName as any} size={22} color={color} />
                {routeName === "notifications" && isLoggedIn && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#60A5FA",
                      borderWidth: 1.5,
                      borderColor: COLORS.tabBg,
                    }}
                  />
                )}
              </View>
            );
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="search" options={{ title: "Explore" }} />
        <Tabs.Screen name="saved" options={{ title: "Saved" }} />
        <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
        <Tabs.Screen
          name="more"
          options={{ title: "More" }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreVisible(true);
            },
          }}
        />
      </Tabs>
    </>
  );
}

export default function TabLayout() {
  return <TabLayoutContent />;
}

const styles = StyleSheet.create({
  customHeaderContainer: {
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  headerLeftWrap: {
    justifyContent: "center",
    marginLeft: 18,
  },
  brand: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -0.9,
    textTransform: "lowercase",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
    gap: 8,
    maxWidth: 260,
  },
  authButtonsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
    gap: 8,
  },

  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
  },
  signInButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },
  signUpButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  signUpButtonText: { color: COLORS.black, fontSize: 13, fontWeight: "800" },

  listPropertyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  listPropertyButtonText: { color: COLORS.white, fontSize: 12, fontWeight: "800" },

  welcomeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
    maxWidth: 145,
  },
  welcomeText: { color: COLORS.white, fontSize: 12, fontWeight: "700", maxWidth: 76 },

  overlay: { flex: 1, backgroundColor: COLORS.overlay },
  backdrop: { flex: 1 },

  drawer: {
    position: "absolute",
    right: 14,
    width: 230,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  drawerTitle: { fontSize: 18, fontWeight: "900", color: COLORS.white },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  drawerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  drawerTextBox: { flex: 1 },
  drawerItemText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },

  profileDropdown: {
    position: "absolute",
    top: Platform.OS === "ios" ? 88 : 68,
    right: 14,
    width: 180,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileTopText: { color: COLORS.white, fontSize: 13, fontWeight: "800", flex: 1 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dropdownItemText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
});