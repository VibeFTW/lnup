import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { COLORS } from "@/lib/constants";

interface Update {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author_id: string;
  profiles: { display_name: string; username: string } | null;
}

interface EventUpdatesProps {
  eventId: string;
  isHost: boolean;
  isAdmin: boolean;
}

export function EventUpdates({ eventId, isHost, isAdmin }: EventUpdatesProps) {
  const user = useAuthStore((s) => s.user);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const canPost = isHost || isAdmin;

  const loadUpdates = useCallback(async () => {
    if (eventId.startsWith("ai-") || eventId.startsWith("tm-")) return;
    const { data } = await supabase
      .from("event_updates")
      .select("*, profiles:author_id(display_name, username)")
      .eq("event_id", eventId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setUpdates(data as Update[]);
  }, [eventId]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const handlePost = async () => {
    Keyboard.dismiss();
    if (!body.trim() || !user || isPosting || !canPost) return;

    setIsPosting(true);
    try {
      const { data, error } = await supabase
        .from("event_updates")
        .insert({ event_id: eventId, author_id: user.id, body: body.trim() })
        .select("*, profiles:author_id(display_name, username)")
        .single();

      if (error) throw error;
      if (data) setUpdates((prev) => [data as Update, ...prev]);
      setBody("");
      useToastStore.getState().showToast("Update gepostet.", "success");
    } catch (e: any) {
      useToastStore.getState().showToast(
        e?.message ?? "Update konnte nicht gepostet werden.",
        "error"
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (updateId: string) => {
    const { error } = await supabase.from("event_updates").delete().eq("id", updateId);
    if (!error) {
      setUpdates((prev) => prev.filter((u) => u.id !== updateId));
    }
  };

  const handleTogglePin = async (updateId: string, currentlyPinned: boolean) => {
    const { error } = await supabase
      .from("event_updates")
      .update({ is_pinned: !currentlyPinned })
      .eq("id", updateId);
    if (!error) {
      setUpdates((prev) =>
        prev
          .map((u) => (u.id === updateId ? { ...u, is_pinned: !currentlyPinned } : u))
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
      );
    }
  };

  if (eventId.startsWith("ai-") || eventId.startsWith("tm-")) return null;
  if (updates.length === 0 && !canPost) return null;

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name="megaphone" size={16} color="#FF6B9D" />
        <Text className="text-sm font-semibold text-text-primary">
          Updates{updates.length > 0 ? ` (${updates.length})` : ""}
        </Text>
      </View>

      {updates.map((update) => (
        <View
          key={update.id}
          className={`mb-3 rounded-xl p-3 border ${
            update.is_pinned
              ? "bg-accent/5 border-accent/30"
              : "bg-card border-border"
          }`}
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center gap-1.5">
              {update.is_pinned && (
                <Ionicons name="pin" size={12} color="#FF6B9D" />
              )}
              <Text className="text-xs font-semibold text-text-primary">
                {update.profiles?.display_name ?? "Unbekannt"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-text-muted">
                {new Date(update.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {canPost && user?.id === update.author_id && (
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity onPress={() => handleTogglePin(update.id, update.is_pinned)}>
                    <Ionicons
                      name={update.is_pinned ? "pin" : "pin-outline"}
                      size={14}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(update.id)}>
                    <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <Text className="text-sm text-text-secondary leading-5">{update.body}</Text>
        </View>
      ))}

      {canPost && user && (
        <View className="flex-row items-center gap-2 mt-1">
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Update schreiben..."
            placeholderTextColor={COLORS.textMuted}
            maxLength={1000}
            multiline
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm"
          />
          <TouchableOpacity
            onPress={handlePost}
            disabled={!body.trim() || isPosting}
            className={`rounded-xl p-3 ${body.trim() && !isPosting ? "bg-accent" : "bg-accent/30"}`}
          >
            <Ionicons name="megaphone" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
