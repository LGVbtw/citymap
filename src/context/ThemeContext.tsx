import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_PREF_KEY = 'placelist_theme_pref';

export type ThemeMode = 'light' | 'dark' | 'system';

export const DARK_C = {
  bg: '#0C0C14',
  card: '#13131E',
  border: 'rgba(255,255,255,0.07)',
  primary: '#4F8EF7',
  accent: '#22D3A8',
  text: '#FFFFFF',
  textMuted: '#6B7489',
  muted: 'rgba(255,255,255,0.05)',
  destructive: '#F75F5F',
};

export const LIGHT_C = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  border: 'rgba(0,0,0,0.07)',
  primary: '#4F8EF7',
  accent: '#22D3A8',
  text: '#000000',
  textMuted: '#6B7489',
  muted: 'rgba(0,0,0,0.05)',
  destructive: '#F75F5F',
};

type ThemeColors = typeof DARK_C;

interface ThemeContextType {
  themeMode: ThemeMode;
  isLightTheme: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  C: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  isLightTheme: false,
  setThemeMode: () => {},
  C: DARK_C,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_PREF_KEY, mode).catch(e =>
      console.error('Failed to save theme preference', e)
    );
  };

  const isLightTheme = themeMode === 'system' ? systemScheme !== 'dark' : themeMode === 'light';

  const C = isLightTheme ? LIGHT_C : DARK_C;

  const value = useMemo(
    () => ({ themeMode, isLightTheme, setThemeMode, C }),
    [themeMode, isLightTheme, C],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
