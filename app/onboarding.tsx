import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "flash" as const,
    color: "#6C5CE7",
    title: "Entdecke Events",
    subtitle:
      "Finde heraus, was heute Abend in deiner Stadt los ist — Clubs, Konzerte, Festivals, Restaurants und mehr. Alles an einem Ort.",
  },
  {
    icon: "people" as const,
    color: "#00D2FF",
    title: "Werde Teil der Community",
    subtitle:
      'Erstelle Events, sammle Punkte, steige im Rang auf. Zeig mit "Bin dabei", welche Events angesagt sind, und teile Fotos.',
  },
  {
    icon: "musical-notes" as const,
    color: "#FF6B9D",
    title: "Dein Lineup für heute Abend",
    subtitle:
      "Filtere nach Datum, Kategorie und Stadt. Speichere Events, die dich interessieren. Kein Algorithmus — du entscheidest.",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem("@lnup_onboarded", "true");
    router.replace("/(tabs)");
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          onPress={completeOnboarding}
          className="absolute right-4 z-10"
          style={{ top: insets.top + 12 }}
        >
          <Text className="text-sm text-text-muted font-medium">Überspringen</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-8">
            {/* Icon area */}
            <View
              className="w-36 h-36 rounded-full items-center justify-center mb-10"
              style={{ backgroundColor: item.color + "20" }}
            >
              <Ionicons name={item.icon} size={64} color={item.color} />
            </View>

            <Text className="text-3xl font-black text-text-primary text-center mb-4">
              {item.title}
            </Text>
            <Text className="text-base text-text-secondary text-center leading-6">
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* Bottom: dots + button */}
      <View className="px-8 pb-8" style={{ paddingBottom: insets.bottom + 32 }}>
        {/* Dot indicators */}
        <View className="flex-row items-center justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: currentIndex === i ? 24 : 8,
                height: 8,
                backgroundColor: currentIndex === i ? "#6C5CE7" : "#2A2A3E",
              }}
            />
          ))}
        </View>

        {/* Action button */}
        <TouchableOpacity
          onPress={handleNext}
          className="bg-primary rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-bold text-base">
            {isLast ? "Los geht's" : "Weiter"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
