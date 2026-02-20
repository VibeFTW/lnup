import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { TrustBadge } from "./TrustBadge";
import { RankBadge } from "./RankBadge";
import { EventCover } from "./EventCover";
import { formatEventDate, formatTime } from "@/lib/utils";
import { useEventStore } from "@/stores/eventStore";
import type { Event } from "@/types";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function isFreeEvent(priceInfo: string | null | undefined): boolean {
  if (!priceInfo) return false;
  const lower = priceInfo.toLowerCase();
  return lower.includes("kostenlos") || lower.includes("frei") || lower === "0" || lower === "0€";
}

interface EventCardProps {
  event: Event;
  onToggleGoing?: (eventId: string) => void;
  isGoing?: boolean;
}

export function EventCard({ event, onToggleGoing, isGoing }: EventCardProps) {
  const router = useRouter();
  const toggleSave = useEventStore((s) => s.toggleSave);
  const savedIds = useEventStore((s) => s.savedEventIds);
  const isSaved = savedIds.has(event.id);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const isPast = new Date(event.event_date) < new Date(new Date().toDateString());

  return (
    <AnimatedTouchable
      onPress={() => router.push(`/event/${event.id}`)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.9}
      className="mx-4 mb-3 rounded-2xl bg-card border border-border overflow-hidden"
      style={animatedStyle}
    >
      {/* Cover Image / Category Gradient */}
      <EventCover category={event.category} imageUrl={event.image_url} />

      <View className="p-4">
        {/* Header: Trust badge + Creator info + Free badge */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2 flex-1 flex-wrap">
            <TrustBadge sourceType={event.source_type} />
            {event.creator && (
              <View className="flex-row items-center gap-1.5">
                <RankBadge score={event.creator.trust_score} />
                <Text className="text-xs text-text-muted">
                  · {event.creator.display_name}
                  {event.creator.trust_score > 0 && ` (${event.creator.trust_score})`}
                </Text>
              </View>
            )}
          </View>
          {isFreeEvent(event.price_info) && (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(0,230,118,0.15)" }}>
              <Text className="text-xs font-semibold text-success">Kostenlos</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text className="text-lg font-bold text-text-primary mb-1">
          {event.title}
        </Text>

        {/* Description */}
        <Text className="text-sm text-text-secondary mb-3" numberOfLines={2}>
          {event.description}
        </Text>

        {/* Details Row */}
        <View className="flex-row items-center flex-wrap gap-3 mb-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={14} color="#A0A0B8" />
            <Text className="text-xs text-text-secondary" numberOfLines={1}>
              {event.venue?.name ?? "Unbekannt"}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={14} color="#A0A0B8" />
            <Text className="text-xs text-text-secondary">
              {formatEventDate(event.event_date)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={14} color="#A0A0B8" />
            <Text className="text-xs text-text-secondary">
              {formatTime(event.time_start)}
              {event.time_end && ` – ${formatTime(event.time_end)}`}
            </Text>
          </View>
          {event.price_info && !isFreeEvent(event.price_info) && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="pricetag-outline" size={14} color="#A0A0B8" />
              <Text className="text-xs text-text-secondary">{event.price_info}</Text>
            </View>
          )}
        </View>

        {/* Footer: Stats + Actions */}
        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="people-outline" size={14} color="#00D2FF" />
              <Text className="text-xs text-secondary">{event.going_count}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="bookmark-outline" size={14} color="#6B6B80" />
              <Text className="text-xs text-text-muted">{event.saves_count}</Text>
            </View>
            {event.confirmations_count > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="checkmark-circle-outline" size={14} color="#00E676" />
                <Text className="text-xs text-text-muted">{event.confirmations_count}</Text>
              </View>
            )}
            {event.photos_count > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="camera-outline" size={14} color="#6B6B80" />
                <Text className="text-xs text-text-muted">{event.photos_count}</Text>
              </View>
            )}
            {event.source_type === "community" && event.creator?.rank === "newbie" && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="alert-circle-outline" size={12} color="#FFC107" />
                <Text className="text-xs text-warning">Unbestätigt</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            {/* Bin dabei / War dabei button */}
            {!isPast && onToggleGoing && (
              <TouchableOpacity
                onPress={() => onToggleGoing(event.id)}
                className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
                  isGoing ? "bg-secondary/20" : "bg-card-hover"
                }`}
              >
                <Ionicons
                  name={isGoing ? "people" : "people-outline"}
                  size={14}
                  color={isGoing ? "#00D2FF" : "#A0A0B8"}
                />
                <Text className={`text-xs font-medium ${isGoing ? "text-secondary" : "text-text-secondary"}`}>
                  {isGoing ? "Dabei" : "Bin dabei"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Save button */}
            <TouchableOpacity
              onPress={() => toggleSave(event.id)}
              className="flex-row items-center gap-1 rounded-full px-3 py-1.5 bg-card-hover"
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={14}
                color={isSaved ? "#6C5CE7" : "#A0A0B8"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AnimatedTouchable>
  );
}
