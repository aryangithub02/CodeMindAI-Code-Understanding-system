"use client"

import { useState, useEffect } from "react"
import { Search, Bell, Sun, Moon, Monitor, ChevronDown, User, Database } from "lucide-react"
import { useSettingsStore } from "@/store/settings-store"
import { useRepositoryStore } from "@/store/repository-store"
import { useQuery } from "@tanstack/react-query"
import { repositoryService } from "@/services/api"
import { Input } from "@/components/ui/input"

export function Navbar() {
  const { settings, updateSettings } = useSettingsStore()
  const { currentRepository, setCurrentRepository, setRepositories } = useRepositoryStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: repositories = [] } = useQuery({
    queryKey: ["repositories"],
    queryFn: repositoryService.getAll,
  })

  // Keep repository store in sync
  useEffect(() => {
    if (repositories.length > 0) {
      setRepositories(repositories)
      if (!currentRepository) {
        setCurrentRepository(repositories[0])
      }
    }
  }, [repositories, currentRepository, setRepositories, setCurrentRepository])

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {/* Repository Selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-slate-100 transition-all text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label="Select active repository"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="max-w-[150px] truncate">{currentRepository?.name || "No Repository Selected"}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 mt-1.5 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-2xl z-50 p-1 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold px-2.5 pb-1.5 uppercase tracking-wider">Switch Repository</p>
                <div role="listbox" aria-label="Available repositories">
                  {repositories.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => {
                        setCurrentRepository(repo)
                        setDropdownOpen(false)
                      }}
                      role="option"
                      aria-selected={currentRepository?.id === repo.id}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs rounded-md transition-all ${
                        currentRepository?.id === repo.id
                          ? "bg-blue-600 text-white font-medium"
                          : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <Database className={`w-3.5 h-3.5 ${currentRepository?.id === repo.id ? "text-white" : "text-slate-500"}`} />
                      <span className="truncate flex-1">{repo.name}</span>
                      <span className="text-[10px] opacity-75 uppercase">{repo.language}</span>
                    </button>
                  ))}
                  {repositories.length === 0 && (
                    <p className="text-xs text-slate-500 px-2.5 py-2">No repositories analyzed yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, classes..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const themes: Array<"dark" | "light" | "system"> = ["dark", "light", "system"]
            const currentIndex = themes.indexOf(settings.theme)
            const nextTheme = themes[(currentIndex + 1) % themes.length]
            updateSettings({ theme: nextTheme })
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
          aria-label={`Current theme: ${settings.theme}. Click to switch.`}
          title={`Theme: ${settings.theme}`}
        >
          {settings.theme === "dark" ? <Moon className="w-4 h-4" /> : settings.theme === "light" ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        </button>

        <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
      </div>
    </header>
  )
}
