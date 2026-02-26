import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useEventStore } from "@/stores/eventStore";
import { getRankForScore, getNextRank, getProgressToNextRank } from "@/lib/ranks";
import { formatEventDate, formatTime } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";
import type { Profile, RankId } from "@/types";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getEventsByCreator = useEventStore((s) => s.getEventsByCreator);
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles_with_stats")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setUser({
          id: data.id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          bio: data.bio ?? null,
          role: data.role,
          trust_score: data.trust_score,
          rank: (data.rank ?? getRankForScore(data.trust_score).id) as RankId,
          email_verified: data.email_verified,
          phone_verified: data.phone_verified,
          show_history: data.show_history ?? true,
          created_at: data.created_at,
          events_posted: data.events_posted ?? 0,
          events_confirmed: data.events_confirmed ?? 0,
          reports_count: data.reports_count ?? 0,
        });
      }
      setIsLoading(false);
    }
    loadProfile();
  }, [id]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-card items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-text-muted">Nutzer nicht gefunden</Text>
        </View>
      </View>
    );
  }

  const rank = getRankForScore(user.trust_score);
  const nextRank = getNextRank(rank.id);
  const progress = getProgressToNextRank(user.trust_score);
  const userEvents = getEventsByCreator(user.id);
  const [attendedEvents, setAttendedEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!user.show_history) return;
    async function fetchAttended() {
      const today = new Date().toISOString().split("T")[0];
      const { data: confirmations } = await supabase
        .from("event_confirmations")
        .select("event_id")
        .eq("user_id", user.id)
        .in("status", ["going", "attended"]);
      if (!confirmations || confirmations.length === 0) return;
      const eventIds = confirmations.map((c: any) => c.event_id);
      const { data: events } = await supabase
        .from("events_with_counts")
        .select("id, title, event_date, time_start, category, created_by, venues(name, city)")
        .in("id", eventIds)
        .lt("event_date", today)
        .order("event_date", { ascending: false })
        .limit(10);
      if (events) {
        setAttendedEvents(events.filter((e: any) => e.created_by !== user.id));
      }
    }
    fetchAttended();
  }, [user.id, user.show_history]);

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
        <Text className="text-lg font-bold text-text-primary">@{user.username}</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="items-center px-4 pb-6">
          <View
            className="w-20 h-20 rounded-full border-2 items-center justify-center mb-3"
            style={{ borderColor: rank.color, backgroundColor: rank.color + "15" }}
          >
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
            {user.trust_score.toLocaleString("de-DE")}
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
            </View>
          )}
        </View>

        {/* Stats */}
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

        {/* Verification */}
        <View className="mx-4 mb-6">
          <View className="bg-card rounded-xl border border-border p-4 flex-row gap-4">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={user.email_verified ? "checkmark-circle" : "close-circle"}
                size={16}
                color={user.email_verified ? "#00E676" : "#6B6B80"}
              />
              <Text className="text-xs text-text-secondary">E-Mail</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={user.phone_verified ? "checkmark-circle" : "close-circle"}
                size={16}
                color={user.phone_verified ? "#00E676" : "#6B6B80"}
              />
              <Text className="text-xs text-text-secondary">Telefon</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={16} color="#6B6B80" />
              <Text className="text-xs text-text-secondary">
                Seit{" "}
                {new Date(user.created_at).toLocaleDateString("de-DE", {
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* User's Events */}
        <View className="mx-4 mb-6">
          <Text className="text-sm font-semibold text-text-primary mb-3">
            Events von {user.display_name}
          </Text>
          {userEvents.length === 0 ? (
            <View className="bg-card rounded-xl border border-border p-6 items-center">
              <Text className="text-sm text-text-muted">
                Noch keine Events erstellt
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {userEvents.map((event) => (
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
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Dabei gewesen (public, if allowed) */}
        {user.show_history && attendedEvents.length > 0 && (
          <View className="mx-4 mb-12">
            <Text className="text-sm font-semibold text-text-primary mb-3">
              Dabei gewesen
            </Text>
            <View className="gap-2">
              {attendedEvents.map((event: any) => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.push(`/event/${event.id}`)}
                  className="bg-card rounded-xl border border-border p-3 flex-row items-center gap-3"
                  style={{ opacity: 0.7 }}
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
                      {event.venues?.city ? ` · ${event.venues.city}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
