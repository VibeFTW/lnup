import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEventStore } from "@/stores/eventStore";
import { useAuthStore } from "@/stores/authStore";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";
import { formatEventDate, formatTime } from "@/lib/utils";

interface EventPreview {
  id: string;
  title: string;
  event_date: string;
  time_start: string;
  venue_name: string;
  member_count: number;
  max_attendees: number | null;
}

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const joinEvent = useEventStore((s) => s.joinEvent);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [showAuthGuard, setShowAuthGuard] = useState(false);

  useEffect(() => {
    loadPreview();
  }, [code]);

  async function loadPreview() {
    if (!code) {
      setError("Kein Einladungscode angegeben.");
      setIsLoading(false);
      return;
    }

    const { data: event } = await supabase
      .from("events")
      .select("id, title, event_date, time_start, max_attendees, venues(name)")
      .eq("invite_code", code.toUpperCase())
      .eq("is_private", true)
      .eq("status", "active")
      .maybeSingle();

    if (!event) {
      setError("Ungültiger oder abgelaufener Einladungscode.");
      setIsLoading(false);
      return;
    }

    const { count } = await supabase
      .from("event_members")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: existing } = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (existing) setAlreadyJoined(true);
    }

    setPreview({
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      time_start: event.time_start,
      venue_name: (event.venues as any)?.name ?? "Unbekannt",
      member_count: count ?? 0,
      max_attendees: event.max_attendees,
    });
    setIsLoading(false);
  }

  async function handleJoin() {
    if (!isAuthenticated) {
      setShowAuthGuard(true);
      return;
    }
    if (!code) return;

    setIsJoining(true);
    const event = await joinEvent(code);
    setIsJoining(false);

    if (event) {
      router.replace(`/event/${event.id}`);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 rounded-full bg-danger/15 items-center justify-center mb-6">
          <Ionicons name="close-circle" size={40} color="#FF5252" />
        </View>
        <Text className="text-xl font-bold text-text-primary text-center mb-3">{error}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-card border border-border rounded-xl py-3 px-8 mt-4">
          <Text className="text-text-primary font-medium">Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFull = preview?.max_attendees ? preview.member_count >= preview.max_attendees : false;

  return (
    <View className="flex-1 bg-background items-center justify-center px-8" style={{ paddingTop: insets.top }}>
      <View className="w-20 h-20 rounded-full bg-primary/15 items-center justify-center mb-6">
        <Ionicons name="lock-open-outline" size={36} color="#6C5CE7" />
      </View>

      <Text className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Privates Event</Text>
      <Text className="text-2xl font-bold text-text-primary text-center mb-6">{preview?.title}</Text>

      <View className="bg-card border border-border rounded-xl p-4 w-full mb-6 gap-3">
        <View className="flex-row items-center gap-3">
          <Ionicons name="calendar-outline" size={18} color="#A0A0B8" />
          <Text className="text-sm text-text-secondary">
            {formatEventDate(preview?.event_date ?? "")} · {formatTime(preview?.time_start ?? "")}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Ionicons name="location-outline" size={18} color="#A0A0B8" />
          <Text className="text-sm text-text-secondary">{preview?.venue_name}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Ionicons name="people-outline" size={18} color="#A0A0B8" />
          <Text className="text-sm text-text-secondary">
            {preview?.member_count} Mitglieder
            {preview?.max_attendees ? ` / ${preview.max_attendees} max.` : ""}
          </Text>
        </View>
      </View>

      {alreadyJoined ? (
        <View className="bg-success/15 border border-success/30 rounded-xl py-4 px-8 flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={20} color="#00E676" />
          <Text className="text-success font-bold">Du bist bereits dabei!</Text>
        </View>
      ) : isFull ? (
        <View className="bg-warning/15 border border-warning/30 rounded-xl py-4 px-8 flex-row items-center gap-2">
          <Ionicons name="alert-circle" size={20} color="#FFC107" />
          <Text className="text-warning font-bold">Event ist voll</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleJoin}
          disabled={isJoining}
          className={`rounded-xl py-4 w-full items-center ${isJoining ? "bg-primary/50" : "bg-primary"}`}
        >
          <Text className="text-white font-bold text-base">
            {isJoining ? "Wird beigetreten..." : "Beitreten"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.back()} className="mt-4">
        <Text className="text-sm text-text-muted">Abbrechen</Text>
      </TouchableOpacity>

      <AuthGuard
        visible={showAuthGuard}
        onClose={() => setShowAuthGuard(false)}
        message="Melde dich an, um privaten Events beizutreten."
      />
    </View>
  );
}
