import { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEventStore } from "@/stores/eventStore";
import { useAuthStore } from "@/stores/authStore";

interface PhotoUploadProps {
  eventId: string;
}

export function PhotoUpload({ eventId }: PhotoUploadProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadPhoto = useEventStore((s) => s.uploadPhoto);
  const user = useAuthStore((s) => s.user);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Berechtigung benötigt",
        "Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!previewUri || !user) return;

    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate upload delay (replace with Supabase Storage upload)
    await new Promise((r) => setTimeout(r, 800));

    uploadPhoto(eventId, previewUri, user.id);
    setPreviewUri(null);
    setUploading(false);

    Alert.alert(
      "Foto eingereicht",
      "Dein Foto wird angezeigt, sobald der Veranstalter es freigibt."
    );
  };

  if (previewUri) {
    return (
      <View className="rounded-xl overflow-hidden border border-border mb-3">
        <Image
          source={{ uri: previewUri }}
          style={{ width: "100%", height: 200 }}
          contentFit="cover"
        />
        <View className="flex-row p-3 gap-2">
          <TouchableOpacity
            onPress={() => setPreviewUri(null)}
            className="flex-1 bg-card border border-border rounded-xl py-3 items-center"
          >
            <Text className="text-sm text-text-secondary font-medium">Abbrechen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            className={`flex-1 rounded-xl py-3 items-center flex-row justify-center gap-2 ${
              uploading ? "bg-primary/50" : "bg-primary"
            }`}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
            <Text className="text-sm text-white font-bold">
              {uploading ? "Wird hochgeladen..." : "Hochladen"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={pickPhoto}
      className="bg-card border border-border rounded-xl py-3.5 items-center flex-row justify-center gap-2 mb-3"
    >
      <Ionicons name="camera-outline" size={18} color="#00D2FF" />
      <Text className="text-sm text-secondary font-medium">Foto hochladen</Text>
    </TouchableOpacity>
  );
}
