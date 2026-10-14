import { Linking } from "react-native";

/** Paste full profile URLs (https://…). Used by Contact Us and About Us. */
export const SOCIAL_URLS = {
  tiktok: "https://www.tiktok.com/@hood18020?_r=1&_t=ZS-95Vx1X9ji6f",
  instagram:
    "https://www.instagram.com/officialhoodapp?igsh=MXVmNWs0c2d5NmQ1eQ%3D%3D&utm_source=qr",
  youtube: "https://youtube.com/@officialhoodapp?si=zWEh6xxP-BmfXwPB",
};

export function openSocialUrl(url: string) {
  const u = url.trim();
  if (!u) return;
  void Linking.openURL(u).catch(() => {});
}
