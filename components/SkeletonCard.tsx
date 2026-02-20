import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

function PulseBlock({ className }: { className?: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View className={className} style={[{ backgroundColor: "#2A2A3E" }, animatedStyle]} />;
}

function SingleSkeleton() {
  return (
    <View className="mx-4 mb-3 rounded-2xl bg-card border border-border overflow-hidden">
      {/* Cover area */}
      <PulseBlock className="h-[140px] w-full" />

      <View className="p-4">
        {/* Trust badge */}
        <PulseBlock className="h-5 w-24 rounded-full mb-3" />

        {/* Title */}
        <PulseBlock className="h-5 w-3/4 rounded-md mb-2" />

        {/* Description lines */}
        <PulseBlock className="h-3.5 w-full rounded-md mb-1.5" />
        <PulseBlock className="h-3.5 w-2/3 rounded-md mb-4" />

        {/* Detail row */}
        <View className="flex-row gap-3 mb-4">
          <PulseBlock className="h-3.5 w-20 rounded-md" />
          <PulseBlock className="h-3.5 w-16 rounded-md" />
          <PulseBlock className="h-3.5 w-14 rounded-md" />
        </View>

        {/* Footer */}
        <View className="border-t border-border pt-3 flex-row justify-between">
          <View className="flex-row gap-3">
            <PulseBlock className="h-4 w-10 rounded-md" />
            <PulseBlock className="h-4 w-10 rounded-md" />
          </View>
          <PulseBlock className="h-7 w-20 rounded-full" />
        </View>
      </View>
    </View>
  );
}

interface SkeletonCardProps {
  count?: number;
}

export function SkeletonCard({ count = 3 }: SkeletonCardProps) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </View>
  );
}
