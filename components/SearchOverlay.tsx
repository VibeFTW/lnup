import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEventStore } from "@/stores/eventStore";
import { MOCK_PROFILES, MOCK_VENUES } from "@/lib/mockData";
import { getRankForScore } from "@/lib/ranks";
import { formatEventDate, formatTime } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";
import { COLORS } from "@/lib/constants";
import type { Event, Profile, Venue } from "@/types";

type SearchTab = "events" | "venues" | "users";

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
}

function EventRow({ event, onPress }: { event: Event; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center mx-4 px-4 py-3 rounded-xl mb-2 bg-card border border-border"
    >
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: "#6C5CE7" + "20" }}
      >
        <Ionicons name={getCategoryIcon(event.category) as any} size={20} color="#6C5CE7" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-xs text-text-muted" numberOfLines={1}>
          {event.venue?.name} · {formatEventDate(event.event_date)} · {formatTime(event.time_start)}
        </Text>
      </View>
      <View className="items-end">
        <View className="flex-row items-center gap-1">
          <Ionicons name="people-outline" size={12} color="#00D2FF" />
          <Text className="text-xs text-secondary">{event.going_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function VenueRow({ venue, onPress }: { venue: Venue; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center mx-4 px-4 py-3 rounded-xl mb-2 bg-card border border-border"
    >
      <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-primary/10">
        <Ionicons name="location" size={20} color="#6C5CE7" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
            {venue.name}
          </Text>
          {venue.verified && (
            <Ionicons name="checkmark-circle" size={14} color="#00E676" />
          )}
        </View>
        <Text className="text-xs text-text-muted" numberOfLines={1}>
          {venue.address}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#6B6B80" />
    </TouchableOpacity>
  );
}

function UserRow({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  const rank = getRankForScore(profile.trust_score);
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center mx-4 px-4 py-3 rounded-xl mb-2 bg-card border border-border"
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: rank.color + "20" }}
      >
        <Text className="text-base">{rank.icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">
          {profile.display_name}
        </Text>
        <Text className="text-xs" style={{ color: rank.color }}>
          {rank.label} · @{profile.username}
        </Text>
      </View>
      <Text className="text-sm font-bold text-text-secondary">
        {profile.trust_score}
      </Text>
    </TouchableOpacity>
  );
}

export function SearchOverlay({ visible, onClose }: SearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((s) => s.events);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("events");

  const q = query.toLowerCase().trim();

  const filteredEvents = useMemo(() => {
    if (!q) return [];
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.venue?.name ?? "").toLowerCase().includes(q)
    );
  }, [events, q]);

  const filteredVenues = useMemo(() => {
    if (!q) return [];
    return MOCK_VENUES.filter(
      (v) => v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredUsers = useMemo(() => {
    if (!q) return [];
    return MOCK_PROFILES.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.display_name.toLowerCase().includes(q)
    );
  }, [q]);

  const counts = {
    events: filteredEvents.length,
    venues: filteredVenues.length,
    users: filteredUsers.length,
  };

  const handleClose = () => {
    setQuery("");
    setActiveTab("events");
    onClose();
  };

  const handleEventPress = (eventId: string) => {
    handleClose();
    router.push(`/event/${eventId}`);
  };

  const handleUserPress = (userId: string) => {
    handleClose();
    router.push(`/user/${userId}`);
  };

  const tabs: { id: SearchTab; label: string }[] = [
    { id: "events", label: "Events" },
    { id: "venues", label: "Venues" },
    { id: "users", label: "Nutzer" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Search Header */}
        <View className="flex-row items-center px-4 py-3 gap-3">
          <View className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-4 gap-2">
            <Ionicons name="search" size={18} color="#6B6B80" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Events, Venues, Nutzer suchen..."
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              className="flex-1 py-3 text-text-primary text-base"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#6B6B80" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-sm text-primary font-medium">Abbrechen</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row px-4 gap-2 mb-3">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 ${
                activeTab === tab.id ? "bg-primary" : "bg-card border border-border"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab.id ? "text-white" : "text-text-secondary"
                }`}
              >
                {tab.label}{q ? ` (${counts[tab.id]})` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results */}
        {!q ? (
          <View className="items-center justify-center py-20 px-8">
            <Ionicons name="search-outline" size={48} color="#2A2A3E" />
            <Text className="text-sm text-text-muted text-center mt-4">
              Gib einen Suchbegriff ein
            </Text>
          </View>
        ) : activeTab === "events" ? (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <EventRow event={item} onPress={() => handleEventPress(item.id)} />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-sm text-text-muted">Keine Events gefunden</Text>
              </View>
            }
          />
        ) : activeTab === "venues" ? (
          <FlatList
            data={filteredVenues}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <VenueRow venue={item} onPress={handleClose} />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-sm text-text-muted">Keine Venues gefunden</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserRow profile={item} onPress={() => handleUserPress(item.id)} />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-sm text-text-muted">Keine Nutzer gefunden</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}
