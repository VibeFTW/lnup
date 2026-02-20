import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mb-6">
      <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
        {title}
      </Text>
      <View className="bg-card rounded-xl border border-border overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  iconColor = "#A0A0B8",
  label,
  value,
  onPress,
  danger,
  last,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
      className={`flex-row items-center px-4 py-3.5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={danger ? "#FF5252" : iconColor}
      />
      <Text
        className={`flex-1 text-sm ml-3 ${
          danger ? "text-danger font-medium" : "text-text-primary"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-sm text-text-muted mr-1">{value}</Text>
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#6B6B80" />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Konto löschen",
      "Bist du sicher? Alle deine Daten, Events und Punkte werden unwiderruflich gelöscht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Konto löschen",
          style: "destructive",
          onPress: () => {
            // TODO: Delete account via Supabase
            handleLogout();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary">Einstellungen</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SettingsSection title="Konto">
          <SettingsRow
            icon="mail-outline"
            label="E-Mail"
            value={user ? "demo@lnup.app" : "—"}
          />
          <SettingsRow
            icon="person-outline"
            label="Benutzername"
            value={user ? `@${user.username}` : "—"}
          />
          <SettingsRow
            icon="calendar-outline"
            label="Mitglied seit"
            value={
              user
                ? new Date(user.created_at).toLocaleDateString("de-DE", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <SettingsRow
            icon="create-outline"
            label="Profil bearbeiten"
            iconColor="#6C5CE7"
            onPress={() => {}}
            last
          />
        </SettingsSection>

        {/* App */}
        <SettingsSection title="App">
          <SettingsRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
          />
          <SettingsRow
            icon="chatbubble-outline"
            label="Feedback geben"
            onPress={() => {}}
          />
          <SettingsRow
            icon="star-outline"
            label="App bewerten"
            onPress={() => {}}
            last
          />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Rechtliches">
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Datenschutz"
            onPress={() => {}}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Nutzungsbedingungen"
            onPress={() => {}}
          />
          <SettingsRow
            icon="business-outline"
            label="Impressum"
            onPress={() => {}}
            last
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Gefahrenzone">
          <SettingsRow
            icon="log-out-outline"
            label="Abmelden"
            danger
            onPress={handleLogout}
          />
          <SettingsRow
            icon="trash-outline"
            label="Konto löschen"
            danger
            onPress={handleDeleteAccount}
            last
          />
        </SettingsSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
