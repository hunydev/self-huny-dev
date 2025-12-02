import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Settings {
  gridColumns: 2 | 3 | 4 | 5 | 6;
  dateFormat: 'relative' | 'absolute' | 'both';
  groupBy: 'day' | 'week' | 'month';
  showItemCount: boolean;
  compactMode: boolean;
  submitShortcut: 'enter' | 'ctrl+enter';
}

const defaultSettings: Settings = {
  gridColumns: 4,
  dateFormat: 'relative',
  groupBy: 'day',
  showItemCount: true,
  compactMode: false,
  submitShortcut: 'ctrl+enter',
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'self-settings';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
