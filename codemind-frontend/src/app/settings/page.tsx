"use client"

import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSettingsStore } from "@/store/settings-store"
import { Key, Palette, FolderGit2, User, RefreshCw, Eye, EyeOff } from "lucide-react"
import { useState } from "react"

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [showRouterKey, setShowRouterKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your preferences and API keys</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" /> API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                id="api-key"
                label="CodeMind API Key"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                placeholder="Enter your API key..."
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                id="openrouter-key"
                label="OpenRouter API Key"
                type={showRouterKey ? "text" : "password"}
                value={settings.openRouterKey}
                onChange={(e) => updateSettings({ openRouterKey: e.target.value })}
                placeholder="Enter your OpenRouter key..."
              />
              <button
                onClick={() => setShowRouterKey(!showRouterKey)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-200"
              >
                {showRouterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" /> Theme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-100">Color Scheme</p>
                <p className="text-xs text-slate-400">Choose your preferred theme</p>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-slate-800 border border-slate-700" role="radiogroup" aria-label="Theme selection">
                {[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateSettings({ theme: value as "dark" | "light" | "system" })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      settings.theme === value
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    role="radio"
                    aria-checked={settings.theme === value}
                    aria-label={`${label} theme`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-emerald-400" /> Repository Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              id="max-depth"
              label="Maximum Analysis Depth"
              type="number"
              value={settings.repositoryDefaults.maxDepth}
              onChange={(e) =>
                updateSettings({
                  repositoryDefaults: {
                    ...settings.repositoryDefaults,
                    maxDepth: parseInt(e.target.value) || 5,
                  },
                })
              }
            />
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Excluded Directories</label>
              <div className="flex flex-wrap gap-2">
                {settings.repositoryDefaults.excludeDirs.map((dir) => (
                  <Badge key={dir} variant="default">
                    {dir}
                    <button
                      onClick={() =>
                        updateSettings({
                          repositoryDefaults: {
                            ...settings.repositoryDefaults,
                            excludeDirs: settings.repositoryDefaults.excludeDirs.filter((d) => d !== dir),
                          },
                        })
                      }
                      className="ml-1.5 text-slate-500 hover:text-slate-300"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                <input
                  placeholder="Add directory..."
                  className="px-2 py-0.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 placeholder:text-slate-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value) {
                      updateSettings({
                        repositoryDefaults: {
                          ...settings.repositoryDefaults,
                          excludeDirs: [...settings.repositoryDefaults.excludeDirs, e.currentTarget.value],
                        },
                      })
                      e.currentTarget.value = ""
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => updateSettings({ apiKey: "", openRouterKey: "" })}>
            <RefreshCw className="w-4 h-4 mr-1" /> Reset
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
