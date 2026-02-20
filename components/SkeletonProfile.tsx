import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

function PulseBlock({ className, style }: { className?: string; style?: object }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={className}
      style={[{ backgroundColor: "#2A2A3E" }, style, animatedStyle]}
    />
  );
}

export function SkeletonProfile() {
  return (
    <View className="px-4 pt-4">
      {/* Avatar */}
      <View className="items-center mb-6">
        <PulseBlock className="rounded-full mb-3" style={{ width: 80, height: 80 }} />
        <PulseBlock className="h-5 w-32 rounded-md mb-2" />
        <PulseBlock className="h-3.5 w-20 rounded-md mb-3" />
        <PulseBlock className="h-7 w-28 rounded-full mb-4" />
        <PulseBlock className="h-8 w-16 rounded-md mb-1" />
        <PulseBlock className="h-3 w-12 rounded-md mb-4" />
        {/* Progress bar */}
        <View className="w-full px-4">
          <PulseBlock className="h-2.5 w-full rounded-full" />
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-6">
        <PulseBlock className="flex-1 h-20 rounded-xl" />
        <PulseBlock className="flex-1 h-20 rounded-xl" />
        <PulseBlock className="flex-1 h-20 rounded-xl" />
      </View>

      {/* Events section */}
      <PulseBlock className="h-4 w-28 rounded-md mb-3" />
      <PulseBlock className="h-16 w-full rounded-xl mb-2" />
      <PulseBlock className="h-16 w-full rounded-xl" />
    </View>
  );
}
