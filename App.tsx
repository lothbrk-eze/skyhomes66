import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Login from "./components/Login";
import Signup from "./components/Signup";
import BottomTabs from "./components/BottomTabs";
import HouseDetails from "./components/HouseDetails";
import AboutUs from "./components/Aboutus";
import ContactUs from "./components/ContactUs";
import { AuthProvider } from "./contexts/AuthContext";
import { SearchProvider } from "./contexts/SearchContext";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <SearchProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="MainTabs">
        <Stack.Screen
          name="MainTabs"
          component={BottomTabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Login"
          component={Login}
          options={{ title: "Sign In" }}
        />

        <Stack.Screen
          name="Signup"
          component={Signup}
          options={{ title: "Sign Up" }}
        />

        <Stack.Screen
          name="HouseDetails"
          component={HouseDetails}
          options={{ title: "House Details" }}
        />

        <Stack.Screen
          name="AboutUs"
          component={AboutUs}
          options={{ title: "About SkyHomes" }}
        />

        <Stack.Screen
          name="ContactUs"
          component={ContactUs}
          options={{ title: "Contact Us" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
      </SearchProvider>
    </AuthProvider>
  );
}