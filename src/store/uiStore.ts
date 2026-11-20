import { create } from 'zustand';
import type { Preferences } from '../lib/storage/db';
import { DEFAULT_PREFERENCES } from '../lib/storage/db';

interface UiState {
  preferences: Preferences;
  preferencesLoaded: boolean;
  setPreferences(p: Preferences): void;
  setTheme(theme: 'dark' | 'light'): void;
}

export const useUiStore = create<UiState>((set) => ({
  preferences: DEFAULT_PREFERENCES,
  preferencesLoaded: false,
  setPreferences: (preferences) => set({ preferences, preferencesLoaded: true }),
  setTheme: (theme) => set((s) => ({ preferences: { ...s.preferences, theme } })),
}));
