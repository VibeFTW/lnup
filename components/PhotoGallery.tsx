import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EventPhoto } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PhotoGalleryProps {
  photos: EventPhoto[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const insets = useSafeAreaInsets();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  if (photos.length === 0) return null;

  const openViewer = (index: number) => {
    setInitialIndex(index);
    setViewerVisible(true);
  };

  return (
    <>
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-2 px-0">
          <Text className="text-sm font-semibold text-text-primary">
            Fotos ({photos.length})
          </Text>
          {photos.length > 3 && (
            <TouchableOpacity onPress={() => openViewer(0)}>
              <Text className="text-xs text-primary font-medium">Alle anzeigen</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => openViewer(index)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: photo.thumbnail_url || photo.image_url }}
                style={{ width: 120, height: 90, borderRadius: 12 }}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Full-screen viewer */}
      <Modal visible={viewerVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{ paddingTop: insets.top }}
          >
            <TouchableOpacity
              onPress={() => setViewerVisible(false)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-sm text-white/70">
              {initialIndex + 1} / {photos.length}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Swipeable photos */}
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH }} className="items-center justify-center">
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 }}
                  contentFit="contain"
                  transition={200}
                />
                {item.uploader && (
                  <Text className="text-xs text-white/50 mt-3">
                    Foto von {item.uploader.display_name}
                  </Text>
                )}
              </View>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
