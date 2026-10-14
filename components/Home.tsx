import React from "react";
import { View, Text, StyleSheet } from "react-native";

const Home = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SkyHomes</Text>
      <Text style={styles.subtitle}>
        Explore your suitable home with ease.
      </Text>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
});