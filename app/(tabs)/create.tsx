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
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { COLORS } from "@/lib/constants";
import { generateInviteCode } from "@/lib/inviteCode";
import type { EventCategory } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [timeStart, setTimeStart] = useState<Date | null>(null);
  const [timeEnd, setTimeEnd] = useState<Date | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [priceInfo, setPriceInfo] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [flyerUri, setFlyerUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false);
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false);

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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung benötigt", "Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setFlyerUri(result.assets[0].uri);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthGuard, setShowAuthGuard] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) setShowAuthGuard(true);
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title || !description || !venueName || !eventDate || !timeStart || !category) {
      Alert.alert("Fehlende Angaben", "Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    if (!user) {
      Alert.alert("Nicht angemeldet", "Bitte melde dich an, um Events zu erstellen.");
      return;
    }

    setIsSubmitting(true);

    try {
      let venueId: string | null = null;

      const { data: existingVenue } = await supabase
        .from("venues")
        .select("id")
        .ilike("name", `%${venueName.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (existingVenue) {
        venueId = existingVenue.id;
      } else {
        const { data: newVenue, error: venueError } = await supabase
          .from("venues")
          .insert({
            name: venueName.trim(),
            address: address.trim() || venueName.trim(),
            city: venueCity.trim(),
            lat: 0,
            lng: 0,
          })
          .select("id")
          .single();

        if (venueError) throw venueError;
        venueId = newVenue.id;
      }

      let imageUrl: string | null = null;
      if (flyerUri) {
        const fileName = `covers/${Date.now()}.jpg`;
        const response = await fetch(flyerUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from("event-photos")
          .upload(fileName, blob, { contentType: "image/jpeg" });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("event-photos")
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const sourceType = user.role === "verified_organizer"
        ? "verified_organizer"
        : user.role === "verified_user"
          ? "verified_user"
          : "community";

      const { error: eventError } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim(),
        venue_id: venueId,
        event_date: format(eventDate, "yyyy-MM-dd"),
        time_start: format(timeStart, "HH:mm"),
        time_end: timeEnd ? format(timeEnd, "HH:mm") : null,
        category,
        price_info: priceInfo.trim() || null,
        source_type: sourceType,
        created_by: user.id,
        image_url: imageUrl,
        is_private: isPrivate,
        invite_code: isPrivate ? inviteCode : null,
        max_attendees: isPrivate && maxAttendees ? parseInt(maxAttendees, 10) : null,
      });

      if (eventError) throw eventError;

      useToastStore.getState().showToast("Event erfolgreich erstellt!", "success");
      setTitle("");
      setDescription("");
      setVenueName("");
      setAddress("");
      setVenueCity("");
      setEventDate(null);
      setTimeStart(null);
      setTimeEnd(null);
      setCategory(null);
      setPriceInfo("");
      setFlyerUri(null);
      setIsPrivate(false);
      setInviteCode("");
      setMaxAttendees("");
    } catch (error: any) {
      Alert.alert("Fehler", error?.message ?? "Event konnte nicht erstellt werden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-3">
          <Text className="text-2xl font-bold text-text-primary">
            Event erstellen
          </Text>
          <Text className="text-sm text-text-secondary mt-1">
            Teile ein Event mit deiner Community
          </Text>
        </View>

        <View className="px-4 gap-4 pb-8">
          {/* Flyer / Cover Image */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Flyer / Cover (optional)
            </Text>
            {flyerUri ? (
              <TouchableOpacity onPress={pickImage} className="rounded-xl overflow-hidden">
                <Image
                  source={{ uri: flyerUri }}
                  style={{ width: "100%", height: 180 }}
                  contentFit="cover"
                />
                <View className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5">
                  <Ionicons name="pencil" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                className="bg-card border border-border border-dashed rounded-xl h-32 items-center justify-center"
              >
                <Ionicons name="image-outline" size={32} color="#6B6B80" />
                <Text className="text-sm text-text-muted mt-2">
                  Bild hochladen
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Titel *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="z.B. 90s Techno Night"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          {/* Description */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Beschreibung *
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Was erwartet die Besucher?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base min-h-[100px]"
            />
          </View>

          {/* Venue */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Location *
            </Text>
            <TextInput
              value={venueName}
              onChangeText={setVenueName}
              placeholder="Name der Location"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-2"
            />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Adresse"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-2"
            />
            <TextInput
              value={venueCity}
              onChangeText={setVenueCity}
              placeholder="Stadt (z.B. Deggendorf)"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          {/* Date & Time — Native Pickers */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">
                Datum *
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className={eventDate ? "text-text-primary text-base" : "text-text-muted text-base"}>
                  {eventDate
                    ? format(eventDate, "dd.MM.yyyy", { locale: de })
                    : "Wählen"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">
                Von *
              </Text>
              <TouchableOpacity
                onPress={() => setShowTimeStartPicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className={timeStart ? "text-text-primary text-base" : "text-text-muted text-base"}>
                  {timeStart ? format(timeStart, "HH:mm") : "HH:MM"}
                </Text>
                <Ionicons name="time-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">
                Bis
              </Text>
              <TouchableOpacity
                onPress={() => setShowTimeEndPicker(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className={timeEnd ? "text-text-primary text-base" : "text-text-muted text-base"}>
                  {timeEnd ? format(timeEnd, "HH:mm") : "HH:MM"}
                </Text>
                <Ionicons name="time-outline" size={18} color="#6B6B80" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Native Picker Modals */}
          {showDatePicker && (
            <DateTimePicker
              value={eventDate ?? new Date()}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          {showTimeStartPicker && (
            <DateTimePicker
              value={timeStart ?? new Date()}
              mode="time"
              display="default"
              is24Hour
              onChange={handleTimeStartChange}
            />
          )}
          {showTimeEndPicker && (
            <DateTimePicker
              value={timeEnd ?? new Date()}
              mode="time"
              display="default"
              is24Hour
              onChange={handleTimeEndChange}
            />
          )}

          {/* Category */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-2">
              Kategorie *
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {EVENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
                    category === cat.id
                      ? "bg-primary"
                      : "bg-card border border-border"
                  }`}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={category === cat.id ? "#FFFFFF" : "#A0A0B8"}
                  />
                  <Text
                    className={`text-sm ${
                      category === cat.id
                        ? "text-white font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price */}
          <View>
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Eintritt
            </Text>
            <TextInput
              value={priceInfo}
              onChangeText={setPriceInfo}
              placeholder="z.B. Kostenlos, 5€, Ab 10€"
              placeholderTextColor={COLORS.textMuted}
              className="bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-base"
            />
          </View>

          {/* Private Event Toggle */}
          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <Ionicons name="lock-closed-outline" size={20} color="#6C5CE7" />
                <View>
                  <Text className="text-sm font-medium text-text-primary">Privates Event</Text>
                  <Text className="text-xs text-text-muted">Nur mit Einladungscode sichtbar</Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={(v) => {
                  setIsPrivate(v);
                  if (v && !inviteCode) setInviteCode(generateInviteCode());
                }}
                trackColor={{ false: "#2A2A3E", true: "#6C5CE7" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {isPrivate && (
              <View className="mt-4 gap-3">
                <View className="bg-background rounded-xl p-3 items-center border border-border">
                  <Text className="text-xs text-text-muted mb-1">Einladungscode</Text>
                  <Text className="text-2xl font-black text-primary tracking-widest">{inviteCode}</Text>
                </View>
                <View>
                  <Text className="text-xs text-text-muted mb-1">Max. Teilnehmer (optional)</Text>
                  <TextInput
                    value={maxAttendees}
                    onChangeText={(t) => setMaxAttendees(t.replace(/[^0-9]/g, ""))}
                    placeholder="Unbegrenzt"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    className="bg-background border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`rounded-xl py-4 items-center mt-2 ${isSubmitting ? "bg-primary/50" : "bg-primary"}`}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? "Wird veröffentlicht..." : "Event veröffentlichen"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AuthGuard
        visible={showAuthGuard}
        onClose={() => setShowAuthGuard(false)}
        message="Melde dich an, um Events zu erstellen und mit deiner Community zu teilen."
      />
    </KeyboardAvoidingView>
  );
}
