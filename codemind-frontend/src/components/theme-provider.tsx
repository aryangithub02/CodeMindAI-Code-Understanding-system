"use client"

import { useEffect } from "react"
import { useSettingsStore } from "@/store/settings-store"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark", "light")

    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      root.classList.add(mq.matches ? "dark" : "light")

      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove("dark", "light")
        root.classList.add(e.matches ? "dark" : "light")
      }
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    } else {
      root.classList.add(settings.theme)
    }
  }, [settings.theme])

  return <>{children}</>
}
