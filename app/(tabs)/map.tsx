import { useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import { useEventStore } from "@/stores/eventStore";
import { useFilterStore } from "@/stores/filterStore";
import { REGION_CENTER, GOOGLE_MAPS_API_KEY, COLORS } from "@/lib/constants";
import { matchesDateFilter } from "@/lib/utils";
import { CitySelector } from "@/components/CitySelector";

const CATEGORY_COLORS: Record<string, string> = {
  nightlife: "#6C5CE7",
  food_drink: "#FF6B9D",
  concert: "#00D2FF",
  festival: "#FFC107",
  sports: "#00E676",
  art: "#8B7CF7",
  family: "#FF9800",
  other: "#A0A0B8",
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((s) => s.events);
  const { dateFilter, categoryFilter, city } = useFilterStore();
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.status !== "active") return false;
      if (!event.venue?.lat || !event.venue?.lng) return false;
      if (city && event.venue?.city && event.venue.city !== city) return false;
      if (!matchesDateFilter(event.event_date, dateFilter)) return false;
      if (categoryFilter && event.category !== categoryFilter) return false;
      return true;
    });
  }, [events, dateFilter, categoryFilter, city]);

  const handleMarkerPress = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-4 pb-3">
          <Text className="text-2xl font-bold text-text-primary">Karte</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-card items-center justify-center mb-4">
            <Ionicons name="map-outline" size={40} color="#6C5CE7" />
          </View>
          <Text className="text-lg font-semibold text-text-primary text-center mb-2">
            Google Maps API Key fehlt
          </Text>
          <Text className="text-sm text-text-secondary text-center">
            Bitte setze EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in deiner .env Datei.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary">Karte</Text>
          <TouchableOpacity
            onPress={() => setCityModalVisible(true)}
            className="flex-row items-center gap-1 bg-card/90 rounded-full px-3 py-1.5 border border-border"
          >
            <Ionicons name="location" size={12} color="#6C5CE7" />
            <Text className="text-xs text-text-secondary">{city || "Alle Städte"}</Text>
            <Ionicons name="chevron-down" size={12} color="#6B6B80" />
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={REGION_CENTER}
        showsUserLocation
        showsMyLocationButton
        customMapStyle={MAP_DARK_STYLE}
      >
        {filteredEvents.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.venue!.lat,
              longitude: event.venue!.lng,
            }}
            pinColor={CATEGORY_COLORS[event.category] ?? COLORS.primary}
            onCalloutPress={() => handleMarkerPress(event.id)}
          >
            <Callout tooltip={false}>
              <View style={{ width: 200, padding: 4 }}>
                <Text style={{ fontWeight: "bold", fontSize: 14, marginBottom: 2 }}>
                  {event.title}
                </Text>
                <Text style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
                  {event.venue?.name}
                </Text>
                <Text style={{ fontSize: 11, color: "#999" }}>
                  {event.event_date} · {event.time_start}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View
        className="absolute bottom-6 left-4 right-4 bg-card/90 rounded-xl border border-border px-4 py-3"
        style={{ marginBottom: insets.bottom }}
      >
        <Text className="text-xs text-text-secondary text-center">
          {filteredEvents.length} Events auf der Karte
        </Text>
      </View>

      <CitySelector visible={cityModalVisible} onClose={() => setCityModalVisible(false)} />
    </View>
  );
}

const MAP_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];
