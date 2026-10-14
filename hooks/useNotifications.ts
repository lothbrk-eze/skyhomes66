import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import axios from "axios";
import { router } from "expo-router";
import { API_URL } from "../lib/api";

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications(userId: string | null) {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    // 1. Register for push notifications and get the token
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        sendTokenToBackend(userId, token);
      }
    });

    // 2. Listener for when a notification is received while the app is in the foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Foreground notification received:", notification);
    });

    // 3. Listener for when a user interacts with/taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("Notification tapped with data:", data);
      
      try {
        if (data?.screen) {
          // If a specific screen and parameters are sent, navigate to it
          // Example payload data: { screen: "/house-details", params: { id: 45 } }
          if (data.params) {
            router.push({ pathname: data.screen as any, params: data.params as any });
          } else {
            router.push(data.screen as any);
          }
        } else {
          // Default fallback: navigate to the notifications tab screen
          router.push("/(tabs)/notifications" as any);
        }
      } catch (err) {
        console.error("Failed to route notification tap event:", err);
        // Fallback to notifications tab
        router.push("/(tabs)/notifications" as any);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userId]);
}

async function sendTokenToBackend(userId: string, token: string) {
  try {
    const formData = new FormData();
    formData.append("user_id", String(userId));
    formData.append("push_token", token);
    formData.append("device_platform", Platform.OS);

    const response = await axios.post(`${API_URL}/api/register_push_token`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("Push token successfully registered with backend:", response.data);
  } catch (error: any) {
    console.error("Failed to register push token with backend:", error?.response?.data || error.message);
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }

  // Request/check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("Failed to get push token: permission not granted.");
    return null;
  }
  
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Expo Push Token obtained:", token);
  } catch (error) {
    console.warn("Unable to fetch Expo push token (likely running on an emulator or simulator):", error);
  }

  return token;
}
