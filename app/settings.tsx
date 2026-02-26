import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore, type ThemeMode } from "@/stores/themeStore";
import { supabase } from "@/lib/supabase";

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

function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const options: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: "Hell", icon: "sunny-outline" },
    { id: "dark", label: "Dunkel", icon: "moon-outline" },
    { id: "system", label: "System", icon: "phone-portrait-outline" },
  ];

  return (
    <View className="flex-row p-2 gap-1">
      {options.map((opt) => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => setMode(opt.id)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
              active ? "bg-primary" : ""
            }`}
          >
            <Ionicons name={opt.icon as any} size={16} color={active ? "#FFFFFF" : "#6B6B80"} />
            <Text className={`text-sm font-medium ${active ? "text-white" : "text-text-muted"}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function HistoryToggle() {
  const user = useAuthStore((s) => s.user);
  const [showHistory, setShowHistory] = useState(user?.show_history ?? true);

  const toggle = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (user) {
      await supabase.from("profiles").update({ show_history: next }).eq("id", user.id);
    }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      className="flex-row items-center justify-between px-4 py-3"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Ionicons name="eye-outline" size={20} color="#6C5CE7" />
        <View className="flex-1">
          <Text className="text-sm text-text-primary">Event-Verlauf öffentlich</Text>
          <Text className="text-xs text-text-muted">Andere sehen bei welchen Events du warst</Text>
        </View>
      </View>
      <Ionicons
        name={showHistory ? "toggle" : "toggle-outline"}
        size={36}
        color={showHistory ? "#6C5CE7" : "#6B6B80"}
      />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [email, setEmail] = useState("—");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
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
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace("/(auth)/login");
            } catch {
              Alert.alert("Fehler", "Konto konnte nicht gelöscht werden. Bitte versuche es erneut.");
            }
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
            value={user ? email : "—"}
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
            onPress={() => router.push("/profile-edit")}
            last
          />
        </SettingsSection>

        {/* Design */}
        <SettingsSection title="Design">
          <ThemeSelector />
        </SettingsSection>

        {/* Privatsphaere */}
        <SettingsSection title="Privatsph\u00e4re">
          <HistoryToggle />
        </SettingsSection>

        {/* App */}
        <SettingsSection title="App">
          <SettingsRow
            icon="notifications-outline"
            label="Benachrichtigungen"
            iconColor="#6C5CE7"
            onPress={() => router.push("/notification-settings")}
          />
          <SettingsRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
          />
          <SettingsRow
            icon="rocket-outline"
            label="Onboarding nochmal ansehen"
            iconColor="#6C5CE7"
            onPress={async () => {
              await AsyncStorage.removeItem("@lnup_onboarded");
              router.replace("/onboarding");
            }}
            last
          />
        </SettingsSection>

        {/* Admin (only for admins) */}
        {user?.role === "admin" && (
          <SettingsSection title="Admin">
            <SettingsRow
              icon="sparkles-outline"
              label="KI-Events prüfen"
              iconColor="#6C5CE7"
              onPress={() => router.push("/admin-review")}
              last
            />
          </SettingsSection>
        )}

        {/* Legal */}
        <SettingsSection title="Rechtliches">
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Datenschutz"
            onPress={() => router.push("/privacy")}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Nutzungsbedingungen"
            onPress={() => router.push("/terms")}
          />
          <SettingsRow
            icon="business-outline"
            label="Impressum"
            onPress={() => router.push("/imprint")}
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
