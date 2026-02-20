import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { useEventStore } from "@/stores/eventStore";
import { SkeletonProfile } from "@/components/SkeletonProfile";
import { getRankForScore, getNextRank, getProgressToNextRank } from "@/lib/ranks";
import { formatEventDate, formatTime } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const getEventsByCreator = useEventStore((s) => s.getEventsByCreator);

  if (isAuthLoading && !user) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <SkeletonProfile />
      </View>
    );
  }

  if (!user) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-4xl mb-4">👤</Text>
        <Text className="text-lg font-semibold text-text-primary text-center mb-2">
          Nicht angemeldet
        </Text>
        <Text className="text-sm text-text-secondary text-center mb-6">
          Melde dich an, um Events zu erstellen und deinen Rang aufzubauen.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="bg-primary rounded-xl px-8 py-3"
        >
          <Text className="text-white font-bold text-base">Anmelden</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rank = getRankForScore(user.trust_score);
  const nextRank = getNextRank(rank.id);
  const progress = getProgressToNextRank(user.trust_score);
  const myEvents = getEventsByCreator(user.id);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
    >
      {/* Settings Icon */}
      <View className="flex-row justify-end px-4 pt-3">
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
        >
          <Ionicons name="settings-outline" size={18} color="#A0A0B8" />
        </TouchableOpacity>
      </View>

      {/* Profile Header */}
      <View className="px-4 pb-6">
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-card border-2 border-primary items-center justify-center mb-3">
            <Text className="text-3xl">{rank.icon}</Text>
          </View>

          <Text className="text-xl font-bold text-text-primary">
            {user.display_name}
          </Text>
          <Text className="text-sm text-text-muted mb-2">@{user.username}</Text>

          <View
            className="rounded-full px-4 py-1.5 mb-4"
            style={{ backgroundColor: rank.color + "20" }}
          >
            <Text className="text-sm font-bold" style={{ color: rank.color }}>
              {rank.icon} {rank.label}
            </Text>
          </View>

          <Text className="text-3xl font-bold text-text-primary mb-1">
            {user.trust_score}
          </Text>
          <Text className="text-sm text-text-secondary mb-4">Punkte</Text>

          {nextRank && (
            <View className="w-full px-4">
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-text-muted">{rank.label}</Text>
                <Text className="text-xs text-text-muted">
                  {nextRank.icon} {nextRank.label}
                </Text>
              </View>
              <View className="h-2.5 bg-card rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    backgroundColor: rank.color,
                  }}
                />
              </View>
              <Text className="text-xs text-text-muted text-center mt-1.5">
                Noch {nextRank.min_score - user.trust_score} Punkte bis{" "}
                {nextRank.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      <View className="flex-row mx-4 gap-3 mb-6">
        <View className="flex-1 bg-card rounded-xl p-4 items-center border border-border">
          <Text className="text-2xl font-bold text-text-primary">
            {user.events_posted}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">Events</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl p-4 items-center border border-border">
          <Text className="text-2xl font-bold text-text-primary">
            {user.events_confirmed}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">Bestätigt</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl p-4 items-center border border-border">
          <Text className="text-2xl font-bold text-success">
            {user.reports_count}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">Reports</Text>
        </View>
      </View>

      {/* Meine Events */}
      <View className="mx-4 mb-6">
        <Text className="text-sm font-semibold text-text-primary mb-3">
          Meine Events
        </Text>
        {myEvents.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/create")}
            className="bg-card rounded-xl border border-border border-dashed p-6 items-center"
          >
            <Ionicons name="add-circle-outline" size={32} color="#6C5CE7" />
            <Text className="text-sm text-text-secondary mt-2">
              Erstelle dein erstes Event
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="gap-2">
            {myEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => router.push(`/event/${event.id}`)}
                className="bg-card rounded-xl border border-border p-3 flex-row items-center gap-3"
              >
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "#6C5CE7" + "20" }}
                >
                  <Ionicons
                    name={getCategoryIcon(event.category) as any}
                    size={20}
                    color="#6C5CE7"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text className="text-xs text-text-muted">
                    {formatEventDate(event.event_date)} · {formatTime(event.time_start)}
                  </Text>
                </View>
                <View className="items-end gap-0.5">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="people-outline" size={12} color="#00D2FF" />
                    <Text className="text-xs text-secondary">{event.going_count}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="bookmark-outline" size={12} color="#6B6B80" />
                    <Text className="text-xs text-text-muted">{event.saves_count}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Verification Status */}
      <View className="mx-4 mb-6">
        <Text className="text-sm font-semibold text-text-primary mb-3">
          Verifizierung
        </Text>
        <View className="bg-card rounded-xl border border-border p-4 gap-3">
          <View className="flex-row items-center gap-3">
            <Ionicons
              name={user.email_verified ? "checkmark-circle" : "close-circle"}
              size={20}
              color={user.email_verified ? "#00E676" : "#6B6B80"}
            />
            <Text className="text-sm text-text-secondary">E-Mail verifiziert</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons
              name={user.phone_verified ? "checkmark-circle" : "close-circle"}
              size={20}
              color={user.phone_verified ? "#00E676" : "#6B6B80"}
            />
            <Text className="text-sm text-text-secondary">
              Telefon verifiziert
            </Text>
          </View>
        </View>
      </View>

      {/* Member Since */}
      <View className="mx-4 mb-6">
        <View className="bg-card rounded-xl border border-border p-4">
          <View className="flex-row items-center gap-3">
            <Ionicons name="calendar-outline" size={20} color="#A0A0B8" />
            <Text className="text-sm text-text-secondary">
              Mitglied seit{" "}
              {new Date(user.created_at).toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      <View className="mb-12" />
    </ScrollView>
  );
}
