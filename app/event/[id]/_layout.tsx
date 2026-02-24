import { Stack } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";

export default function EventLayout() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    />
  );
}
