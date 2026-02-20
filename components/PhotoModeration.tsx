import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEventStore } from "@/stores/eventStore";
import type { EventPhoto } from "@/types";

interface PhotoModerationProps {
  eventId: string;
}

export function PhotoModeration({ eventId }: PhotoModerationProps) {
  const [expanded, setExpanded] = useState(false);
  const pendingPhotos = useEventStore((s) => s.getPendingPhotosForEvent(eventId));
  const moderatePhoto = useEventStore((s) => s.moderatePhoto);

  if (pendingPhotos.length === 0) return null;

  const handleModerate = (photoId: string, approved: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    moderatePhoto(photoId, approved);
  };

  return (
    <View className="mb-6">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="images-outline" size={18} color="#FFC107" />
          <Text className="text-sm font-semibold text-warning">
            {pendingPhotos.length} {pendingPhotos.length === 1 ? "Foto wartet" : "Fotos warten"} auf Freigabe
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#FFC107"
        />
      </TouchableOpacity>

      {expanded && (
        <View className="mt-3 gap-3">
          {pendingPhotos.map((photo) => (
            <PendingPhotoCard
              key={photo.id}
              photo={photo}
              onApprove={() => handleModerate(photo.id, true)}
              onReject={() => handleModerate(photo.id, false)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PendingPhotoCard({
  photo,
  onApprove,
  onReject,
}: {
  photo: EventPhoto;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View className="bg-card border border-border rounded-xl overflow-hidden">
      <Image
        source={{ uri: photo.image_url }}
        style={{ width: "100%", height: 180 }}
        contentFit="cover"
        transition={200}
      />
      <View className="p-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-text-secondary">
            Von {photo.uploader?.display_name ?? "Unbekannt"}
          </Text>
          <Text className="text-xs text-text-muted">
            {new Date(photo.created_at).toLocaleDateString("de-DE", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onReject}
            className="w-10 h-10 rounded-full bg-danger/15 items-center justify-center"
          >
            <Ionicons name="close" size={20} color="#FF5252" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onApprove}
            className="w-10 h-10 rounded-full bg-success/15 items-center justify-center"
          >
            <Ionicons name="checkmark" size={20} color="#00E676" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
