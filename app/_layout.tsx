import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/stores/authStore";
import { Toast } from "@/components/Toast";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    async function prepare() {
      const [onboarded] = await Promise.all([
        AsyncStorage.getItem("@lnup_onboarded"),
        initialize(),
      ]);
      setNeedsOnboarding(onboarded !== "true");
      setIsReady(true);
      SplashScreen.hideAsync();
    }
    prepare();
  }, []);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Toast />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0A0F" },
          animation: "slide_from_right",
        }}
        initialRouteName={needsOnboarding ? "onboarding" : "(tabs)"}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="event/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="leaderboard"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="user/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="privacy"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="terms"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="imprint"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="profile-edit"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="join-event"
          options={{ headerShown: false, presentation: "card" }}
        />
        <Stack.Screen
          name="invite/[code]"
          options={{ headerShown: false, presentation: "card" }}
        />
      </Stack>
    </View>
  );
}
