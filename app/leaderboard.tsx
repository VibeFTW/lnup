import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { MOCK_PROFILES } from "@/lib/mockData";
import { useAuthStore } from "@/stores/authStore";
import { getRankForScore } from "@/lib/ranks";
import type { Profile } from "@/types";

function PodiumUser({ profile, position }: { profile: Profile; position: 1 | 2 | 3 }) {
  const rank = getRankForScore(profile.trust_score);
  const isFirst = position === 1;
  const height = isFirst ? 100 : 72;
  const iconSize = isFirst ? 36 : 28;
  const positionLabels = { 1: "1.", 2: "2.", 3: "3." };

  return (
    <View className={`items-center ${isFirst ? "mx-2" : ""}`} style={{ width: isFirst ? 120 : 100 }}>
      <Text className="text-sm font-bold text-text-muted mb-1">{positionLabels[position]}</Text>
      <View
        className="rounded-2xl items-center justify-center mb-2 border-2"
        style={{
          width: isFirst ? 64 : 52,
          height: isFirst ? 64 : 52,
          borderColor: rank.color,
          backgroundColor: rank.color + "15",
        }}
      >
        <Text style={{ fontSize: iconSize }}>{rank.icon}</Text>
      </View>
      <Text className="text-sm font-bold text-text-primary text-center" numberOfLines={1}>
        {profile.display_name}
      </Text>
      <Text className="text-xs font-medium mt-0.5" style={{ color: rank.color }}>
        {rank.label}
      </Text>
      <Text className="text-lg font-black text-text-primary mt-1">
        {profile.trust_score.toLocaleString("de-DE")}
      </Text>
      <Text className="text-xs text-text-muted">{profile.events_posted} Events</Text>
      <View
        className="mt-2 rounded-t-xl w-full items-center justify-end"
        style={{ height, backgroundColor: rank.color + "20" }}
      />
    </View>
  );
}

function LeaderboardRow({ profile, position, isCurrentUser, onPress }: { profile: Profile; position: number; isCurrentUser: boolean; onPress: () => void }) {
  const rank = getRankForScore(profile.trust_score);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center mx-4 px-4 py-3 rounded-xl mb-2 ${
        isCurrentUser ? "border-2" : "bg-card border border-border"
      }`}
      style={isCurrentUser ? { borderColor: "#6C5CE7", backgroundColor: "#6C5CE720" } : undefined}
    >
      <Text className="text-sm font-bold text-text-muted w-8">#{position}</Text>
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: rank.color + "20" }}
      >
        <Text className="text-base">{rank.icon}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-text-primary">
            {profile.display_name}
          </Text>
          {isCurrentUser && (
            <Text className="text-xs text-primary font-medium">(Du)</Text>
          )}
        </View>
        <Text className="text-xs" style={{ color: rank.color }}>
          {rank.label} · {profile.events_posted} Events
        </Text>
      </View>
      <Text className="text-base font-bold text-text-primary">
        {profile.trust_score.toLocaleString("de-DE")}
      </Text>
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const sorted = useMemo(() => {
    return [...MOCK_PROFILES].sort((a, b) => b.trust_score - a.trust_score);
  }, []);

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const currentUserPosition = (() => {
    if (!currentUser) return null;
    const idx = sorted.findIndex((p) => p.id === currentUser.id);
    return idx >= 0 ? idx + 1 : null;
  })();

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
        <View className="flex-1">
          <Text className="text-xl font-bold text-text-primary">Rangliste</Text>
          <Text className="text-xs text-text-muted">Top Contributor deiner Stadt</Text>
        </View>
        <Ionicons name="trophy" size={24} color="#FFC107" />
      </View>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* Podium */}
            <View className="flex-row items-end justify-center px-4 pt-4 pb-2">
              {top3[1] && <PodiumUser profile={top3[1]} position={2} />}
              {top3[0] && <PodiumUser profile={top3[0]} position={1} />}
              {top3[2] && <PodiumUser profile={top3[2]} position={3} />}
            </View>

            {/* Divider */}
            <View className="mx-4 my-4 border-t border-border" />
          </>
        }
        renderItem={({ item, index }) => (
          <LeaderboardRow
            profile={item}
            position={index + 4}
            isCurrentUser={currentUser?.id === item.id}
            onPress={() => router.push(`/user/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          currentUserPosition && currentUserPosition > 3 ? (
            <View className="mx-4 mt-4 p-4 rounded-xl bg-primary/10 border border-primary/30 flex-row items-center">
              <Ionicons name="person" size={18} color="#6C5CE7" />
              <Text className="text-sm text-primary font-semibold ml-2">
                Du bist auf Platz #{currentUserPosition}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
