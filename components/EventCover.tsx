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
  const isDetail = size === "detail";

  if (imageUrl) {
    return (
      <View style={{ backgroundColor: colorStart }}>
        <View style={{ aspectRatio: isDetail ? 16 / 9 : 3, maxHeight: isDetail ? 240 : 140 }}>
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />
        </View>
        <View
          className="flex-row items-center px-3 py-1"
          style={{ backgroundColor: colorStart + "18" }}
        >
          <Ionicons name={getCategoryIcon(category) as any} size={11} color={colorStart} />
          <Text style={{ color: colorStart, marginLeft: 5 }} className="text-xs font-semibold">
            {getCategoryLabel(category)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{ aspectRatio: isDetail ? 16 / 9 : 4, maxHeight: isDetail ? 160 : 80, backgroundColor: colorStart }}
    >
      <View
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
      />
      <Ionicons
        name={getCategoryIcon(category) as any}
        size={isDetail ? 36 : 24}
        color="rgba(255,255,255,0.85)"
      />
      <Text className={`${isDetail ? "text-sm" : "text-xs"} font-bold text-white/80 mt-1`}>
        {getCategoryLabel(category)}
      </Text>
    </View>
  );
}
