import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface AuthGuardProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
}

export function AuthGuard({ visible, onClose, message }: AuthGuardProps) {
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm items-center">
          <View className="w-16 h-16 rounded-full bg-primary/15 items-center justify-center mb-4">
            <Ionicons name="lock-closed" size={28} color="#6C5CE7" />
          </View>

          <Text className="text-lg font-bold text-text-primary text-center mb-2">
            Anmeldung erforderlich
          </Text>
          <Text className="text-sm text-text-secondary text-center mb-6">
            {message ?? "Bitte melde dich an, um diese Funktion zu nutzen."}
          </Text>

          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/(auth)/login");
            }}
            className="bg-primary rounded-xl py-3.5 w-full items-center mb-3"
          >
            <Text className="text-white font-bold text-base">Anmelden</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/(auth)/register");
            }}
            className="bg-card border border-border rounded-xl py-3.5 w-full items-center mb-3"
          >
            <Text className="text-text-primary font-medium text-base">Konto erstellen</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text className="text-sm text-text-muted">Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
