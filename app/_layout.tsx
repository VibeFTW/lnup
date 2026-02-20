import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0A0F" },
          animation: "slide_from_right",
        }}
      >
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
          name="event/[id]/photos"
          options={{ headerShown: false, presentation: "card" }}
        />
      </Stack>
    </>
  );
}
