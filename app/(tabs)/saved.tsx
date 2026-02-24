import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EventCard } from "@/components/EventCard";
import { useEventStore } from "@/stores/eventStore";
import { useAuthStore } from "@/stores/authStore";
import { AuthGuard } from "@/components/AuthGuard";
import type { Event } from "@/types";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getSavedEvents = useEventStore((s) => s.getSavedEvents);
  const fetchPrivateEvents = useEventStore((s) => s.fetchPrivateEvents);
  const toggleGoing = useEventStore((s) => s.toggleGoing);
  const goingIds = useEventStore((s) => s.goingEventIds);
  const savedEvents = getSavedEvents();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showAuthGuard, setShowAuthGuard] = useState(false);
  const [privateEvents, setPrivateEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthGuard(true);
      return;
    }
    fetchPrivateEvents().then(setPrivateEvents);
  }, [isAuthenticated]);

  const allItems = [
    ...privateEvents.map((e) => ({ ...e, _section: "private" as const })),
    ...savedEvents.filter((e) => !privateEvents.some((p) => p.id === e.id)).map((e) => ({ ...e, _section: "saved" as const })),
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <View>
          <Text className="text-2xl font-bold text-text-primary">Gemerkt</Text>
          <Text className="text-sm text-text-secondary mt-1">
            {savedEvents.length} gespeichert · {privateEvents.length} privat
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/join-event")}
          className="flex-row items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-2"
        >
          <Ionicons name="ticket-outline" size={16} color="#6C5CE7" />
          <Text className="text-xs font-semibold text-primary">Code eingeben</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const prevSection = index > 0 ? allItems[index - 1]._section : null;
          const showHeader = item._section !== prevSection;

          return (
            <View>
              {showHeader && item._section === "private" && (
                <View className="flex-row items-center gap-2 px-4 pt-2 pb-2">
                  <Ionicons name="lock-closed" size={14} color="#6C5CE7" />
                  <Text className="text-xs font-semibold uppercase tracking-wider text-primary">Private Events</Text>
                </View>
              )}
              {showHeader && item._section === "saved" && privateEvents.length > 0 && (
                <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
                  <Ionicons name="bookmark" size={14} color="#A0A0B8" />
                  <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted">Gespeicherte Events</Text>
                </View>
              )}
              <EventCard
                event={item}
                onToggleGoing={toggleGoing}
                isGoing={goingIds.has(item.id)}
              />
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-8">
            <Text className="text-4xl mb-4">📌</Text>
            <Text className="text-lg font-semibold text-text-primary text-center mb-2">
              Noch keine Events gemerkt
            </Text>
            <Text className="text-sm text-text-secondary text-center mb-6">
              Tippe auf "Merken" bei einem Event, oder tritt einem privaten Event bei.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/join-event")}
              className="bg-primary rounded-xl py-3 px-6"
            >
              <Text className="text-white font-bold text-sm">Code eingeben</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <AuthGuard
        visible={showAuthGuard}
        onClose={() => setShowAuthGuard(false)}
        message="Melde dich an, um Events zu speichern und später wiederzufinden."
      />
    </View>
  );
}
