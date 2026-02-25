import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { getCategoryIcon, getCategoryLabel, getCategoryGradient } from "@/lib/categories";
import type { EventCategory } from "@/types";

interface EventCoverProps {
  category: EventCategory;
  imageUrl?: string | null;
  size?: "card" | "detail";
}

export function EventCover({ category, imageUrl, size = "card" }: EventCoverProps) {
  const [colorStart] = getCategoryGradient(category);
  const height = size === "detail" ? 200 : 140;
  const iconSize = size === "detail" ? 48 : 36;
  const textSize = size === "detail" ? "text-lg" : "text-sm";

  if (imageUrl) {
    const imageHeight = size === "detail" ? 220 : 150;
    return (
      <View style={{ height: imageHeight }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
        />
        <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Ionicons name={getCategoryIcon(category) as any} size={12} color="#FFFFFF" />
          <Text className="text-xs font-medium text-white">
            {getCategoryLabel(category)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{ height, backgroundColor: colorStart }}
    >
      {/* Faded overlay for depth */}
      <View
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
      />
      <Ionicons
        name={getCategoryIcon(category) as any}
        size={iconSize}
        color="rgba(255,255,255,0.85)"
      />
      <Text className={`${textSize} font-bold text-white/80 mt-1.5`}>
        {getCategoryLabel(category)}
      </Text>
    </View>
  );
}
