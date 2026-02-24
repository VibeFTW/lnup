import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore } from "@/stores/toastStore";
import { useEventStore } from "@/stores/eventStore";
import { supabase } from "@/lib/supabase";
import type { EventMember } from "@/types";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { COLORS } from "@/lib/constants";
import type { EventCategory } from "@/types";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const event = useEventStore((s) => s.getEventById(id));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceInfo, setPriceInfo] = useState("");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [timeStart, setTimeStart] = useState<Date | null>(null);
  const [timeEnd, setTimeEnd] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [maxAttendees, setMaxAttendees] = useState("");
  const [members, setMembers] = useState<EventMember[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false);
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false);

  const getEventMembers = useEventStore((s) => s.getEventMembers);
  const kickMember = useEventStore((s) => s.kickMember);
  const regenerateInviteCode = useEventStore((s) => s.regenerateInviteCode);

  useEffect(() => {
    if (event?.is_private && id) {
      getEventMembers(id).then(setMembers);
    }
  }, [id, event?.is_private]);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setDescription(event.description);
    setPriceInfo(event.price_info ?? "");
    setCategory(event.category);
    setMaxAttendees(event.max_attendees ? String(event.max_attendees) : "");
    try {
      setEventDate(parse(event.event_date, "yyyy-MM-dd", new Date()));
    } catch {
      setEventDate(new Date(event.event_date));
    }
    if (event.time_start && event.time_start.includes(":")) {
      const parts = event.time_start.split(":");
      const h = parseInt(parts[0] ?? "0", 10);
      const m = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m, 0);
        setTimeStart(d);
      }
    }
    if (event.time_end && event.time_end.includes(":")) {
      const parts = event.time_end.split(":");
      const h = parseInt(parts[0] ?? "0", 10);
      const m = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m, 0);
        setTimeEnd(d);
      }
    }
  }, [event]);

  if (!event) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) setEventDate(date);
  };

  const handleTimeStartChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimeStartPicker(false);
    if (date) setTimeStart(date);
  };

  const handleTimeEndChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimeEndPicker(false);
    if (date) setTimeEnd(date);
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!title || !description || !eventDate || !timeStart || !category) {
      Alert.alert("Fehlende Angaben", "Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        event_date: format(eventDate, "yyyy-MM-dd"),
        time_start: format(timeStart, "HH:mm"),
        time_end: timeEnd ? format(timeEnd, "HH:mm") : null,
        category,
        price_info: priceInfo.trim() || null,
      };
      if (event.is_private) {
        updateData.max_attendees = maxAttendees ? parseInt(maxAttendees, 10) : null;
      }

      const { error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      useToastStore.getState().showToast("Event aktualisiert!", "success");
      router.back();
    } catch (error: any) {
      Alert.alert("Fehler", error?.message ?? "Event konnte nicht aktualisiert werden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Event löschen",
      "Bist du sicher? Das Event wird unwiderruflich gelöscht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { error } = await supabase
                .from("events")
                .delete()
                .eq("id", id);

              if (error) throw error;

              useToastStore.getState().showToast("Event gelöscht.", "success");
              router.replace("/(tabs)");
            } catch (error: any) {
              Alert.alert("Fehler", error?.message ?? "Event konnte nicht gelöscht werden.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary flex-1">Event bearbeiten</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 gap-4 pb-8">
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Titel *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Beschreibung *</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base min-h-[100px]"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">Datum *</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className="text-text-primary text-base">
                  {eventDate ? format(eventDate, "dd.MM.yyyy", { locale: de }) : "Wählen"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">Von *</Text>
              <TouchableOpacity
                onPress={() => setShowTimeStartPicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className="text-text-primary text-base">
                  {timeStart ? format(timeStart, "HH:mm") : "HH:MM"}
                </Text>
                <Ionicons name="time-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">Bis</Text>
              <TouchableOpacity
                onPress={() => setShowTimeEndPicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className="text-text-primary text-base">
                  {timeEnd ? format(timeEnd, "HH:mm") : "—"}
                </Text>
                <Ionicons name="time-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker value={eventDate ?? new Date()} mode="date" display="default" minimumDate={new Date()} onChange={handleDateChange} />
          )}
          {showTimeStartPicker && (
            <DateTimePicker value={timeStart ?? new Date()} mode="time" display="default" is24Hour onChange={handleTimeStartChange} />
          )}
          {showTimeEndPicker && (
            <DateTimePicker value={timeEnd ?? new Date()} mode="time" display="default" is24Hour onChange={handleTimeEndChange} />
          )}

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-2">Kategorie *</Text>
            <View className="flex-row flex-wrap gap-2">
              {EVENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
                    category === cat.id ? "bg-primary" : "bg-card border border-border"
                  }`}
                >
                  <Ionicons name={cat.icon as any} size={14} color={category === cat.id ? "#FFFFFF" : "#A0A0B8"} />
                  <Text className={`text-sm ${category === cat.id ? "text-white font-medium" : "text-text-secondary"}`}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Eintritt</Text>
            <TextInput
              value={priceInfo}
              onChangeText={setPriceInfo}
              placeholder="z.B. Kostenlos, 5€"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          {/* Private Event Controls */}
          {event.is_private && (
            <View className="bg-card border border-border rounded-xl p-4 gap-4">
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="lock-closed" size={18} color="#6C5CE7" />
                <Text className="text-sm font-semibold text-text-primary">Privat-Einstellungen</Text>
              </View>

              <View>
                <Text className="text-xs text-text-muted mb-1">Einladungscode</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5">
                    <Text className="text-lg font-black text-primary tracking-widest">
                      {event.invite_code ?? "Deaktiviert"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      const newCode = await regenerateInviteCode(id);
                      if (newCode) useToastStore.getState().showToast("Neuer Code generiert!", "success");
                    }}
                    className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2.5"
                  >
                    <Ionicons name="refresh" size={20} color="#6C5CE7" />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-xs text-text-muted mb-1">Max. Teilnehmer</Text>
                <TextInput
                  value={maxAttendees}
                  onChangeText={(t) => setMaxAttendees(t.replace(/[^0-9]/g, ""))}
                  placeholder="Unbegrenzt"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm"
                />
              </View>

              <View>
                <Text className="text-xs text-text-muted mb-2">
                  Mitglieder ({members.length})
                </Text>
                {members.length === 0 ? (
                  <Text className="text-xs text-text-muted">Noch keine Mitglieder</Text>
                ) : (
                  <View className="gap-2">
                    {members.map((member) => (
                      <View key={member.id} className="flex-row items-center justify-between bg-background border border-border rounded-xl px-3 py-2.5">
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="person-circle-outline" size={20} color="#A0A0B8" />
                          <Text className="text-sm text-text-primary">
                            {(member.user as any)?.display_name ?? (member.user as any)?.username ?? "Unbekannt"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              "Mitglied entfernen",
                              "Bist du sicher?",
                              [
                                { text: "Abbrechen", style: "cancel" },
                                {
                                  text: "Entfernen",
                                  style: "destructive",
                                  onPress: async () => {
                                    await kickMember(id, member.user_id);
                                    setMembers((prev) => prev.filter((m) => m.id !== member.id));
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#FF5252" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            className={`rounded-xl py-4 items-center mt-2 ${isSubmitting ? "bg-primary/50" : "bg-primary"}`}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? "Wird gespeichert..." : "Änderungen speichern"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            disabled={isDeleting}
            className="rounded-xl py-4 items-center flex-row justify-center gap-2 bg-danger/10 border border-danger/30"
          >
            <Ionicons name="trash-outline" size={18} color="#FF5252" />
            <Text className="text-danger font-bold text-base">
              {isDeleting ? "Wird gelöscht..." : "Event löschen"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
