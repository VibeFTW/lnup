import { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore } from "@/stores/toastStore";

const TOAST_CONFIG = {
  success: { icon: "checkmark-circle" as const, bg: "rgba(0,230,118,0.15)", border: "rgba(0,230,118,0.3)", color: "#00E676" },
  info: { icon: "information-circle" as const, bg: "rgba(0,210,255,0.15)", border: "rgba(0,210,255,0.3)", color: "#00D2FF" },
  error: { icon: "alert-circle" as const, bg: "rgba(255,82,82,0.15)", border: "rgba(255,82,82,0.3)", color: "#FF5252" },
};

export function Toast() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((s) => s.toast);
  const hideToast = useToastStore((s) => s.hideToast);

  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (toast) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(-100, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [toast, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!toast) return null;

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
          backgroundColor: config.bg,
          borderColor: config.border,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name={config.icon} size={22} color={config.color} />
      <Text
        style={{ flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}
        numberOfLines={2}
      >
        {toast.message}
      </Text>
      <TouchableOpacity onPress={hideToast} hitSlop={8}>
        <Ionicons name="close" size={18} color="#6B6B80" />
      </TouchableOpacity>
    </Animated.View>
  );
}
