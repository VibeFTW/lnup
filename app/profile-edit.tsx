import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/constants";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? "");
      setUsername(user.username ?? "");
      setBio(user.bio ?? "");
      setAvatarUri(user.avatar_url ?? null);
    }
  }, [user?.id]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung benötigt", "Bitte erlaube den Zugriff auf deine Fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewAvatarLocal(result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!displayName.trim()) {
      Alert.alert("Fehler", "Anzeigename darf nicht leer sein.");
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      Alert.alert("Fehler", "Benutzername muss mindestens 3 Zeichen haben.");
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = user?.avatar_url ?? null;

      if (newAvatarLocal) {
        const fileName = `avatars/${user!.id}/${Date.now()}.jpg`;
        const response = await fetch(newAvatarLocal);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from("event-photos")
          .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from("event-photos").getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        }
      }

      if (username.trim() !== user?.username) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.trim())
          .neq("id", user!.id)
          .maybeSingle();

        if (existing) {
          Alert.alert("Fehler", "Dieser Benutzername ist bereits vergeben.");
          setIsSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq("id", user!.id);

      if (error) throw error;

      setUser({
        ...user!,
        display_name: displayName.trim(),
        username: username.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });

      useToastStore.getState().showToast("Profil aktualisiert!", "success");
      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error?.message ?? "Profil konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary flex-1">Profil bearbeiten</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 gap-5 pb-8">
          <View className="items-center py-4">
            <TouchableOpacity onPress={pickAvatar} className="relative">
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                  contentFit="cover"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-card border-2 border-border items-center justify-center">
                  <Ionicons name="person" size={40} color="#6B6B80" />
                </View>
              )}
              <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background">
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Anzeigename</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Dein Name"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Benutzername</Text>
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4">
              <Text className="text-text-muted text-base">@</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, "").substring(0, 30))}
                placeholder="benutzername"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                maxLength={30}
                className="flex-1 py-3 text-text-primary text-base ml-1"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Erzähl etwas über dich..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={160}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base min-h-[80px]"
            />
            <Text className="text-xs text-text-muted mt-1 text-right">{bio.length}/160</Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className={`rounded-xl py-4 items-center mt-2 ${isSaving ? "bg-primary/50" : "bg-primary"}`}
          >
            <Text className="text-white font-bold text-base">
              {isSaving ? "Wird gespeichert..." : "Speichern"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
