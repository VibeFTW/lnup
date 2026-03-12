import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EventCard } from "@/components/EventCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DateFilter } from "@/components/DateFilter";
import { CityDropdown } from "@/components/CityDropdown";
import { SearchOverlay } from "@/components/SearchOverlay";
import { SortDropdown } from "@/components/SortDropdown";
import { TrendingEvents } from "@/components/TrendingEvents";
import { useEventStore, persistAiEvents } from "@/stores/eventStore";
import { useFilterStore } from "@/stores/filterStore";
import { useToastStore } from "@/stores/toastStore";
import { matchesDateFilter } from "@/lib/utils";
import { COLORS } from "@/lib/constants";
import { discoverLocalEvents } from "@/lib/aiEventDiscovery";
import type { EventCategory } from "@/types";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((s) => s.events);
  const isLoading = useEventStore((s) => s.isLoading);
  const fetchEvents = useEventStore((s) => s.fetchEvents);
  const toggleGoing = useEventStore((s) => s.toggleGoing);
  const goingIds = useEventStore((s) => s.goingEventIds);
  const { dateFilter, categoryFilter, setDateFilter, setCategoryFilter, city, sortBy } =
    useFilterStore();
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [cityDropdownVisible, setCityDropdownVisible] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const mergeExternalEvents = useEventStore((s) => s.mergeExternalEvents);

  useEffect(() => {
    if (!hasFetched) {
      fetchEvents(city || undefined);
      setHasFetched(true);
    }
  }, []);
  const [searchVisible, setSearchVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  const activeEvents = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const cutoff = yesterday.toISOString().split("T")[0];
    return events.filter((e) => e.status === "active" && e.event_date >= cutoff);
  }, [events]);

  const cityDateFiltered = useMemo(() => {
    return activeEvents.filter((event) => {
      if (city) {
        const eventCity = event.venue?.city;
        if (!eventCity || eventCity.toLowerCase() !== city.toLowerCase()) return false;
      }
      return matchesDateFilter(event.event_date, dateFilter);
    });
  }, [activeEvents, dateFilter, city]);

  const filteredEvents = useMemo(() => {
    const filtered = categoryFilter
      ? cityDateFiltered.filter((e) => e.category === categoryFilter)
      : cityDateFiltered;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return b.going_count - a.going_count;
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date":
        default:
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      }
    });
  }, [cityDateFiltered, categoryFilter, sortBy]);

  const eventCounts = useMemo(() => {
    const counts: Partial<Record<EventCategory, number>> = {};
    for (const event of cityDateFiltered) {
      counts[event.category] = (counts[event.category] ?? 0) + 1;
    }
    return counts;
  }, [cityDateFiltered]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents(city || undefined, true);
    setRefreshing(false);
  }, [fetchEvents, city]);

  const handleDiscoverInCity = useCallback(async () => {
    if (!city || isDiscovering) return;
    setIsDiscovering(true);
    try {
      const discovered = await discoverLocalEvents(city);
      if (discovered.length > 0) {
        mergeExternalEvents(discovered);
        const { saved, failed } = await persistAiEvents(discovered);
        if (saved > 0) {
          await fetchEvents(city, true);
          useToastStore.getState().showToast(
            `${saved} Event${saved !== 1 ? "s" : ""} in ${city} gefunden & gespeichert!`,
            "success"
          );
        } else if (failed > 0) {
          useToastStore.getState().showToast(
            `${discovered.length} Events gefunden, konnten aber nicht gespeichert werden.`,
            "error"
          );
        }
      } else {
        useToastStore.getState().showToast(
          `Keine neuen Events in ${city} gefunden.`,
          "info"
        );
      }
    } catch (err: any) {
      useToastStore.getState().showToast(
        err?.message ?? "KI-Suche fehlgeschlagen.",
        "error"
      );
    } finally {
      setIsDiscovering(false);
    }
  }, [city, isDiscovering, mergeExternalEvents]);

  const showDiscoverButton = city && !isLoading && filteredEvents.length === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View style={{ maxWidth: 520, width: "100%", alignSelf: "center", flex: 1 }}>
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
                onPress={() => setSortVisible(true)}
                className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center"
              >
                <Ionicons name="swap-vertical" size={16} color={sortBy !== "date" ? "#6C5CE7" : "#A0A0B8"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/leaderboard")}
                className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center"
              >
                <Ionicons name="trophy" size={16} color="#FFC107" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCityDropdownVisible(!cityDropdownVisible)}
                className="flex-row items-center gap-1 bg-card rounded-full px-3 py-1.5 border border-border"
              >
                <Ionicons name="location" size={12} color="#6C5CE7" />
                <Text className="text-xs text-text-secondary">{city || "Alle Städte"}</Text>
                <Ionicons name={cityDropdownVisible ? "chevron-up" : "chevron-down"} size={12} color="#6B6B80" />
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
          ListHeaderComponent={useMemo(() => <TrendingEvents events={filteredEvents} />, [filteredEvents])}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onToggleGoing={toggleGoing}
              isGoing={goingIds.has(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={7}
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
                <Text className="text-sm text-text-secondary text-center mb-6">
                  {showDiscoverButton
                    ? `Noch keine Events für ${city}. Lass die KI nach Events suchen.`
                    : "Versuch andere Filter oder schau später nochmal vorbei."}
                </Text>
                {showDiscoverButton && (
                  <TouchableOpacity
                    onPress={handleDiscoverInCity}
                    disabled={isDiscovering}
                    className="flex-row items-center justify-center gap-2 bg-primary/20 border border-primary/40 rounded-xl px-5 py-3"
                  >
                    {isDiscovering ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                    )}
                    <Text className="text-sm font-semibold text-primary">
                      {isDiscovering ? `Suche in ${city}…` : `Mit KI in ${city} suchen`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      </View>

      {/* Dropdowns & Modals */}
      <CityDropdown visible={cityDropdownVisible} onClose={() => setCityDropdownVisible(false)} />
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} />
      <SortDropdown visible={sortVisible} onClose={() => setSortVisible(false)} />
    </View>
  );
}
