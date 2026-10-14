import React, { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RevenueCatProvider } from "./../providers/RevenueCatprovider";
import { SearchProvider } from "../contexts/SearchContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import * as SplashScreen from "expo-splash-screen";
import { useNotifications } from "../hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

// ─── Auth Gate ────────────────────────────────────────────────────────────────
// Reads auth state from context and redirects accordingly.
// Runs INSIDE AuthProvider so useAuth() always has a context.
function AuthGate() {
  const { isLoading, userId } = useAuth();

  // Register push notifications and setup event listeners for the logged-in user
  useNotifications(userId);

  useEffect(() => {
    if (isLoading) return; // wait until AsyncStorage has been read

    // The home tabs are public; authentication remains available for account-only actions.
    router.replace("/(tabs)");

    // Hide splash once we know where to send the user
    SplashScreen.hideAsync();
  }, [isLoading]);

  return null; // renders nothing — just drives navigation
}

// ─── Inner app ────────────────────────────────────────────────────────────────
function AppWithProviders() {
  return (
    <>
      {/* AuthGate drives the initial redirect to the public home tabs */}
      <AuthGate />

      <Stack>
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="house-details" options={{ headerShown: false }} />
        <Stack.Screen name="featured-reels" options={{ headerShown: false }} />
        <Stack.Screen name="about-us" options={{ title: "About SKYHOMES" }} />
        <Stack.Screen name="saved" options={{ title: "Saved Houses" }} />
        <Stack.Screen name="news-tab" options={{ title: "News" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [appUserID, setAppUserID] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        const parsed = stored ? JSON.parse(stored) : null;
        const user = parsed?.user ? parsed.user : parsed;
        const id =
          user?.user_id != null
            ? String(user.user_id)
            : user?.id != null
            ? String(user.id)
            : undefined;
        if (mounted) setAppUserID(id);
      } catch {
        if (mounted) setAppUserID(undefined);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RevenueCatProvider appUserID={undefined}>
          <SearchProvider>
            <AppWithProviders />
          </SearchProvider>
        </RevenueCatProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}