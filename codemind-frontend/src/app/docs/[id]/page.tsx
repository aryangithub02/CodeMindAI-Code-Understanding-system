"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { BuildFromScratch } from "@/components/build-from-scratch"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { repositoryService } from "@/services/api"
import { useRepositoryStore } from "@/store/repository-store"
import { useSettingsStore } from "@/store/settings-store"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import mermaid from "mermaid"
import Fuse from "fuse.js"
import {
  BookOpen,
  Cpu,
  Globe,
  FileText,
  Database,
  Share2,
  Activity,
  Wrench,
  Rocket,
  Building2,
  Bot,
  Search,
  Download,
  FileDown,
  FileJson,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertCircle,
  Check,
  Copy,
  RefreshCw,
  Columns2,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react"

mermaid.initialize({
  theme: "dark",
  themeVariables: {
    primaryColor: "#1e3a5f",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#3b82f6",
    lineColor: "#64748b",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
  },
  securityLevel: "loose",
})

const DOC_SECTIONS = [
  { id: "overview", label: "Repository Overview", description: "Project summary, tech stack, statistics", icon: "BookOpen", category: "Overview", complexity: "Low" as const },
  { id: "architecture", label: "Architecture Docs", description: "Patterns, layers, modules, diagrams", icon: "Cpu", category: "Architecture", complexity: "High" as const },
  { id: "api", label: "API Documentation", description: "Endpoints, schemas, auth, errors", icon: "Globe", category: "API", complexity: "Medium" as const },
  { id: "services", label: "Service Documentation", description: "Core services and their responsibilities", icon: "FileText", category: "Services", complexity: "Medium" as const },
  { id: "database", label: "Database Docs", description: "Tables, relationships, indexes, queries", icon: "Database", category: "Database", complexity: "Medium" as const },
  { id: "dependencies", label: "Dependency Docs", description: "Module graph, hotspots, circular deps", icon: "Share2", category: "Dependencies", complexity: "High" as const },
  { id: "dataflow", label: "Data Flow Docs", description: "Request lifecycle, sequence diagrams", icon: "Activity", category: "Flows", complexity: "High" as const },
  { id: "setup", label: "Setup Documentation", description: "Installation, configuration, prerequisites", icon: "Wrench", category: "Deployment", complexity: "Low" as const },
  { id: "deployment", label: "Deployment Docs", description: "Docker, CI/CD, production guide", icon: "Rocket", category: "Deployment", complexity: "Medium" as const },
  { id: "ai_guide", label: "AI Repository Guide", description: "AI analysis, recommendations, onboarding", icon: "Bot", category: "AI", complexity: "Low" as const },
  { id: "build_from_scratch", label: "Build From Scratch", description: "Complete implementation roadmap", icon: "Building2", category: "Build", complexity: "High" as const },
]

const ICON_MAP: Record<string, typeof BookOpen> = {
  BookOpen, Cpu, Globe, FileText, Database, Share2, Activity, Wrench, Rocket, Bot, Building2,
}

const CATEGORIES = Array.from(new Set(DOC_SECTIONS.map((s) => s.category)))

const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "bg-green-500/10 text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
}

function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef(0)

  useEffect(() => {
    if (!ref.current || !chart.trim()) return
    const currentKey = ++keyRef.current
    setError(null)
    const container = ref.current
    container.innerHTML = ""
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    const wrapper = document.createElement("div")
    wrapper.id = id
    container.appendChild(wrapper)

    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (currentKey !== keyRef.current) return
        if (!wrapper.parentNode) return
        wrapper.innerHTML = svg
      })
      .catch((e) => {
        if (currentKey !== keyRef.current) return
        setError(e.message)
      })

    return () => {
      keyRef.current++
    }
  }, [chart])

  if (error) return <pre className="text-red-400 text-xs p-2 bg-red-500/5 rounded">{error}</pre>
  return (
    <div className="my-4 flex justify-center overflow-x-auto">
      <div ref={ref} className="max-w-full [&_svg]:max-w-full [&_.label]:text-slate-200">
      </div>
    </div>
  )
}

function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null

  const [showCopy, setShowCopy] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <div className="relative">
      <button
        onClick={handleCopyAll}
        onMouseEnter={() => setShowCopy(true)}
        onMouseLeave={() => setShowCopy(false)}
        className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all z-10 ${
          showCopy || copied
            ? "opacity-100 bg-slate-800 hover:bg-slate-700 text-slate-300"
            : "opacity-0"
        }`}
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
      <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-a:text-blue-400 prose-strong:text-slate-200 prose-code:text-blue-300 prose-code:bg-slate-800/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-transparent prose-pre:p-0 prose-li:text-slate-300 prose-hr:border-slate-700 prose-blockquote:border-blue-500/30 prose-blockquote:text-slate-400">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const codeStr = String(children).replace(/\n$/, "")
              if (match) {
                if (match[1] === "mermaid") {
                  return <MermaidBlock chart={codeStr} />
                }
                return (
                  <div className="relative group my-3">
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(codeStr)
                        }}
                        className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ margin: 0, borderRadius: "0.5rem", fontSize: "0.8125rem" }}
                    >
                      {codeStr}
                    </SyntaxHighlighter>
                  </div>
                )
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-4 border border-slate-700 rounded-lg">
                  <table className="min-w-full divide-y divide-slate-700 text-sm">{children}</table>
                </div>
              )
            },
            thead({ children }) {
              return <thead className="bg-slate-800/50">{children}</thead>
            },
            th({ children }) {
              return (
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {children}
                </th>
              )
            },
            td({ children }) {
              return <td className="px-4 py-2.5 text-slate-300 border-t border-slate-800">{children}</td>
            },
            h1({ children }) {
              return <h1 className="text-2xl font-bold text-slate-100 mt-8 mb-4 pb-2 border-b border-slate-700">{children}</h1>
            },
            h2({ children }) {
              return <h2 className="text-xl font-semibold text-slate-100 mt-6 mb-3">{children}</h2>
            },
            h3({ children }) {
              return <h3 className="text-lg font-medium text-slate-200 mt-5 mb-2">{children}</h3>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function AIPanel({
  content,
  isLoading,
}: {
  content: { summary: string; architecture: string; onboarding: string }
  isLoading: boolean
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "architecture" | "onboarding">("summary")

  const tabs = [
    { id: "summary" as const, label: "Summary", content: content.summary },
    { id: "architecture" as const, label: "Architecture", content: content.architecture },
    { id: "onboarding" as const, label: "Onboarding", content: content.onboarding },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold text-slate-200">AI Assistant</span>
      </div>
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : tabs.find((t) => t.id === activeTab)?.content ? (
          <MarkdownRenderer content={tabs.find((t) => t.id === activeTab)!.content} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">Configure OpenRouter key in Settings for AI-powered analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ExportMenu({
  onExport,
  isExporting,
}: {
  onExport: (format: string) => void
  isExporting: boolean
}) {
  const [open, setOpen] = useState(false)

  const formats = [
    { id: "pdf", label: "PDF Document", icon: FileDown, desc: "Full documentation" },
    { id: "markdown", label: "Markdown", icon: FileText, desc: "Repository handbook" },
    { id: "html", label: "HTML", icon: Globe, desc: "Shareable site" },
    { id: "json", label: "JSON", icon: FileJson, desc: "Machine-readable" },
    { id: "mermaid", label: "Mermaid", icon: Share2, desc: "Diagrams only" },
  ]

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-1" />
        )}
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-2">
            {formats.map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    onExport(f.id)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <div className="text-left">
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs text-slate-500">{f.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-2xl" />
        <BookOpen className="relative h-16 w-16 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">No Documentation Available</h3>
      <p className="text-sm text-slate-500 max-w-md">
        Upload a repository to automatically generate comprehensive documentation including
        architecture, API, services, database schema, and more.
      </p>
    </div>
  )
}

export default function DocsPage() {
  const params = useParams()
  const router = useRouter()
  const { currentRepository, setCurrentRepository } = useRepositoryStore()
  const settings = useSettingsStore((s) => s.settings)
  const [activeSection, setActiveSection] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const initialSyncDone = useRef(false)

  const repoId = params.id as string

  // On mount, sync the store's currentRepository to match the URL param
  useEffect(() => {
    const urlId = params.id as string
    if (urlId && currentRepository?.id !== urlId) {
      const state = useRepositoryStore.getState()
      const found = state.repositories.find(r => r.id === urlId)
      if (found) setCurrentRepository(found)
    }
    initialSyncDone.current = true
  }, [])

  // After initial sync, when user selects a different repo from navbar,
  // navigate to the new repo's docs URL
  useEffect(() => {
    if (initialSyncDone.current && currentRepository?.id && repoId !== currentRepository.id) {
      router.replace(`/docs/${currentRepository.id}`)
    }
  }, [currentRepository?.id])

  const { data: docs, isLoading } = useQuery({
    queryKey: ["docs", repoId],
    queryFn: () => repositoryService.getDocumentation(repoId as string),
    enabled: !!repoId,
  })

  const { data: aiContent, isLoading: aiLoading } = useQuery({
    queryKey: ["docs-ai", repoId],
    queryFn: () => repositoryService.getAIDocumentation(repoId as string),
    enabled: !!repoId && !!settings.openRouterKey,
    retry: false,
  })

  const { data: buildPlan, isLoading: buildPlanLoading } = useQuery({
    queryKey: ["build-plan", repoId],
    queryFn: () => repositoryService.getBuildFromScratch(repoId as string),
    enabled: !!repoId,
    retry: false,
  })

  const fuse = useMemo(() => {
    if (!docs) return null
    const items = DOC_SECTIONS.map((section) => ({
      ...section,
      content: (docs as unknown as Record<string, string>)[section.id] || "",
    }))
    return new Fuse(items, {
      keys: ["label", "description", "category", "content"],
      threshold: 0.4,
      includeScore: true,
    })
  }, [docs])

  const filteredSections = useMemo(() => {
    let sections = DOC_SECTIONS
    if (activeCategory) {
      sections = sections.filter((s) => s.category === activeCategory)
    }
    if (searchQuery && fuse) {
      const results = fuse.search(searchQuery)
      sections = results.map((r) => DOC_SECTIONS.find((s) => s.id === r.item.id)!).filter(Boolean)
    }
    return sections
  }, [searchQuery, activeCategory, fuse])

  const docContent =
    docs && activeSection ? (docs as unknown as Record<string, string>)[activeSection] || "" : ""

  const handleExport = useCallback(
    async (format: string) => {
      if (!repoId) return
      setIsExporting(true)
      try {
        if (format === "pdf") {
          const allDocs = docs as unknown as Record<string, string> | undefined
          if (allDocs) {
            const { exportDocsPdf } = await import("@/utils/export-pdf")
            await exportDocsPdf(allDocs, currentRepository?.name || "repository")
          }
          return
        }
        const blob = await repositoryService.exportDocumentation(repoId, format)
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${currentRepository?.name || "repository"}-documentation.${format === "mermaid" ? "md" : format}`
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        const allDocs = docs as unknown as Record<string, string> | undefined
        if (allDocs && format !== "pdf") {
          const content = Object.entries(allDocs)
            .map(([key, val]) => `# ${key}\n\n${val}`)
            .join("\n\n---\n\n")
          const blob = new Blob([content], { type: "text/markdown" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${currentRepository?.name || "repository"}-documentation.md`
          a.click()
          URL.revokeObjectURL(url)
        }
      } finally {
        setIsExporting(false)
      }
    },
    [repoId, docs, currentRepository]
  )

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Documentation</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {currentRepository
                  ? `Auto-generated documentation for ${currentRepository.name}`
                  : "Upload a repository to generate documentation"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settings.openRouterKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className={showAIPanel ? "text-blue-400" : ""}
                >
                  {showAIPanel ? (
                    <PanelRightClose className="w-4 h-4 mr-1" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4 mr-1" />
                  )}
                  AI
                </Button>
              )}
              {repoId && (
                <ExportMenu onExport={handleExport} isExporting={isExporting} />
              )}
            </div>
          </div>

          {/* Search */}
          {repoId && (
            <div className="relative max-w-md mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Sidebar */}
            {repoId && (
              <div className="w-60 shrink-0 flex flex-col gap-3 overflow-y-auto">
                {/* Category filter */}
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      !activeCategory
                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        activeCategory === cat
                          ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Section list */}
                <div className="space-y-0.5">
                  {filteredSections.map((section) => {
                    const Icon = ICON_MAP[section.icon] || BookOpen
                    const isActive = activeSection === section.id
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                          isActive
                            ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{section.label}</div>
                          <div className="text-xs text-slate-500 truncate">{section.description}</div>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${COMPLEXITY_COLORS[section.complexity]}`}
                        >
                          {section.complexity}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Main content */}
            <div className={`flex-1 min-w-0 ${showAIPanel ? "max-w-[calc(100%-18rem)]" : ""}`}>
              {!repoId ? (
                <EmptyState />
              ) : isLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                  </div>
                </div>
              ) : activeSection === "build_from_scratch" ? (
                <BuildFromScratch
                  data={buildPlan}
                  isLoading={buildPlanLoading}
                  repoName={currentRepository?.name || "repository"}
                />
              ) : (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm">
                        {DOC_SECTIONS.find((s) => s.id === activeSection)?.label || "Documentation"}
                      </CardTitle>
                      <Badge variant="info">Auto-generated</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {docContent ? (
                      <MarkdownRenderer content={docContent} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="w-8 h-8 text-slate-600 mb-3" />
                        <p className="text-sm text-slate-500">
                          No content available for this section yet.
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Documentation generation may still be in progress.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* AI Panel */}
            {showAIPanel && settings.openRouterKey && (
              <div className="w-72 shrink-0 rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden">
                <AIPanel
                  content={
                    aiContent || { summary: "", architecture: "", onboarding: "" }
                  }
                  isLoading={aiLoading}
                />
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppLayout>
  )
}
