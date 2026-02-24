import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/lib/constants";

export default function JoinEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    Keyboard.dismiss();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/invite/${trimmed}`);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary">Event beitreten</Text>
      </View>

      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary/15 items-center justify-center mb-4">
            <Ionicons name="ticket-outline" size={36} color="#6C5CE7" />
          </View>
          <Text className="text-lg font-bold text-text-primary text-center mb-2">
            Einladungscode eingeben
          </Text>
          <Text className="text-sm text-text-secondary text-center">
            Gib den Code ein, den du vom Veranstalter erhalten hast.
          </Text>
        </View>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="LNUP-XXXX"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          autoFocus
          textAlign="center"
          className="bg-card border border-border rounded-xl px-4 py-4 text-text-primary text-2xl font-black tracking-widest mb-6"
        />

        <TouchableOpacity
          onPress={handleJoin}
          disabled={!code.trim()}
          className={`rounded-xl py-4 items-center ${code.trim() ? "bg-primary" : "bg-primary/30"}`}
        >
          <Text className="text-white font-bold text-base">Beitreten</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
