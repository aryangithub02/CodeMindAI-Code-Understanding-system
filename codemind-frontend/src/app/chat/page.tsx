"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useChatStore } from "@/store/chat-store"
import { useSettingsStore } from "@/store/settings-store"
import { useRepositoryStore } from "@/store/repository-store"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Send,
  Bot,
  User,
  Copy,
  Check,
  FileCode,
  RefreshCw,
  MessageSquare,
  Brain,
  AlertCircle,
  X,
  Shield,
  Activity,
  Layers,
  BookOpen,
  ChevronRight,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { repositoryService } from "@/services/api"
import { CodeViewer } from "@/components/code-viewer"
import ReactMarkdown from "react-markdown"

const suggestedQuestions: Record<string, string[]> = {
  ask: [
    "How does this project work?",
    "Where is the main entry point?",
    "What frameworks are used here?",
  ],
  architecture: [
    "Explain the architecture layers",
    "How are modules decoupled?",
    "Show database structure and entities",
  ],
  security: [
    "Review JWT authentication security",
    "Check authorization validation checks",
    "Where are passwords hashed?",
  ],
  performance: [
    "Find performance bottlenecks",
    "Are there circular dependencies?",
    "Explain service scaling suggestions",
  ],
  refactor: [
    "How can I refactor duplicate logic?",
    "Suggest modularity improvements",
    "Find tightly coupled files",
  ],
  onboarding: [
    "I joined this project today. What is my path?",
    "Explain prediction flow onboarding",
    "Day 1 reading list",
  ],
  documentation: [
    "Generate API design specification documentation",
    "Generate documentation for authentication module",
    "Explain file purpose and exports",
  ],
}

const qaModes = [
  { id: "ask", label: "Ask", description: "General repository questions and discussions", icon: MessageSquare },
  { id: "architecture", label: "Architecture", description: "Explain system architecture, patterns, layers, and boundaries", icon: Layers },
  { id: "security", label: "Security Review", description: "Security auditing, vulnerability analysis, and JWT check", icon: Shield },
  { id: "performance", label: "Performance", description: "Identify bottlenecks, heavy database queries, and hotspots", icon: Activity },
  { id: "refactor", label: "Refactor Plan", description: "Analyze structural smells and plan refactoring steps", icon: RefreshCw },
  { id: "onboarding", label: "Onboarding Path", description: "Developer training guides and multi-day learning paths", icon: BookOpen },
  { id: "documentation", label: "Documentation", description: "Generate structured module, API, and component docs", icon: FileCode },
]

interface ParsedMessage {
  mainText: string
  beginner?: string
  developer?: string
  architect?: string
  metrics?: { name: string; value: string }[]
  architecture?: {
    layer?: string
    module?: string
    pattern?: string
  }
  actions?: { type: string; target: string; label: string }[]
}

function parseMessageContent(content: string): ParsedMessage {
  const result: ParsedMessage = { mainText: content }

  // Extract explanation tabs (beginner, developer, architect)
  const explanationRegex = /<explanation>([\s\S]*?)<\/explanation>/i
  const explanationMatch = content.match(explanationRegex)
  if (explanationMatch) {
    const explanationContent = explanationMatch[1]
    const beg = explanationContent.match(/<beginner>([\s\S]*?)<\/beginner>/i)
    const dev = explanationContent.match(/<developer>([\s\S]*?)<\/developer>/i)
    const arc = explanationContent.match(/<architect>([\s\S]*?)<\/architect>/i)
    if (beg) result.beginner = beg[1].trim()
    if (dev) result.developer = dev[1].trim()
    if (arc) result.architect = arc[1].trim()
    result.mainText = result.mainText.replace(explanationRegex, "")
  }

  // Extract visual card metrics
  const visualCardRegex = /<visual_card>([\s\S]*?)<\/visual_card>/i
  const visualCardMatch = content.match(visualCardRegex)
  if (visualCardMatch) {
    const cardContent = visualCardMatch[1]
    const metricMatches = Array.from(cardContent.matchAll(/<metric\s+name="([^"]+)"\s+value="([^"]+)"\s*\/?>/gi))
    const metrics = []
    for (const match of metricMatches) {
      metrics.push({ name: match[1], value: match[2] })
    }
    if (metrics.length > 0) result.metrics = metrics
    result.mainText = result.mainText.replace(visualCardRegex, "")
  }

  // Extract architecture location
  const archRegex = /<architecture>([\s\S]*?)<\/architecture>/i
  const archMatch = content.match(archRegex)
  if (archMatch) {
    const archContent = archMatch[1]
    const layer = archContent.match(/<layer>([\s\S]*?)<\/layer>/i)
    const module = archContent.match(/<module>([\s\S]*?)<\/module>/i)
    const pattern = archContent.match(/<pattern>([\s\S]*?)<\/pattern>/i)
    result.architecture = {
      layer: layer ? layer[1].trim() : undefined,
      module: module ? module[1].trim() : undefined,
      pattern: pattern ? pattern[1].trim() : undefined,
    }
    result.mainText = result.mainText.replace(archRegex, "")
  }

  // Extract actions
  const actionsRegex = /<actions>([\s\S]*?)<\/actions>/i
  const actionsMatch = content.match(actionsRegex)
  if (actionsMatch) {
    const actionsContent = actionsMatch[1]
    const actionMatches = Array.from(actionsContent.matchAll(/<action\s+type="([^"]+)"\s+target="([^"]+)"\s*>([\s\S]*?)<\/action>/gi))
    const actions = []
    for (const match of actionMatches) {
      actions.push({ type: match[1], target: match[2], label: match[3].trim() })
    }
    if (actions.length > 0) result.actions = actions
    result.mainText = result.mainText.replace(actionsRegex, "")
  }

  result.mainText = result.mainText.trim()
  return result
}

function compressCodebaseContext(result: any) {
  if (!result) return undefined

  const architecture = {
    type: result.architecture?.type || "Unknown",
    layers: result.architecture?.layers || [],
    modules: result.architecture?.nodes
      ?.filter((n: any) => n.type === "controller" || n.type === "service" || n.type === "repository" || n.type === "database" || n.type === "external")
      .map((n: any) => ({
        name: n.label,
        type: n.type,
        layer: n.layer,
        risk: n.riskLevel,
        purpose: n.purpose,
      })) || [],
    moduleDetails: result.architecture?.moduleDetails
      ? Object.entries(result.architecture.moduleDetails).reduce<Record<string, any>>((acc, [key, val]: any) => {
          acc[key] = {
            purpose: val.purpose,
            files: val.files?.map((f: any) => f.path) || [],
            dependsOn: val.dependsOn?.map((d: any) => d.name) || [],
            usedBy: val.usedBy?.map((u: any) => u.name) || [],
          }
          return acc
        }, {})
      : undefined,
  }

  const dependencies = {
    circularDependencies: result.dependencies?.circularDependencies || [],
    externalDependencies: result.dependencies?.externalDependencies || [],
    hotspots: result.dependencies?.hotspots || [],
  }

  const dataFlow = {
    routes: result.dataFlow?.routes || [],
    flows: result.dataFlow?.flows?.map((f: any) => ({
      id: f.id,
      label: f.label,
      description: f.description,
      nodeIds: f.nodeIds,
      averageResponse: f.averageResponse,
      riskLevel: f.riskLevel,
    })) || [],
    bottlenecks: result.dataFlow?.bottlenecks || [],
  }

  return {
    architecture,
    dependencies,
    dataFlow,
  }
}

function MessageRenderer({
  content,
  isStreaming,
  onAction,
}: {
  content: string
  isStreaming: boolean
  onAction: (actionType: string, target: string) => void
}) {
  const [activeTab, setActiveTab] = useState<"beginner" | "developer" | "architect">("developer")

  if (isStreaming) {
    return (
      <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
        {content}
      </div>
    )
  }

  const parsed = parseMessageContent(content)
  const hasTabs = parsed.beginner || parsed.developer || parsed.architect
  const availableTabs = []
  if (parsed.beginner) availableTabs.push("beginner")
  if (parsed.developer) availableTabs.push("developer")
  if (parsed.architect) availableTabs.push("architect")

  const currentTab = availableTabs.includes(activeTab)
    ? activeTab
    : (availableTabs[0] as "beginner" | "developer" | "architect") || "developer"

  return (
    <div className="space-y-4">
      {/* 1. Architecture Location Header */}
      {parsed.architecture && (
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400 font-bold" />
            <span className="text-slate-500 font-semibold uppercase tracking-wider">Layer:</span>
            <span className="text-slate-200 font-medium">{parsed.architecture.layer}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-500 font-semibold uppercase tracking-wider">Module:</span>
            <span className="text-slate-200 font-medium">{parsed.architecture.module}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-500 font-semibold uppercase tracking-wider">Pattern:</span>
            <span className="text-slate-200 font-medium">{parsed.architecture.pattern}</span>
          </div>
        </div>
      )}

      {/* 2. Visual Metric Cards */}
      {parsed.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {parsed.metrics.map((metric, i) => {
            const isCritical = metric.value === "Critical" || metric.value === "High"
            const isMedium = metric.value === "Medium"
            const isLow = metric.value === "Low"
            return (
              <div
                key={i}
                className={cn(
                  "p-2.5 rounded-lg bg-slate-900/40 border text-center transition-all hover:bg-slate-900/70",
                  isCritical
                    ? "border-red-900/40 hover:border-red-500/30"
                    : isMedium
                    ? "border-yellow-900/40 hover:border-yellow-500/30"
                    : isLow
                    ? "border-green-900/40 hover:border-green-500/30"
                    : "border-slate-800 hover:border-slate-700"
                )}
              >
                <span className="block text-[8.5px] text-slate-500 uppercase font-semibold tracking-wider">
                  {metric.name}
                </span>
                <span
                  className={cn(
                    "block text-xs font-bold mt-0.5",
                    isCritical
                      ? "text-red-400"
                      : isMedium
                      ? "text-yellow-400"
                      : isLow
                      ? "text-green-400"
                      : "text-slate-200"
                  )}
                >
                  {metric.value}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Text Body or Tabbed Views */}
      {hasTabs ? (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/10">
          <div className="flex bg-slate-900/40 border-b border-slate-800/80 p-1">
            {parsed.beginner && (
              <button
                onClick={() => setActiveTab("beginner")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                  currentTab === "beginner" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Beginner View
              </button>
            )}
            {parsed.developer && (
              <button
                onClick={() => setActiveTab("developer")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                  currentTab === "developer" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Developer View
              </button>
            )}
            {parsed.architect && (
              <button
                onClick={() => setActiveTab("architect")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                  currentTab === "architect" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Architect View
              </button>
            )}
          </div>
          <div className="p-4 prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
            <ReactMarkdown>
              {currentTab === "beginner" ? parsed.beginner! : currentTab === "developer" ? parsed.developer! : parsed.architect!}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
          <ReactMarkdown>{parsed.mainText}</ReactMarkdown>
        </div>
      )}

      {/* 4. Actions */}
      {parsed.actions && (
        <div className="flex flex-wrap gap-2 pt-2">
          {parsed.actions.map((act, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAction(act.type, act.target)}
              className="text-[10px] bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {act.type === "view_file" && <FileCode className="w-3.5 h-3.5 mr-1.5 text-blue-400" />}
              {act.type === "view_flow" && <Activity className="w-3.5 h-3.5 mr-1.5 text-purple-400" />}
              {act.type === "view_architecture" && <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />}
              {act.type === "view_risks" && <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-amber-400" />}
              {act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  const {
    messages,
    isStreaming,
    addMessage,
    setIsStreaming,
    appendToLastMessage,
    conversations,
    setCurrentRepository,
    deleteConversation,
    renameConversation,
  } = useChatStore()
  const { settings } = useSettingsStore()
  const { currentRepository, analysisResult } = useRepositoryStore()
  const [tab, setTab] = useState("ask")
  const [input, setInput] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)

  // Drawer overlays
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)

  const nextId = () => `msg-${++idCounter.current}-${crypto.randomUUID().slice(0, 8)}`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (currentRepository) {
      setCurrentRepository(currentRepository.id)
      setActiveConversation(currentRepository.id)
    }
  }, [currentRepository, setCurrentRepository])

  // Fetch file content for overlay
  const { data: fileCode, isLoading: fileLoading } = useQuery({
    queryKey: ["chat-file-content", currentRepository?.id, activeFilePath],
    queryFn: () => repositoryService.getFileContent(currentRepository!.id, activeFilePath!),
    enabled: !!currentRepository?.id && !!activeFilePath,
  })

  // Find active data flow journey for overlay
  const activeFlow = useMemo(() => {
    if (!activeFlowId || !analysisResult || !(analysisResult.dataFlow as any)?.flows) return null
    return ((analysisResult.dataFlow as any).flows as any[]).find((f: any) => f.id === activeFlowId)
  }, [activeFlowId, analysisResult])

  const chatMutation = useMutation({
    mutationFn: async ({ messageText, history }: { messageText: string; history: any[] }) => {
      const compressedContext = analysisResult ? compressCodebaseContext(analysisResult) : undefined

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          repositoryId: currentRepository?.id || "current",
          openRouterKey: settings.openRouterKey,
          codebaseContext: compressedContext,
          messagesHistory: history,
          mode: tab,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || `API error: ${response.status}`)
      }

      return response
    },
    onSuccess: async (response) => {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        appendToLastMessage(chunk)
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to get response"
      appendToLastMessage(`\n\nError: ${message}`)
      setError(message)
    },
    onSettled: () => {
      setIsStreaming(false)
      abortRef.current = null
    },
  })

  const handleSend = async (suggested?: string) => {
    const messageText = suggested || input
    if (!messageText.trim() || isStreaming) return

    setError(null)

    const userMessage = {
      id: nextId(),
      role: "user" as const,
      content: messageText,
      timestamp: new Date().toISOString(),
    }

    const history = messages.slice(-10)

    addMessage(userMessage)
    const userInput = messageText
    setInput("")
    setIsStreaming(true)

    const assistantMessage = {
      id: nextId(),
      role: "assistant" as const,
      content: "",
      timestamp: new Date().toISOString(),
    }

    addMessage(assistantMessage)

    const controller = new AbortController()
    abortRef.current = controller

    chatMutation.mutate({ messageText: userInput, history })
  }

  const handleActionClick = (actionType: string, target: string) => {
    if (actionType === "view_file") {
      setActiveFilePath(target)
    } else if (actionType === "view_flow") {
      setActiveFlowId(target)
    } else if (actionType === "view_architecture") {
      setTab("architecture")
      const prompt = `Explain the architecture details, pattern, and file mappings for the module: ${target}`
      setInput(prompt)
      setTimeout(() => handleSend(prompt), 100)
    } else if (actionType === "view_risks") {
      setTab("security")
      const prompt = `Review the security posture, credentials validation, and risks for the module: ${target}`
      setInput(prompt)
      setTimeout(() => handleSend(prompt), 100)
    } else if (actionType === "generate_tests") {
      const prompt = `Generate unit test cases, assertion structures, and edge-case validation scenarios for: ${target}`
      setInput(prompt)
      setTimeout(() => handleSend(prompt), 100)
    } else if (actionType === "generate_docs") {
      setTab("documentation")
      const prompt = `Generate comprehensive technical documentation, architectural patterns, and API descriptors for: ${target}`
      setInput(prompt)
      setTimeout(() => handleSend(prompt), 100)
    }
  }

  const handleDeleteConversation = (repoId: string) => {
    deleteConversation(repoId)
    if (activeConversation === repoId) {
      setActiveConversation(null)
    }
  }

  const handleStartRename = (repoId: string, currentName: string) => {
    setEditingId(repoId)
    setEditName(currentName)
  }

  const handleRename = () => {
    if (editingId && editName.trim()) {
      renameConversation(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName("")
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentQuestions = suggestedQuestions[tab] || suggestedQuestions.ask

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex gap-4">
        {/* Left conversations sidebar */}
        <Card className="w-64 shrink-0 overflow-hidden flex flex-col bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800/80">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-100">
              <MessageSquare className="w-4 h-4 text-blue-400" /> Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-2 space-y-1 overflow-y-auto">
            {Object.keys(conversations).length === 0 ? (
              <p className="text-xs text-slate-500 text-center mt-4">No saved conversations</p>
            ) : (
              Object.entries(conversations).map(([repoId, msgs]) => {
                const repoName = msgs[0]?.content?.slice(0, 20) || `Repo ${repoId.slice(0, 8)}`
                const isActive = activeConversation === repoId
                return (
                  <div
                    key={repoId}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                      isActive ? "bg-blue-600/10 text-blue-400" : "hover:bg-slate-800/50 text-slate-350"
                    )}
                    onClick={() => {
                      setActiveConversation(repoId)
                      setCurrentRepository(repoId)
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    {editingId === repoId ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                        className="flex-1 bg-transparent text-xs outline-none text-slate-200"
                        autoFocus
                      />
                    ) : (
                      <span className="text-xs truncate flex-1">{repoName}</span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartRename(repoId, repoName)
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                        aria-label="Rename conversation"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteConversation(repoId)
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                        aria-label="Delete conversation"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Right chat panel */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-slate-900/30 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Brain className="w-5 h-5 text-blue-400 shrink-0" aria-hidden="true" />
                <CardTitle className="text-sm truncate text-slate-100">AI Repository Agent</CardTitle>
                {currentRepository && (
                  <Badge variant="info" className="truncate max-w-[160px]">
                    {currentRepository.name}
                  </Badge>
                )}
              </div>
              {analysisResult && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTab("architecture")
                      handleSend(
                        "Explain repository architecture pattern, layers, modules, dependencies, flows, databases, external APIs, strengths, weaknesses, scalability, technical debt, and improvement roadmap."
                      )
                    }}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 transition-colors"
                  >
                    Explain Architecture
                  </button>
                  <button
                    onClick={() => {
                      const context = `Architecture: ${analysisResult.architecture?.type || "Unknown"}\nCircular Dependencies: ${(analysisResult as any).dependencies?.circularDependencies?.length || 0}\nFiles: ${analysisResult.repository?.totalFiles || "N/A"}`
                      navigator.clipboard.writeText(context)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                    aria-label="Copy repository context summary"
                    title="Copy context summary"
                  >
                    Copy Context
                  </button>
                </div>
              )}
            </div>
          </CardHeader>

          {/* Horizontal Q&A tabs */}
          <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 overflow-x-auto flex gap-1.5 shrink-0 scrollbar-none">
            {qaModes.map((mode) => {
              const Icon = mode.icon
              const isActive = tab === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setTab(mode.id)}
                  title={mode.description}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg whitespace-nowrap transition-colors border",
                    isActive
                      ? "bg-blue-600 border-blue-500 text-white shadow-sm font-bold"
                      : "bg-slate-800/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-amber-400 hover:text-amber-300">
                ×
              </button>
            </div>
          )}

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20" aria-live="polite" aria-atomic="false">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-100">
                    Repository Intelligence Q&A – {qaModes.find((m) => m.id === tab)?.label} Mode
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                    {qaModes.find((m) => m.id === tab)?.description}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg w-full">
                  {currentQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="px-4 py-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-left text-xs text-slate-300 hover:bg-slate-800 hover:border-slate-700 transition-all leading-normal flex justify-between items-center group"
                    >
                      <span className="truncate pr-2">{q}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, idx) => {
                const isLastMsg = idx === messages.length - 1
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                        msg.role === "user" ? "bg-blue-600" : "bg-slate-800 border border-slate-700"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl p-4 shadow-sm",
                        msg.role === "user"
                          ? "bg-blue-600/10 border border-blue-600/20"
                          : "bg-slate-900/60 border border-slate-800/80"
                      )}
                    >
                      {msg.role === "user" ? (
                        <div className="text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <MessageRenderer
                          content={msg.content}
                          isStreaming={isStreaming && isLastMsg && !msg.content}
                          onAction={handleActionClick}
                        />
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                            Sources:
                          </p>
                          {msg.sources.map((src, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                              <FileCode className="w-3 h-3" />
                              <span>
                                {src.file}:{src.line}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.role === "assistant" && msg.content && (
                        <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-800/50">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                            title="Copy message content"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input Panel */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/20">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  currentRepository
                    ? `Ask about your repository in ${qaModes.find((m) => m.id === tab)?.label} Mode...`
                    : "Select a repository to start chatting..."
                }
                aria-label="Chat input"
                disabled={!currentRepository}
                className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
              <Button variant="primary" size="md" onClick={() => handleSend()} isLoading={isStreaming}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. File Viewer Overlay Drawer */}
      {activeFilePath && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setActiveFilePath(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-[650px] z-50 bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{activeFilePath.split("/").pop()}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">{activeFilePath}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveFilePath(null)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-0 bg-slate-950">
              {fileLoading ? (
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6" />
                </div>
              ) : (
                <CodeViewer code={fileCode || ""} language="typescript" filename={activeFilePath} />
              )}
            </div>
          </div>
        </>
      )}

      {/* 6. Flow Viewer Overlay Drawer */}
      {activeFlow && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setActiveFlowId(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-[550px] z-50 bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{activeFlow.label}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">{activeFlow.route || "/"}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveFlowId(null)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300 bg-slate-950/20">
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Latency</span>
                  <span className="text-slate-100 font-bold text-xs mt-0.5 block">{activeFlow.averageResponse || "—"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Risk</span>
                  <span className="text-slate-100 font-bold text-xs mt-0.5 block">{activeFlow.riskLevel || "—"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Perf Score</span>
                  <span className="text-green-400 font-bold text-xs mt-0.5 block">{activeFlow.performanceScore || 0}%</span>
                </div>
              </div>

              {/* Description */}
              {activeFlow.description && (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</h4>
                  <p className="p-3 bg-slate-800/25 border border-slate-800 rounded-lg text-slate-300 leading-relaxed font-mono">
                    {activeFlow.description}
                  </p>
                </div>
              )}

              {/* Request Timeline */}
              {activeFlow.requestJourney && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Request Journey Path</h4>
                  <div className="relative pl-5 space-y-2.5 border-l border-slate-850 ml-2 py-1">
                    {activeFlow.requestJourney.map((jNode: string, idx: number) => (
                      <div key={idx} className="relative flex items-center">
                        <span className="absolute -left-[24px] w-2 h-2 rounded-full bg-purple-500 border border-slate-900" />
                        <span className="font-mono text-slate-200 text-[11px] bg-slate-800/40 px-2 py-0.5 rounded border border-slate-800/60">
                          {jNode}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Transformation Pipeline */}
              {activeFlow.dataTransformation && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data Transformations</h4>
                  <div className="space-y-2">
                    {activeFlow.dataTransformation.map((dt: any, idx: number) => (
                      <div key={idx} className="flex gap-3 bg-slate-800/20 border border-slate-800/60 p-2.5 rounded-lg items-center">
                        <Badge variant="outline" className="text-[9px] uppercase font-mono px-2 py-0.5 border-purple-500/20 text-purple-400">
                          {dt.stage}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10.5px] text-slate-200 truncate">{dt.value}</p>
                          {dt.operation && <span className="text-[8.5px] text-slate-500 font-mono">Op: {dt.operation}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Steps */}
              {activeFlow.breakdown && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Execution Steps</h4>
                  <div className="space-y-2">
                    {activeFlow.breakdown.map((step: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1 font-mono">
                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                          <span>Step {step.step || idx + 1}</span>
                          <span className="truncate max-w-[220px]">{step.file}</span>
                        </div>
                        <h5 className="font-semibold text-slate-200 text-xs">{step.title}</h5>
                        {step.request && <code className="text-[9.5px] text-pink-400 bg-slate-950 px-1 py-0.5 rounded border border-slate-850">{step.request}</code>}
                        <p className="text-slate-400 text-[10.5px] leading-relaxed pt-1">{step.purpose}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}
