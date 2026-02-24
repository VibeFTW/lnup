import { useState, useEffect } from "react";
import { View, Text, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EventCard } from "@/components/EventCard";
import { useEventStore } from "@/stores/eventStore";
import { useAuthStore } from "@/stores/authStore";
import { AuthGuard } from "@/components/AuthGuard";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const getSavedEvents = useEventStore((s) => s.getSavedEvents);
  const toggleGoing = useEventStore((s) => s.toggleGoing);
  const goingIds = useEventStore((s) => s.goingEventIds);
  const savedEvents = getSavedEvents();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showAuthGuard, setShowAuthGuard] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) setShowAuthGuard(true);
  }, [isAuthenticated]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-3">
        <Text className="text-2xl font-bold text-text-primary">Gemerkt</Text>
        <Text className="text-sm text-text-secondary mt-1">
          {savedEvents.length} {savedEvents.length === 1 ? "Event" : "Events"} gespeichert
        </Text>
      </View>

      <FlatList
        data={savedEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onToggleGoing={toggleGoing}
            isGoing={goingIds.has(item.id)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-8">
            <Text className="text-4xl mb-4">📌</Text>
            <Text className="text-lg font-semibold text-text-primary text-center mb-2">
              Noch keine Events gemerkt
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              Tippe auf "Merken" bei einem Event, um es hier zu speichern.
            </Text>
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
