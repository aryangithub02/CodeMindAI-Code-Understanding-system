"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Settings } from "@/types"

interface SettingsState {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  resetSettings: () => void
}

const defaultSettings: Settings = {
  theme: "dark",
  apiKey: "",
  openRouterKey: "",
  repositoryDefaults: {
    maxDepth: 5,
    excludeDirs: ["node_modules", ".git", "__pycache__"],
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: "codemind-settings",
    }
  )
)
