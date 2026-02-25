import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Share, Alert, FlatList, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEventStore } from "@/stores/eventStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { SkeletonCard } from "@/components/SkeletonCard";
import { TrustBadge } from "@/components/TrustBadge";
import { RankBadge } from "@/components/RankBadge";
import { EventCover } from "@/components/EventCover";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUpload } from "@/components/PhotoUpload";
import { PhotoModeration } from "@/components/PhotoModeration";
import { ReportModal } from "@/components/ReportModal";
import { InviteModal } from "@/components/InviteModal";
import { formatEventDate, formatTime } from "@/lib/utils";
import { getCategoryLabel, getCategoryIcon, getCategoryGradient } from "@/lib/categories";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reportVisible, setReportVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, 520);
  const router = useRouter();
  const event = useEventStore((s) => s.getEventById(id));
  const toggleSave = useEventStore((s) => s.toggleSave);
  const toggleGoing = useEventStore((s) => s.toggleGoing);
  const confirmAttended = useEventStore((s) => s.confirmAttended);
  const savedIds = useEventStore((s) => s.savedEventIds);
  const goingIds = useEventStore((s) => s.goingEventIds);
  const getPhotosForEvent = useEventStore((s) => s.getPhotosForEvent);
  const fetchPhotosForEvent = useEventStore((s) => s.fetchPhotosForEvent);
  const leaveEvent = useEventStore((s) => s.leaveEvent);
  const currentUser = useAuthStore((s) => s.user);
  const [isMemberChecked, setIsMemberChecked] = useState(false);
  const [isMemberState, setIsMemberState] = useState(false);

  useEffect(() => {
    if (id) fetchPhotosForEvent(id);
  }, [id]);

  useEffect(() => {
    async function checkMembership() {
      if (!event?.is_private || !currentUser?.id) {
        setIsMemberChecked(true);
        return;
      }
      if (event.is_member !== undefined) {
        setIsMemberState(!!event.is_member);
        setIsMemberChecked(true);
        return;
      }
      const { data } = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", id)
        .eq("user_id", currentUser.id)
        .maybeSingle();
      setIsMemberState(!!data);
      setIsMemberChecked(true);
    }
    checkMembership();
  }, [id, event?.is_private, currentUser?.id]);

  if (!event) {
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
        <SkeletonCard count={1} />
      </View>
    );
  }

  const isSaved = savedIds.has(event.id);
  const isGoing = goingIds.has(event.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = event.event_date.split("-").map(Number);
  const eventDay = new Date(y, m - 1, d);
  const isPast = eventDay < today;
  const approvedPhotos = getPhotosForEvent(event.id);
  const isHost = currentUser?.id === event.created_by;
  const isAdmin = currentUser?.role === "admin";
  const canEdit = isHost || isAdmin;
  const isMember = event.is_private && (event.is_member || isMemberState) && !isHost;

  return (
    <View className="flex-1 bg-background" style={{ alignItems: "center" }}>
      <View style={{ maxWidth: 520, width: "100%", flex: 1 }}>
      {/* Floating Header */}
      <View
        className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 py-3"
        style={{ paddingTop: insets.top }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View className="flex-row gap-2">
          {event.is_private && event.invite_code && (canEdit || event.is_member) && (
            <TouchableOpacity
              onPress={() => setInviteVisible(true)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            >
              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity
              onPress={() => router.push(`/event/${event.id}/edit`)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => toggleSave(event.id)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={isSaved ? "#6C5CE7" : "#FFFFFF"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              try {
                await Share.share({
                  message: `${event.title} — ${formatEventDate(event.event_date)}, ${formatTime(event.time_start)} Uhr @ ${event.venue?.name ?? ""}. Entdeckt auf LNUP!`,
                });
              } catch {}
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {event.images && event.images.length > 1 ? (() => {
          const [catColor] = getCategoryGradient(event.category);
          const carouselHeight = Math.round(contentWidth * 9 / 16);
          return (
            <View style={{ backgroundColor: catColor }}>
              <View style={{ height: carouselHeight }}>
                <FlatList
                  data={event.images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item }) => (
                    <View style={{ width: contentWidth, height: carouselHeight }}>
                      <Image source={{ uri: item }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
                    </View>
                  )}
                />
                <View className="absolute bottom-2 right-3 bg-black/50 rounded-full px-2.5 py-1">
                  <Text className="text-xs text-white font-medium">{event.images.length} Fotos</Text>
                </View>
              </View>
              <View
                className="flex-row items-center px-3 py-1"
                style={{ backgroundColor: catColor + "18" }}
              >
                <Ionicons name={getCategoryIcon(event.category) as any} size={11} color={catColor} />
                <Text style={{ color: catColor, marginLeft: 5 }} className="text-xs font-semibold">
                  {getCategoryLabel(event.category)}
                </Text>
              </View>
            </View>
          );
        })() : (
          <EventCover category={event.category} imageUrl={event.image_url} size="detail" />
        )}

        <View className="px-4 pb-8 -mt-4 rounded-t-3xl bg-background pt-5">
          {/* Private Badge */}
          {event.is_private && (
            <View className="flex-row items-center gap-1.5 mb-3 bg-primary/10 rounded-full px-3 py-1.5 self-start border border-primary/30">
              <Ionicons name="lock-closed" size={12} color="#6C5CE7" />
              <Text className="text-xs font-semibold text-primary">Privates Event</Text>
            </View>
          )}

          {/* Trust Badge + Creator (tappable) */}
          <View className="flex-row items-center gap-2 mb-3">
            <TrustBadge sourceType={event.source_type} />
            {event.creator && (
              <TouchableOpacity
                onPress={() => event.creator?.id && router.push(`/user/${event.creator.id}`)}
                className="flex-row items-center gap-1.5"
              >
                <RankBadge score={event.creator.trust_score} />
                <Text className="text-xs text-text-muted">
                  · {event.creator.display_name} ({event.creator.trust_score})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-3xl font-bold text-text-primary mb-2">
            {event.title}
          </Text>

          <View className="flex-row items-center gap-1.5 mb-4">
            <Ionicons name={getCategoryIcon(event.category) as any} size={16} color="#6C5CE7" />
            <Text className="text-sm font-medium text-primary">
              {getCategoryLabel(event.category)}
            </Text>
          </View>

          <Text className="text-base text-text-secondary leading-6 mb-6">
            {event.description}
          </Text>

          {/* Info Cards */}
          <View className="gap-3 mb-6">
            <View className="bg-card rounded-xl border border-border p-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <Ionicons name="location" size={20} color="#6C5CE7" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">{event.venue?.name}</Text>
                <Text className="text-xs text-text-secondary">{[event.venue?.address, event.venue?.city].filter(Boolean).join(", ")}</Text>
              </View>
              <Ionicons name="navigate-outline" size={18} color="#A0A0B8" />
            </View>

            <View className="bg-card rounded-xl border border-border p-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <Ionicons name="calendar" size={20} color="#6C5CE7" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-text-primary">{formatEventDate(event.event_date)}</Text>
                <Text className="text-xs text-text-secondary">
                  {formatTime(event.time_start)}{event.time_end && ` – ${formatTime(event.time_end)}`} Uhr
                </Text>
              </View>
            </View>

            {event.price_info && (
              <View className="bg-card rounded-xl border border-border p-4 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <Ionicons name="pricetag" size={20} color="#6C5CE7" />
                </View>
                <Text className="text-sm font-semibold text-text-primary">{event.price_info}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row gap-2 mb-6">
            <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
              <Ionicons name="people" size={18} color="#00D2FF" />
              <Text className="text-lg font-bold text-text-primary mt-1">{event.going_count}</Text>
              <Text className="text-xs text-text-muted">Dabei</Text>
            </View>
            <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
              <Ionicons name="bookmark" size={18} color="#6C5CE7" />
              <Text className="text-lg font-bold text-text-primary mt-1">{event.saves_count}</Text>
              <Text className="text-xs text-text-muted">Gemerkt</Text>
            </View>
            <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
              <Ionicons name="checkmark-circle" size={18} color="#00E676" />
              <Text className="text-lg font-bold text-text-primary mt-1">{event.confirmations_count}</Text>
              <Text className="text-xs text-text-muted">War dabei</Text>
            </View>
            <View className="flex-1 bg-card rounded-xl border border-border p-3 items-center">
              <Ionicons name="camera" size={18} color="#FF6B9D" />
              <Text className="text-lg font-bold text-text-primary mt-1">{event.photos_count}</Text>
              <Text className="text-xs text-text-muted">Fotos</Text>
            </View>
          </View>

          <PhotoGallery photos={approvedPhotos} />
          {isHost && <PhotoModeration eventId={event.id} />}
          <PhotoUpload eventId={event.id} />

          {event.source_type === "community" && event.creator?.rank === "newbie" && (
            <View className="bg-warning/10 rounded-xl border border-warning/30 p-4 flex-row items-start gap-3 mb-6">
              <Ionicons name="alert-circle" size={20} color="#FFC107" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-warning mb-1">Unbestätigtes Event</Text>
                <Text className="text-xs text-text-secondary">
                  Dieses Event wurde von einem neuen Nutzer erstellt. Details könnten ungenau sein.
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3">
            {isPast ? (
              <TouchableOpacity
                onPress={() => confirmAttended(event.id)}
                className="rounded-xl py-4 items-center flex-row justify-center gap-2 bg-success/20 border border-success/40"
              >
                <Ionicons name="checkmark-circle" size={20} color="#00E676" />
                <Text className="text-success font-bold text-base">War dabei!</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => toggleGoing(event.id)}
                className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
                  isGoing ? "bg-secondary/20 border border-secondary/40" : "bg-secondary"
                }`}
              >
                <Ionicons name={isGoing ? "people" : "people-outline"} size={20} color={isGoing ? "#00D2FF" : "#FFFFFF"} />
                <Text className={`font-bold text-base ${isGoing ? "text-secondary" : "text-white"}`}>
                  {isGoing ? `Dabei! (${event.going_count})` : `Bin dabei! (${event.going_count})`}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => toggleSave(event.id)}
              className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
                isSaved ? "bg-card border border-primary" : "bg-primary"
              }`}
            >
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-base">
                {isSaved ? "Gespeichert" : "Event merken"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setReportVisible(true)}
              className="bg-card border border-border rounded-xl py-4 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="flag-outline" size={18} color="#FF5252" />
              <Text className="text-danger font-medium text-sm">Event melden</Text>
            </TouchableOpacity>

            {isMember && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Event verlassen",
                    "Möchtest du dieses private Event wirklich verlassen?",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Verlassen",
                        style: "destructive",
                        onPress: async () => {
                          await leaveEvent(event.id);
                          router.back();
                        },
                      },
                    ]
                  );
                }}
                className="bg-card border border-border rounded-xl py-4 items-center flex-row justify-center gap-2"
              >
                <Ionicons name="exit-outline" size={18} color="#A0A0B8" />
                <Text className="text-text-muted font-medium text-sm">Event verlassen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        eventId={event.id}
      />

      {event.is_private && event.invite_code && (
        <InviteModal
          visible={inviteVisible}
          onClose={() => setInviteVisible(false)}
          inviteCode={event.invite_code}
          eventTitle={event.title}
        />
      )}
      </View>
    </View>
  );
}
