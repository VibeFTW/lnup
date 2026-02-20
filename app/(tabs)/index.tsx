import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EventCard } from "@/components/EventCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DateFilter } from "@/components/DateFilter";
import { CitySelector } from "@/components/CitySelector";
import { SearchOverlay } from "@/components/SearchOverlay";
import { useEventStore } from "@/stores/eventStore";
import { useFilterStore } from "@/stores/filterStore";
import { matchesDateFilter } from "@/lib/utils";
import { COLORS } from "@/lib/constants";
import type { EventCategory } from "@/types";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((s) => s.events);
  const isLoading = useEventStore((s) => s.isLoading);
  const fetchEvents = useEventStore((s) => s.fetchEvents);
  const toggleGoing = useEventStore((s) => s.toggleGoing);
  const goingIds = useEventStore((s) => s.goingEventIds);
  const { dateFilter, categoryFilter, setDateFilter, setCategoryFilter, city } =
    useFilterStore();
  const [refreshing, setRefreshing] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const activeEvents = useMemo(() => {
    return events.filter((e) => e.status === "active");
  }, [events]);

  const filteredEvents = useMemo(() => {
    return activeEvents.filter((event) => {
      if (!matchesDateFilter(event.event_date, dateFilter)) return false;
      if (categoryFilter && event.category !== categoryFilter) return false;
      return true;
    });
  }, [activeEvents, dateFilter, categoryFilter]);

  const eventCounts = useMemo(() => {
    const counts: Partial<Record<EventCategory, number>> = {};
    for (const event of activeEvents) {
      if (!matchesDateFilter(event.event_date, dateFilter)) continue;
      counts[event.category] = (counts[event.category] ?? 0) + 1;
    }
    return counts;
  }, [activeEvents, dateFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pb-3 pt-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          Local Nights, Unique Places
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary">LNUP</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setSearchVisible(true)}
              className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center"
            >
              <Ionicons name="search" size={16} color="#A0A0B8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/leaderboard")}
              className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center"
            >
              <Ionicons name="trophy" size={16} color="#FFC107" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCityModalVisible(true)}
              className="flex-row items-center gap-1 bg-card rounded-full px-3 py-1.5 border border-border"
            >
              <Ionicons name="location" size={12} color="#6C5CE7" />
              <Text className="text-xs text-text-secondary">{city}</Text>
              <Ionicons name="chevron-down" size={12} color="#6B6B80" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Date Filter */}
      <View className="mb-2">
        <DateFilter selected={dateFilter} onSelect={setDateFilter} />
      </View>

      {/* Category Filter */}
      <View className="mb-3">
        <CategoryFilter
          selected={categoryFilter}
          onSelect={setCategoryFilter}
          eventCounts={eventCounts}
        />
      </View>

      {/* Event List */}
      <FlatList
        data={filteredEvents}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonCard count={3} />
          ) : (
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-lg font-semibold text-text-primary text-center mb-2">
                Keine Events gefunden
              </Text>
              <Text className="text-sm text-text-secondary text-center">
                Versuch andere Filter oder schau später nochmal vorbei.
              </Text>
            </View>
          )
        }
      />

      {/* City Selector Modal */}
      <CitySelector
        visible={cityModalVisible}
        onClose={() => setCityModalVisible(false)}
      />

      {/* Search Overlay */}
      <SearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
      />
    </View>
  );
}
