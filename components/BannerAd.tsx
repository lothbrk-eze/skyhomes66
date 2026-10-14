import React from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";

export default function AdBanner() {
  // Ads disabled for now to avoid build errors.
  return null;

  /*
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) return null;

  try {
    const { BannerAd, BannerAdSize, TestIds } = require("react-native-google-mobile-ads");

    const adUnitId = __DEV__
      ? TestIds.BANNER
      : "ca-app-pub-5733651117312390/2331301780";

    return (
      <View style={styles.wrap}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    );
  } catch {
    return null;
  }
  */
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginVertical: 12,
  },
});