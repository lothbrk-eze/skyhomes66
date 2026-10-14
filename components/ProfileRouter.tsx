import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { BlurView } from "expo-blur";

import Tenantdashboard from "./TenantDashboard";
import Landlorddashboard from "./Landlorddashboard";
import AdminDashboard from "./AdminDashboard";

const COLORS = {
  background: "#141E30",
  card: "rgba(255,255,255,0.06)",
  primary: "#3F5E96",
  text: "#EAF0FF",
  subtext: "#9BB1D7",
  border: "rgba(255,255,255,0.1)",
};

const ProfileRouter = (props: any) => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        setLoggedUser(stored ? JSON.parse(stored) : null);
      } catch {
        setLoggedUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!loggedUser) {
    return (
      <View style={styles.center}>
        <BlurView intensity={40} tint="dark" style={styles.card}>
          <Text style={styles.title}>Welcome to SkyHomes</Text>

          <Text style={styles.subtitle}>
            Sign in or create an account to manage your profile, applications, and properties.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/signup")}
          >
            <Text style={styles.secondaryButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    );
  }

  if (loggedUser.role === "admin") {
    return <AdminDashboard {...props} />;
  }

  if (loggedUser.role === "landlord" || loggedUser.role === "realtor") {
    return <Landlorddashboard {...props} />;
  }

  return <Tenantdashboard {...props} />;
};

export default ProfileRouter;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.subtext,
  },

  card: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.subtext,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },

  primaryButton: {
    width: "100%",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  secondaryButton: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 16,
  },
});