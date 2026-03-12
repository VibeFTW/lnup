import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { COLORS } from "@/lib/constants";
import { formatEventDate } from "@/lib/utils";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string; username: string } | null;
}

interface EventCommentsProps {
  eventId: string;
}

export function EventComments({ eventId }: EventCommentsProps) {
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const loadComments = useCallback(async () => {
    if (eventId.startsWith("ai-") || eventId.startsWith("tm-")) return;
    const { data } = await supabase
      .from("event_comments")
      .select("*, profiles:user_id(display_name, username)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setComments(data as Comment[]);
  }, [eventId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePost = async () => {
    Keyboard.dismiss();
    if (!body.trim() || !user || isPosting) return;
    if (eventId.startsWith("ai-") || eventId.startsWith("tm-")) {
      useToastStore.getState().showToast("Kommentare erst nach Speicherung möglich.", "info");
      return;
    }

    setIsPosting(true);
    try {
      const { data, error } = await supabase
        .from("event_comments")
        .insert({ event_id: eventId, user_id: user.id, body: body.trim() })
        .select("*, profiles:user_id(display_name, username)")
        .single();

      if (error) throw error;
      if (data) setComments((prev) => [...prev, data as Comment]);
      setBody("");
    } catch (e: any) {
      useToastStore.getState().showToast(
        e?.message ?? "Kommentar konnte nicht gepostet werden.",
        "error"
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from("event_comments").delete().eq("id", commentId);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  if (eventId.startsWith("ai-") || eventId.startsWith("tm-")) return null;

  return (
    <View className="mt-4">
      <Text className="text-sm font-semibold text-text-primary mb-3">
        Kommentare ({comments.length})
      </Text>

      {comments.length === 0 && (
        <Text className="text-xs text-text-muted mb-3">
          Noch keine Kommentare. Sei der Erste!
        </Text>
      )}

      {comments.map((comment) => (
        <View key={comment.id} className="flex-row gap-2 mb-3">
          <View className="flex-1 bg-card rounded-xl p-3 border border-border">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-semibold text-text-primary">
                {comment.profiles?.display_name ?? "Unbekannt"}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-text-muted">
                  {new Date(comment.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
                {user?.id === comment.user_id && (
                  <TouchableOpacity onPress={() => handleDelete(comment.id)}>
                    <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text className="text-sm text-text-secondary">{comment.body}</Text>
          </View>
        </View>
      ))}

      {user && (
        <View className="flex-row items-center gap-2 mt-1">
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Kommentar schreiben..."
            placeholderTextColor={COLORS.textMuted}
            maxLength={500}
            multiline
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm"
          />
          <TouchableOpacity
            onPress={handlePost}
            disabled={!body.trim() || isPosting}
            className={`rounded-xl p-3 ${body.trim() && !isPosting ? "bg-primary" : "bg-primary/30"}`}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
