import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

// ── Brand tokens (consistent with Login/Signup) ────────────────────────────────
const BRAND = "#2563EB";

// ── Orbit ring definitions ─────────────────────────────────────────────────────
// Each ring has a radius and rotation speed (ms per full revolution).
// Odd-indexed rings spin counter-clockwise for visual interest.
const RINGS = [
  { radius: 72,  duration: 12000, clockwise: true  },
  { radius: 118, duration: 18000, clockwise: false },
  { radius: 162, duration: 24000, clockwise: true  },
];

// Items are spread evenly around their ring (angleOffset = starting offset in degrees)
const RING_ITEMS: {
  ring: number;       // index into RINGS
  angleOffset: number;
  type: "icon" | "avatar";
  iconName?: string;
  iconColor?: string;
  bgColor?: string;
  borderColor: string;
  imgUrl?: string;
  size: number;
}[] = [
  // Ring 0 (inner, radius 72) — 2 items
  {
    ring: 0, angleOffset: 0,
    type: "icon", iconName: "home", iconColor: "#10B981",
    bgColor: "#ECFDF5", borderColor: "#A7F3D0", size: 38,
  },
  {
    ring: 0, angleOffset: 180,
    type: "icon", iconName: "key", iconColor: BRAND,
    bgColor: "#EFF6FF", borderColor: "#BFDBFE", size: 36,
  },

  // Ring 1 (middle, radius 118) — 3 items
  {
    ring: 1, angleOffset: 0,
    type: "avatar",
    imgUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop",
    borderColor: BRAND, size: 46,
  },
  {
    ring: 1, angleOffset: 120,
    type: "icon", iconName: "location", iconColor: "#8B5CF6",
    bgColor: "#F5F3FF", borderColor: "#DDD6FE", size: 40,
  },
  {
    ring: 1, angleOffset: 240,
    type: "avatar",
    imgUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop",
    borderColor: "#10B981", size: 44,
  },

  // Ring 2 (outer, radius 162) — 4 items
  {
    ring: 2, angleOffset: 0,
    type: "avatar",
    imgUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop",
    borderColor: "#EC4899", size: 44,
  },
  {
    ring: 2, angleOffset: 90,
    type: "icon", iconName: "chatbubble-ellipses", iconColor: "#EC4899",
    bgColor: "#FDF2F8", borderColor: "#FBCFE8", size: 38,
  },
  {
    ring: 2, angleOffset: 180,
    type: "avatar",
    imgUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop",
    borderColor: "#3B82F6", size: 44,
  },
  {
    ring: 2, angleOffset: 270,
    type: "icon", iconName: "calendar", iconColor: "#3B82F6",
    bgColor: "#EFF6FF", borderColor: "#BFDBFE", size: 40,
  },
];

// ── OrbitRing component ────────────────────────────────────────────────────────
// Rotates the whole ring view; counter-rotates each child so badges stay upright.
function OrbitRing({
  radius,
  duration,
  clockwise,
  children,
  visible,
}: {
  radius: number;
  duration: number;
  clockwise: boolean;
  children: React.ReactNode;
  visible: boolean;
}) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.timing(rotation, {
        toValue: clockwise ? 1 : -1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [visible, clockwise, duration, rotation]);

  const spin = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-360deg", "0deg", "360deg"],
  });
  const counterSpin = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["360deg", "0deg", "-360deg"],
  });

  const diameter = radius * 2;

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: diameter,
        height: diameter,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
        borderStyle: "dashed",
        transform: [{ rotate: spin }],
      }}
    >
      {React.Children.map(children, (child) => (
        <Animated.View style={{ transform: [{ rotate: counterSpin }] }}>
          {child}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SplashScreenComponent() {
  const [phase, setPhase] = useState<"logo" | "getStarted">("logo");

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.88)).current;
  const bgFade     = useRef(new Animated.Value(0)).current;
  const uiFade     = useRef(new Animated.Value(0)).current;
  const orbitsFade = useRef(new Animated.Value(0)).current;

  const logoChars = useRef("skyhomes".split("")).current;
  const dropAnims = useRef(
    logoChars.map(() => ({
      y: new Animated.Value(-30),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // Transition to get-started phase
  const transitionToGetStarted = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setPhase("getStarted");

      Animated.sequence([
        // Background fades in first
        Animated.timing(bgFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Then orbits and UI fade in together
        Animated.parallel([
          Animated.timing(orbitsFade, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(uiFade, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [fadeAnim, bgFade, orbitsFade, uiFade]);

  useEffect(() => {
    SplashScreen.hideAsync();

    // 1. Fade + scale the logo container in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Stagger each letter dropping in (parallel opacity + spring Y)
    Animated.stagger(
      100,
      dropAnims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(a.y, {
            toValue: 0,
            speed: 16,
            bounciness: 12,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();

    // 3. After 2.8 s, send everyone to the public home tabs
    const timer = setTimeout(async () => {
      try {
        const AsyncStorage = (
          await import("@react-native-async-storage/async-storage")
        ).default;
        const loggedIn = await AsyncStorage.getItem("isLoggedIn");
        router.replace("/(tabs)");
      } catch {
        router.replace("/(tabs)");
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.root}>
      <StatusBar barStyle={phase === "getStarted" ? "dark-content" : "light-content"} />

      {/* ── Phase 1: Logo ── */}
      {phase === "logo" && (
        <Animated.View
          style={[s.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <View style={s.logoRow} pointerEvents="none">
            {logoChars.map((ch, i) => (
              <Animated.Text
                key={i}
                style={[
                  s.logoChar,
                  {
                    opacity: dropAnims[i].opacity,
                    transform: [{ translateY: dropAnims[i].y }],
                  },
                ]}
              >
                {ch}
              </Animated.Text>
            ))}
          </View>
          <Animated.Text
            style={[
              s.logoTagline,
              {
                opacity: dropAnims[logoChars.length - 1]?.opacity ?? fadeAnim,
              },
            ]}
          >
            find your place
          </Animated.Text>
        </Animated.View>
      )}

      {/* ── Phase 2: Get Started ── */}
      {phase === "getStarted" && (
        <>
          {/* Gradient background */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
            <LinearGradient
              colors={["#EFF6FF", "#DBEAFE", "#E0F2FE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Orbits */}
          <Animated.View style={[s.orbitsWrap, { opacity: orbitsFade }]}>
            {RINGS.map((ring, ringIdx) => {
              const items = RING_ITEMS.filter((it) => it.ring === ringIdx);
              return (
                <OrbitRing
                  key={ringIdx}
                  radius={ring.radius}
                  duration={ring.duration}
                  clockwise={ring.clockwise}
                  visible={phase === "getStarted"}
                >
                  {items.map((item, itemIdx) => {
                    // Position each item at its angle on the ring edge
                    const angleRad = ((item.angleOffset - 90) * Math.PI) / 180;
                    const x = ring.radius * Math.cos(angleRad) - item.size / 2;
                    const y = ring.radius * Math.sin(angleRad) - item.size / 2;
                    return (
                      <View
                        key={itemIdx}
                        style={[
                          s.badge,
                          {
                            width: item.size,
                            height: item.size,
                            borderRadius: item.size / 2,
                            borderColor: item.borderColor,
                            backgroundColor:
                              item.type === "icon" ? item.bgColor : "#fff",
                            position: "absolute",
                            top: ring.radius + y,
                            left: ring.radius + x,
                          },
                        ]}
                      >
                        {item.type === "icon" ? (
                          <Ionicons
                            name={item.iconName as any}
                            size={item.size * 0.48}
                            color={item.iconColor}
                          />
                        ) : (
                          <Image
                            source={{ uri: item.imgUrl }}
                            style={{
                              width: item.size - 4,
                              height: item.size - 4,
                              borderRadius: (item.size - 4) / 2,
                            }}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    );
                  })}
                </OrbitRing>
              );
            })}

            {/* Center badge */}
            <View style={s.centerBadge}>
              <Ionicons name="sparkles" size={24} color="#F59E0B" />
            </View>
          </Animated.View>

          {/* Branding + CTA */}
          <Animated.View style={[s.bottomSection, { opacity: uiFade }]}>
            <View style={s.brandRow}>
              <Text style={s.brandWord}>skyhomes</Text>
              <View style={s.brandDot} />
            </View>

            <Text style={s.headline}>Find your{"\n"}perfect home.</Text>
            <Text style={s.subline}>
              Thousands of verified listings, one tap away.
            </Text>

            <TouchableOpacity
              style={s.cta}
              activeOpacity={0.88}
              onPress={() => router.replace("/(tabs)")}
            >
              <Text style={s.ctaText}>Get started</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>

            <Text style={s.legal}>
              By continuing you agree to our Terms & Privacy Policy
            </Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040E24",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Logo phase ──
  logoContainer: {
    alignItems: "center",
    gap: 14,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoChar: {
    fontSize: 56,
    fontWeight: "900",
    color: BRAND,
    letterSpacing: 3,
  },
  logoTagline: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  // ── Orbits ──
  orbitsWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  centerBadge: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },

  // ── Bottom section ──
  bottomSection: {
    width: "100%",
    paddingHorizontal: 28,
    paddingBottom: 44,
    gap: 0,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  brandWord: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: BRAND,
    marginLeft: 2,
    marginTop: 1,
  },
  headline: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 44,
    letterSpacing: -1,
    marginBottom: 10,
  },
  subline: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 32,
  },
  cta: {
    backgroundColor: "#2563EB",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  legal: {
    color: "#9CA3AF",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});