import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, savePushToken } from "@/lib/notifications";
import { COLORS } from "@/lib/constants";

interface Preferences {
  event_reminders: boolean;
  new_events_city: boolean;
  event_updates: boolean;
  post_event_confirm: boolean;
}

const DEFAULT_PREFS: Preferences = {
  event_reminders: true,
  new_events_city: true,
  event_updates: true,
  post_event_confirm: true,
};

function SettingToggle({
  icon,
  label,
  description,
  value,
  onToggle,
  last,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <Ionicons name={icon as any} size={20} color="#6C5CE7" />
      <View className="flex-1 ml-3 mr-3">
        <Text className="text-sm text-text-primary font-medium">{label}</Text>
        <Text className="text-xs text-text-muted mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setPrefs({
        event_reminders: data.event_reminders,
        new_events_city: data.new_events_city,
        event_updates: data.event_updates,
        post_event_confirm: data.post_event_confirm,
      });
    }

    const { data: tokenData } = await supabase
      .from("push_tokens")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    setPushEnabled((tokenData?.length ?? 0) > 0);
    setIsLoading(false);
  }

  async function updatePref(key: keyof Preferences, value: boolean) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    if (!user) return;

    await supabase.from("notification_preferences").upsert(
      { user_id: user.id, ...updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  async function handleTogglePush() {
    if (!user) return;

    if (pushEnabled) {
      await supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user.id);
      setPushEnabled(false);
      useToastStore.getState().showToast("Push-Benachrichtigungen deaktiviert.", "info");
    } else {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(token);
        setPushEnabled(true);
        useToastStore.getState().showToast("Push-Benachrichtigungen aktiviert!", "success");
      } else {
        useToastStore.getState().showToast("Benachrichtigungen nicht erlaubt. Prüfe deine Geräteeinstellungen.", "error");
      }
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary">Benachrichtigungen</Text>
      </View>

      <View className="mx-4 mt-4 mb-6">
        <TouchableOpacity
          onPress={handleTogglePush}
          className={`flex-row items-center justify-between p-4 rounded-xl border ${
            pushEnabled ? "bg-primary/10 border-primary/30" : "bg-card border-border"
          }`}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons
              name={pushEnabled ? "notifications" : "notifications-off-outline"}
              size={22}
              color={pushEnabled ? "#6C5CE7" : "#6B6B80"}
            />
            <View>
              <Text className="text-sm font-semibold text-text-primary">
                Push-Benachrichtigungen
              </Text>
              <Text className="text-xs text-text-muted">
                {pushEnabled ? "Aktiviert" : "Deaktiviert"}
              </Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${pushEnabled ? "bg-primary" : "bg-card border border-border"}`}>
            <Text className={`text-xs font-medium ${pushEnabled ? "text-white" : "text-text-muted"}`}>
              {pushEnabled ? "AN" : "AUS"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View className="mx-4 mb-2">
        <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
          Benachrichtigungstypen
        </Text>
        <View className="bg-card rounded-xl border border-border overflow-hidden">
          <SettingToggle
            icon="alarm-outline"
            label="Event-Erinnerungen"
            description="1 Stunde vor Events, bei denen du dabei bist"
            value={prefs.event_reminders}
            onToggle={(v) => updatePref("event_reminders", v)}
          />
          <SettingToggle
            icon="location-outline"
            label="Neue Events in deiner Stadt"
            description="Wenn neue Events in deiner Stadt gepostet werden"
            value={prefs.new_events_city}
            onToggle={(v) => updatePref("new_events_city", v)}
          />
          <SettingToggle
            icon="refresh-outline"
            label="Event-Updates"
            description="Wenn gespeicherte Events geändert oder abgesagt werden"
            value={prefs.event_updates}
            onToggle={(v) => updatePref("event_updates", v)}
          />
          <SettingToggle
            icon="checkmark-circle-outline"
            label="War dabei?"
            description="Nach dem Event: Bestätige deine Teilnahme"
            value={prefs.post_event_confirm}
            onToggle={(v) => updatePref("post_event_confirm", v)}
            last
          />
        </View>
      </View>
    </View>
  );
}
