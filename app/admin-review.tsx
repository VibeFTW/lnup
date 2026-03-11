import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { extractEventsFromUrl } from "@/lib/aiScraper";
import { useToastStore } from "@/stores/toastStore";
import { formatEventDate, formatTime } from "@/lib/utils";
import { COLORS } from "@/lib/constants";


export default function AdminReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState("");

  useEffect(() => {
    loadPendingEvents();
  }, []);

  async function loadPendingEvents() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*, venues(name, city)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });

      if (!error && data) setEvents(data);
      else if (error) console.warn("loadPendingEvents error:", error.message);
    } catch (e) {
      console.warn("loadPendingEvents failed:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(eventId: string) {
    const { error } = await supabase
      .from("events")
      .update({ status: "active" })
      .eq("id", eventId);

    if (error) {
      useToastStore.getState().showToast("Fehler beim Freigeben.", "error");
      return;
    }
    useToastStore.getState().showToast("Event freigegeben!", "success");
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }

  async function handleReject(eventId: string) {
    Alert.alert("Event ablehnen", "Dieses Event wirklich ablehnen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Ablehnen",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("events")
            .update({ status: "removed" })
            .eq("id", eventId);

          if (error) {
            useToastStore.getState().showToast("Fehler beim Ablehnen.", "error");
            return;
          }
          useToastStore.getState().showToast("Event abgelehnt.", "info");
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
        },
      },
    ]);
  }

  async function handleBatchScrape() {
    setIsScraping(true);
    setScrapeProgress("Lade Quellen...");

    try {
      const { data: sources, error } = await supabase
        .from("scrape_sources")
        .select("*")
        .eq("active", true);

      if (error || !sources?.length) {
        Alert.alert("Keine Quellen", "Es sind keine aktiven Scrape-Quellen konfiguriert.");
        setIsScraping(false);
        setScrapeProgress("");
        return;
      }

      let totalFound = 0;

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        setScrapeProgress(`${i + 1}/${sources.length}: ${source.source_name}...`);

        try {
          const extracted = await extractEventsFromUrl(source.url);

          for (const event of extracted) {
            let venueId: string | null = null;
            const { data: existingVenue } = await supabase
              .from("venues")
              .select("id")
              .ilike("name", `%${event.venue_name}%`)
              .limit(1)
              .maybeSingle();

            if (existingVenue) {
              venueId = existingVenue.id;
            } else {
              const { data: newVenue } = await supabase
                .from("venues")
                .insert({
                  name: event.venue_name,
                  address: event.venue_address,
                  city: event.city || source.city,
                  lat: 0,
                  lng: 0,
                })
                .select("id")
                .single();
              venueId = newVenue?.id ?? null;
            }

            await supabase.from("events").insert({
              title: event.title,
              description: event.description,
              venue_id: venueId,
              event_date: event.date,
              time_start: event.time_start,
              time_end: event.time_end,
              category: event.category,
              price_info: event.price_info || null,
              source_type: "ai_scraped",
              source_url: source.url,
              status: "pending_review",
              ai_confidence: event.confidence,
            });

            totalFound++;
          }

          await supabase
            .from("scrape_sources")
            .update({ last_scraped: new Date().toISOString() })
            .eq("id", source.id);
        } catch (err) {
          console.warn(`Scrape failed for ${source.url}:`, err);
        }
      }

      setScrapeProgress("");
      useToastStore.getState().showToast(`${totalFound} Events gefunden und zur Prüfung eingereicht.`, "success");
      loadPendingEvents();
    } catch (error: any) {
      Alert.alert("Fehler", error?.message ?? "Batch-Scrape fehlgeschlagen.");
    } finally {
      setIsScraping(false);
      setScrapeProgress("");
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
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-text-primary">Admin Review</Text>
          <Text className="text-xs text-text-muted">{events.length} Events zur Prüfung</Text>
        </View>
        <TouchableOpacity
          onPress={handleBatchScrape}
          disabled={isScraping}
          className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
            isScraping ? "bg-primary/30" : "bg-primary"
          }`}
        >
          {isScraping ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="search" size={14} color="#FFFFFF" />
          )}
          <Text className="text-xs font-semibold text-white">Scrapen</Text>
        </TouchableOpacity>
      </View>

      {isScraping && scrapeProgress && (
        <View className="mx-4 mb-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <Text className="text-xs text-primary font-medium">{scrapeProgress}</Text>
        </View>
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View className="mx-4 mb-3 bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-start justify-between mb-2">
              <Text className="text-base font-bold text-text-primary flex-1" numberOfLines={2}>
                {item.title}
              </Text>
              {item.ai_confidence != null && (
                <View className="bg-primary/15 rounded-full px-2 py-0.5 ml-2">
                  <Text className="text-xs text-primary font-medium">
                    {Math.round(item.ai_confidence * 100)}%
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-sm text-text-secondary mb-3" numberOfLines={2}>
              {item.description}
            </Text>

            <View className="gap-1 mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
                <Text className="text-xs text-text-muted">
                  {formatEventDate(item.event_date)} · {formatTime(item.time_start)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
                <Text className="text-xs text-text-muted">
                  {item.venues?.name ?? "?"}{item.venues?.city ? `, ${item.venues.city}` : ""}
                </Text>
              </View>
              {item.source_url && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="link-outline" size={13} color={COLORS.textMuted} />
                  <Text className="text-xs text-text-muted" numberOfLines={1}>
                    {item.source_url}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => handleApprove(item.id)}
                className="flex-1 bg-success/15 border border-success/30 rounded-xl py-3 items-center flex-row justify-center gap-1.5"
              >
                <Ionicons name="checkmark-circle" size={16} color="#00E676" />
                <Text className="text-success font-bold text-sm">Freigeben</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReject(item.id)}
                className="flex-1 bg-danger/15 border border-danger/30 rounded-xl py-3 items-center flex-row justify-center gap-1.5"
              >
                <Ionicons name="close-circle" size={16} color="#FF5252" />
                <Text className="text-danger font-bold text-sm">Ablehnen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-20 px-8">
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#00E676" />
            <Text className="text-lg font-semibold text-text-primary text-center mt-4 mb-2">
              Alles geprüft!
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              Keine Events zur Prüfung. Starte einen Scrape um neue zu finden.
            </Text>
          </View>
        }
      />
    </View>
  );
}
