import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFilterStore } from "@/stores/filterStore";
import { COLORS } from "@/lib/constants";

const CITIES = [
  "Deggendorf",
  "Passau",
  "Straubing",
  "Regensburg",
  "Landshut",
  "Plattling",
  "Vilshofen",
  "Freyung",
  "Grafenau",
  "Regen",
  "Zwiesel",
  "Cham",
  "Dingolfing",
  "Kelheim",
  "Bogen",
];

interface CitySelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function CitySelector({ visible, onClose }: CitySelectorProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const city = useFilterStore((s) => s.city);
  const setCity = useFilterStore((s) => s.setCity);

  const filteredCities = useMemo(() => {
    if (!search.trim()) return CITIES;
    const q = search.toLowerCase();
    return CITIES.filter((c) => c.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = (selectedCity: string) => {
    setCity(selectedCity);
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
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-xl font-bold text-text-primary">Stadt wählen</Text>
            <TouchableOpacity
              onPress={() => { setSearch(""); onClose(); }}
              className="w-10 h-10 rounded-full bg-card items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search */}
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

          {/* City List */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = item === city;
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
