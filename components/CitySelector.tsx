import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFilterStore } from "@/stores/filterStore";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/constants";

const FALLBACK_CITIES = [
  "Deggendorf",
  "Passau",
  "Straubing",
  "Regensburg",
];

let cachedCities: string[] | null = null;

interface CitySelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (city: string) => void;
  selectedCity?: string;
  standalone?: boolean;
}

export function CitySelector({ visible, onClose, onSelect, selectedCity, standalone }: CitySelectorProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<string[]>(cachedCities ?? FALLBACK_CITIES);
  const [isLoading, setIsLoading] = useState(!cachedCities);

  const city = useFilterStore((s) => s.city);
  const setCity = useFilterStore((s) => s.setCity);

  const activeCity = standalone ? (selectedCity ?? "") : city;

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

  const filteredCities = useMemo(() => {
    if (!search.trim()) return cities;
    const q = search.toLowerCase();
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [search, cities]);

  const handleSelect = (selected: string) => {
    if (standalone && onSelect) {
      onSelect(selected);
    } else {
      setCity(selected);
    }
    setSearch("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-background/95" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-xl font-bold text-text-primary">Stadt wählen</Text>
            <TouchableOpacity
              onPress={() => { setSearch(""); onClose(); }}
              className="w-10 h-10 rounded-full bg-card items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View className="px-4 mb-4">
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4 gap-2">
              <Ionicons name="search" size={18} color="#6B6B80" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Stadt suchen..."
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                className="flex-1 py-3 text-text-primary text-base"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#6B6B80" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {!standalone && !search && (
            <TouchableOpacity
              onPress={() => handleSelect("")}
              className={`flex-row items-center justify-between mx-4 px-4 py-3.5 rounded-xl mb-3 ${
                !activeCity ? "bg-primary/15 border border-primary/30" : "bg-card border border-border"
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="globe-outline" size={18} color={!activeCity ? "#6C5CE7" : "#6B6B80"} />
                <Text className={`text-base ${!activeCity ? "text-primary font-semibold" : "text-text-primary"}`}>
                  Alle Städte
                </Text>
              </View>
              {!activeCity && <Ionicons name="checkmark-circle" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
          )}

          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#6C5CE7" />
            </View>
          ) : (
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === activeCity;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    className={`flex-row items-center justify-between mx-4 px-4 py-3.5 rounded-xl mb-1.5 ${
                      isSelected ? "bg-primary/15 border border-primary/30" : "bg-card border border-border"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="location"
                        size={18}
                        color={isSelected ? "#6C5CE7" : "#6B6B80"}
                      />
                      <Text
                        className={`text-base ${
                          isSelected ? "text-primary font-semibold" : "text-text-primary"
                        }`}
                      >
                        {item}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#6C5CE7" />
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View className="items-center py-12">
                  <Text className="text-text-muted text-sm">
                    Keine Stadt gefunden für "{search}"
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
