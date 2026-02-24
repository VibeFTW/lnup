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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false);
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setDescription(event.description);
    setPriceInfo(event.price_info ?? "");
    setCategory(event.category);
    try {
      setEventDate(parse(event.event_date, "yyyy-MM-dd", new Date()));
    } catch {
      setEventDate(new Date(event.event_date));
    }
    if (event.time_start) {
      const [h, m] = event.time_start.split(":");
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m), 0);
      setTimeStart(d);
    }
    if (event.time_end) {
      const [h, m] = event.time_end.split(":");
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m), 0);
      setTimeEnd(d);
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
      const { error } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          description: description.trim(),
          event_date: format(eventDate, "yyyy-MM-dd"),
          time_start: format(timeStart, "HH:mm"),
          time_end: timeEnd ? format(timeEnd, "HH:mm") : null,
          category,
          price_info: priceInfo.trim() || null,
        })
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
