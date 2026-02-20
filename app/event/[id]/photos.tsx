import { View, Text, TouchableOpacity, FlatList, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useEventStore } from "@/stores/eventStore";
import { PhotoUpload } from "@/components/PhotoUpload";

const NUM_COLUMNS = 3;
const GAP = 4;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TILE_SIZE = (SCREEN_WIDTH - 32 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function EventPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const photos = useEventStore((s) => s.getPhotosForEvent(id));
  const event = useEventStore((s) => s.getEventById(id));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary">Fotos</Text>
          <Text className="text-xs text-text-muted">
            {event?.title ?? "Event"} — {photos.length} Fotos
          </Text>
        </View>
      </View>

      <FlatList
        data={photos}
        numColumns={NUM_COLUMNS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: 8 }}
            contentFit="cover"
            transition={200}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="camera-outline" size={48} color="#2A2A3E" />
            <Text className="text-sm text-text-muted mt-3">
              Noch keine Fotos vorhanden
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="mt-4 px-0">
            <PhotoUpload eventId={id} />
          </View>
        }
      />
    </View>
  );
}
