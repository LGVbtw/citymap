import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_PREF_KEY = 'placelist_theme_pref';

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
  isLightTheme: boolean;
  toggleTheme: (value: boolean) => void;
  C: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isLightTheme: false,
  toggleTheme: () => {},
  C: DARK_C,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const themePref = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (themePref === 'light') {
          setIsLightTheme(true);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    })();
  }, []);

  const toggleTheme = (value: boolean) => {
    setIsLightTheme(value);
    AsyncStorage.setItem(THEME_PREF_KEY, value ? 'light' : 'dark').catch(e =>
      console.error('Failed to save theme preference', e)
    );
  };

  const C = isLightTheme ? LIGHT_C : DARK_C;

  const value = useMemo(() => ({ isLightTheme, toggleTheme, C }), [isLightTheme, C]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
