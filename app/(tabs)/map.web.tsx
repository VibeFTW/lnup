import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-3">
        <Text className="text-2xl font-bold text-text-primary">Karte</Text>
        <Text className="text-sm text-text-secondary mt-1">Events in deiner Nähe</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-5">
          <Ionicons name="map-outline" size={48} color="#6C5CE7" />
        </View>
        <Text className="text-lg font-semibold text-text-primary text-center mb-2">
          Karte auf dem Handy verfügbar
        </Text>
        <Text className="text-sm text-text-secondary text-center mb-6">
          Die interaktive Karte mit allen Events ist in der mobilen App verfügbar.
          Im Web kannst du Events über den Feed entdecken.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)")}
          className="bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-bold text-sm">Zum Feed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
