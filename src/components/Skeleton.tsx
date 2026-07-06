import { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

// Placeholder animé (pulsation) affiché pendant le chargement
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const { C } = useAppTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: C.muted, borderRadius: 8, opacity }, style]} />;
}
