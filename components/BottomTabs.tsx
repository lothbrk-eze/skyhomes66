import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

import Gethouse from "./Gethouse";
import ProfileRouter from "./ProfileRouter";


const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        const user = stored ? JSON.parse(stored) : null;
        setLoggedUser(user);
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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Houses"
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: "#16a34a",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          height: 65,
          paddingBottom: 10,
          paddingTop: 6,
          marginBottom: 8,
          borderTopWidth: 0.5,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any = "home";

          if (route.name === "Houses") iconName = "home";
          if (route.name === "Profile") iconName = "person";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Houses"
        component={Gethouse}
        options={{ title: "SkyHomes" }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileRouter}
        options={{
          title: loggedUser ? loggedUser.username || "Profile" : "Profile",
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;