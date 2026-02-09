import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'marioGameCompletedLevels';
const TOTAL_LEVELS = 17;

interface LevelCompletionContextType {
  completedLevels: number[];
  markLevelComplete: (level: number) => void;
  isLevelComplete: (level: number) => boolean;
  completedCount: number;
  totalLevels: number;
}

const LevelCompletionContext = createContext<LevelCompletionContextType | undefined>(undefined);

interface LevelCompletionProviderProps {
  children: ReactNode;
}

export function LevelCompletionProvider({ children }: LevelCompletionProviderProps) {
  const [completedLevels, setCompletedLevels] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= TOTAL_LEVELS);
        }
      }
    } catch (e) {
      console.error('Failed to load completed levels from localStorage:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedLevels));
    } catch (e) {
      console.error('Failed to save completed levels to localStorage:', e);
    }
  }, [completedLevels]);

  const markLevelComplete = useCallback((level: number) => {
    if (level < 1 || level > TOTAL_LEVELS) return;
    setCompletedLevels((prev) => {
      if (prev.includes(level)) return prev;
      return [...prev, level].sort((a, b) => a - b);
    });
  }, []);

  const isLevelComplete = useCallback((level: number) => {
    return completedLevels.includes(level);
  }, [completedLevels]);

  const value: LevelCompletionContextType = {
    completedLevels,
    markLevelComplete,
    isLevelComplete,
    completedCount: completedLevels.length,
    totalLevels: TOTAL_LEVELS,
  };

  return (
    <LevelCompletionContext.Provider value={value}>
      {children}
    </LevelCompletionContext.Provider>
  );
}

export function useLevelCompletion(): LevelCompletionContextType {
  const context = useContext(LevelCompletionContext);
  if (context === undefined) {
    throw new Error('useLevelCompletion must be used within a LevelCompletionProvider');
  }
  return context;
}
