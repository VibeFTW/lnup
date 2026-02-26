import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFilterStore } from "@/stores/filterStore";
import { useEventStore } from "@/stores/eventStore";
import { useToastStore } from "@/stores/toastStore";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/constants";
import { discoverLocalEvents } from "@/lib/aiEventDiscovery";
import { persistAiEvents } from "@/stores/eventStore";

let cachedCities: string[] | null = null;

interface CityDropdownProps {
  visible: boolean;
  onClose: () => void;
}

export function CityDropdown({ visible, onClose }: CityDropdownProps) {
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<string[]>(cachedCities ?? []);
  const [isLoading, setIsLoading] = useState(!cachedCities);

  const city = useFilterStore((s) => s.city);
  const setCity = useFilterStore((s) => s.setCity);
  const events = useEventStore((s) => s.events);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const c = e.venue?.city;
      if (c) counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  useEffect(() => {
    if (cachedCities) return;
    async function fetchCities() {
      const { data, error } = await supabase
        .from("cities")
        .select("name")
        .eq("active", true)
        .order("name");

      if (!error && data && data.length > 0) {
        const names = data.map((c: any) => c.name);
        cachedCities = names;
        setCities(names);
      }
      setIsLoading(false);
    }
    fetchCities();
  }, []);

  useEffect(() => {
    const eventCities = Object.keys(cityCounts);
    if (eventCities.length > 0) {
      const merged = new Set([...cities, ...eventCities]);
      const sorted = [...merged].sort();
      if (sorted.length > cities.length) {
        cachedCities = sorted;
        setCities(sorted);
      }
    }
  }, [cityCounts]);

  const filteredCities = useMemo(() => {
    const list = search.trim()
      ? cities.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
      : cities;
    return list.sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0));
  }, [search, cities, cityCounts]);

  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleSelect = (selected: string) => {
    setCity(selected);
    setSearch("");
    onClose();
  };

  const handleAiDiscover = async () => {
    const cityName = search.trim();
    if (!cityName || isDiscovering) return;

    setIsDiscovering(true);
    try {
      const discovered = await discoverLocalEvents(cityName);
      if (discovered.length > 0) {
        useEventStore.getState().mergeExternalEvents(discovered);
        try {
          await persistAiEvents(discovered);
        } catch (persistErr) {
          console.warn("AI event persist failed:", persistErr);
        }
        useToastStore.getState().showToast(
          `${discovered.length} Events in ${cityName} gefunden & gespeichert!`,
          "success"
        );
        setCity(cityName);
        setSearch("");
        onClose();
      } else {
        useToastStore.getState().showToast(
          `Keine Events in ${cityName} gefunden.`,
          "info"
        );
      }
    } catch (err: any) {
      const msg = err?.message || "KI-Suche fehlgeschlagen.";
      console.warn("AI search error:", err);
      useToastStore.getState().showToast(msg, "error");
    } finally {
      setIsDiscovering(false);
    }
  };

  const searchNotInList = search.trim().length >= 3 &&
    !cities.some((c) => c.toLowerCase() === search.trim().toLowerCase());

  if (!visible) return null;

  return (
    <Pressable
      onPress={onClose}
      className="absolute inset-0 z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        className="absolute right-4 bg-card border border-border rounded-2xl overflow-hidden"
        style={{
          top: 100,
          width: 260,
          maxHeight: 360,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View className="px-3 pt-3 pb-2">
          <View className="flex-row items-center bg-background border border-border rounded-lg px-3 gap-1.5">
            <Ionicons name="search" size={14} color="#6B6B80" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Stadt suchen..."
              placeholderTextColor={COLORS.textMuted}
              className="flex-1 py-2 text-text-primary text-sm"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={14} color="#6B6B80" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator color="#6C5CE7" size="small" />
          </View>
        ) : (
          <FlatList
            data={[{ id: "__all__", name: "" }, ...filteredCities.map((c) => ({ id: c, name: c }))]}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 280 }}
            ListHeaderComponent={null}
            renderItem={({ item }) => {
              if (item.id === "__all__") {
                const isSelected = !city;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect("")}
                    className={`flex-row items-center justify-between px-4 py-2.5 ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="globe-outline" size={15} color={isSelected ? "#6C5CE7" : "#6B6B80"} />
                      <Text className={`text-sm ${isSelected ? "text-primary font-semibold" : "text-text-primary"}`}>
                        Alle Städte
                      </Text>
                    </View>
                    <Text className="text-xs text-text-muted">{events.length}</Text>
                  </TouchableOpacity>
                );
              }

              const isSelected = item.name === city;
              const count = cityCounts[item.name] ?? 0;

              return (
                <TouchableOpacity
                  onPress={() => handleSelect(item.name)}
                  className={`flex-row items-center justify-between px-4 py-2.5 ${isSelected ? "bg-primary/10" : ""}`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="location" size={15} color={isSelected ? "#6C5CE7" : "#6B6B80"} />
                    <Text className={`text-sm ${isSelected ? "text-primary font-semibold" : "text-text-primary"}`}>
                      {item.name}
                    </Text>
                  </View>
                  {count > 0 && (
                    <Text className="text-xs text-text-muted">{count}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {searchNotInList && (
          <TouchableOpacity
            onPress={handleAiDiscover}
            disabled={isDiscovering}
            className="mx-3 mb-3 mt-1 flex-row items-center justify-center gap-2 bg-primary/10 border border-primary/30 rounded-lg py-2.5"
          >
            {isDiscovering ? (
              <ActivityIndicator color="#6C5CE7" size="small" />
            ) : (
              <Ionicons name="sparkles" size={14} color="#6C5CE7" />
            )}
            <Text className="text-xs font-semibold text-primary">
              {isDiscovering ? `Suche in ${search.trim()}...` : `"${search.trim()}" mit KI entdecken`}
            </Text>
          </TouchableOpacity>
        )}
      </Pressable>
    </Pressable>
  );
}
