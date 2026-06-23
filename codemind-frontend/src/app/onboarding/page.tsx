"use client"

import { useState, useMemo } from "react"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2, Circle, BookOpen, FileText, GitBranch, Layers,
  ArrowRight, Trophy, Brain, Zap, Clock, Shield, Network,
  Target, Compass, Sparkles, Building2,
  ChevronRight, ChevronDown, Monitor, Database,
  BarChart3, GraduationCap, HelpCircle, MessageSquare,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { repositoryService } from "@/services/api"
import { ErrorBoundary } from "@/components/error-boundary"
import { useRepositoryStore } from "@/store/repository-store"
import { useRouter } from "next/navigation"
import { BuildFromScratch } from "@/components/build-from-scratch"
import type {
  OnboardingPlan, OnboardingPhase, OnboardingTask,
  QuizQuestion, ReadinessScore,
} from "@/types"

/* ─── TASK STATUS TRACKING ─────────────────────────────── */
type TaskStatus = "completed" | "in_progress" | "not_started"
function getTaskStatus(id: string): TaskStatus {
  if (typeof window === "undefined") return "not_started"
  const stored = localStorage.getItem(`onboarding_task_${id}`)
  return (stored as TaskStatus) || "not_started"
}

function setTaskStatus(id: string, status: TaskStatus) {
  if (typeof window === "undefined") return
  localStorage.setItem(`onboarding_task_${id}`, status)
}

/* ─── AI MENTOR SIMULATED ANSWERS ──────────────────────── */
const MENTOR_ANSWERS: Record<string, string> = {
  architecture: "This repository uses **layered architecture** with clear separation between controllers, services, and data access layers. The dependency graph shows a top-down flow from entry points through modules to data stores.",
  "entry-point": "The main entry point bootstraps the application, configures middleware (CORS, validation), and starts the HTTP server. It's the first file you should read to understand the startup sequence.",
  workflow: "A typical request flows: HTTP Client → Router/Controller → Service Layer → Repository/Database → Response. Middleware intercepts for auth, validation, and logging at each stage.",
  services: "Services contain the core business logic. They are injected into controllers and depend on repositories for data access. Look for `@Injectable()` or similar decorators to identify them.",
  database: "The data layer uses an ORM to map application models to database tables. Repositories abstract query logic. Migrations track schema changes over time.",
  testing: "Tests are organized by type: unit tests for services, integration tests for API endpoints, and end-to-end tests for critical user flows. Run them with the project's test script.",
}

/* ─── READINESS CALC ───────────────────────────────────── */
function calcReadiness(
  tasks: { id: string; status: TaskStatus }[],
  quizCompleted: boolean,
): ReadinessScore {
  const completedTasks = tasks.filter(t => getTaskStatus(t.id) === "completed").length
  const inProgress = tasks.filter(t => getTaskStatus(t.id) === "in_progress").length
  const total = tasks.length || 1

  const filesRead = Math.round((completedTasks / total) * 40)
  const modulesExplored = Math.round((completedTasks / total) * 30)
  const flowsReviewed = Math.round((completedTasks / total) * 15)
  const architectureStudied = inProgress > 0 ? 10 : 5
  const quizBonus = quizCompleted ? 10 : 0

  const overall = Math.min(100, filesRead + modulesExplored + flowsReviewed + architectureStudied + quizBonus)

  return { overall, filesRead, modulesExplored, flowsReviewed, architectureStudied }
}

/* ─── DIFFICULTY COLOR ─────────────────────────────────── */
const diffColor: Record<string, string> = {
  Beginner: "text-green-400 bg-green-400/10 border-green-400/20",
  Intermediate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Advanced: "text-red-400 bg-red-400/10 border-red-400/20",
}
const impColor: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
}

/* ─── QUIZ SECTION ─────────────────────────────────────── */
function QuizSection({ quiz }: { quiz: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const correct = Object.entries(answers).filter(([qIdx, ans]) => quiz[Number(qIdx)]?.correctIndex === ans).length

  if (!quiz.length) return null

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-purple-400" /> Knowledge Validation
        </CardTitle>
        <CardDescription className="text-xs">Test your understanding of this repository</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quiz.map((q, qi) => (
          <div key={qi} className="space-y-2">
            <p className="text-sm text-slate-200 font-medium">{qi + 1}. {q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => !submitted && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition-all border",
                      submitted && oi === q.correctIndex && "border-green-500/50 bg-green-500/10 text-green-300",
                      submitted && answers[qi] === oi && oi !== q.correctIndex && "border-red-500/50 bg-red-500/10 text-red-300",
                      !submitted && answers[qi] === oi && "border-blue-500/50 bg-blue-500/10",
                      !submitted && answers[qi] !== oi && "border-slate-700/50 hover:border-slate-600 text-slate-300",
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {submitted && (
              <p className="text-xs text-slate-400 italic">{q.explanation}</p>
            )}
          </div>
        ))}
        {!submitted ? (
          <Button
            size="sm"
            onClick={() => setSubmitted(true)}
            disabled={Object.keys(answers).length < quiz.length}
            className="w-full"
          >
            Submit Answers
          </Button>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-semibold text-slate-200">
              {correct}/{quiz.length} Correct
            </p>
            {correct === quiz.length && (
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-green-400">
                <Trophy className="w-3 h-3" /> Perfect score!
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── AI MENTOR SECTION ────────────────────────────────── */
function AiMentorPanel() {
  const [question, setQuestion] = useState("")
  const [chat, setChat] = useState<{ q: string; a: string }[]>([])

  const SUGGESTED = [
    { label: "How is the architecture organized?", key: "architecture" },
    { label: "Where is the entry point?", key: "entry-point" },
    { label: "What's the main data flow?", key: "workflow" },
    { label: "How do services work?", key: "services" },
  ]

  function ask(q: string) {
    if (!q.trim()) return
    const key = Object.keys(MENTOR_ANSWERS).find(k => q.toLowerCase().includes(k))
    const a = key ? MENTOR_ANSWERS[key] : "This repository follows standard patterns for its framework and architecture. Check the documentation sections for detailed information."
    setChat(prev => [...prev, { q, a }])
    setQuestion("")
  }

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" /> AI Mentor
        </CardTitle>
        <CardDescription className="text-xs">Ask questions about this repository</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {chat.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map(s => (
              <button
                key={s.key}
                onClick={() => ask(s.label)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {chat.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <p className="text-xs text-slate-300 font-medium">Q: {c.q}</p>
                <p className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-2">{c.a}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask(question)}
            placeholder="Ask a question..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <Button size="sm" variant="ghost" onClick={() => ask(question)} disabled={!question.trim()}>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── LOADING SKELETON ─────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── PHASE CARD ───────────────────────────────────────── */
function PhaseCard({
  phase,
  index,
  isActive,
  onSelect,
  onToggleTask,
}: {
  phase: OnboardingPhase
  index: number
  isActive: boolean
  onSelect: () => void
  onToggleTask: (taskId: string, current: TaskStatus) => void
}) {
  const phaseTasks = phase.tasks || []

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border transition-all overflow-hidden",
        isActive ? "border-blue-600/40 bg-blue-600/5" : "border-slate-800 bg-slate-900/30",
      )}
    >
      <button
        onClick={onSelect}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border",
            isActive ? "bg-blue-600/20 border-blue-600/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-400",
          )}>
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{phase.name}</p>
            <p className="text-xs text-slate-500">{phase.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {phase.estimatedTime}
          </span>
          {isActive ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800"
          >
            {/* Tasks */}
            {phaseTasks.length > 0 && (
              <div className="px-4 py-3 space-y-1">
                <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> Tasks
                </p>
                {phaseTasks.map(task => {
                  const status = getTaskStatus(task.id)
                  return (
                    <button
                      key={task.id}
                      onClick={() => onToggleTask(task.id, status)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/30 transition-colors text-left"
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : status === "in_progress" ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-xs",
                          status === "completed" ? "text-slate-500 line-through" : "text-slate-200",
                        )}>
                          {task.label}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", diffColor[task.difficulty] || "")}>
                          {task.difficulty}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", impColor[task.importance] || "")}>
                          {task.importance}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Files */}
            {phase.files.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-800/50">
                <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Key Files
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {phase.files.map(f => (
                    <Badge
                      key={f.path}
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono border",
                        f.importance === "Critical" ? "border-red-500/30 text-red-300" :
                        f.importance === "High" ? "border-orange-500/30 text-orange-300" :
                        "border-slate-700 text-slate-400",
                      )}
                    >
                      {f.path.split("/").pop()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Flows */}
            {phase.flows.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-800/50">
                <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3" /> Flows
                </p>
                <div className="space-y-1">
                  {phase.flows.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                      <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── MAIN PAGE ────────────────────────────────────────── */
export default function OnboardingPage() {
  const { currentRepository } = useRepositoryStore()
  const repoId = currentRepository?.id
  const router = useRouter()

  const [tick, setTick] = useState(0)
  const [activePhase, setActivePhase] = useState(0)
  const [extendedTab, setExtendedTab] = useState("roadmap")
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false)

  const planQuery = useQuery({
    queryKey: ["onboarding", repoId],
    queryFn: () => repositoryService.getOnboarding(repoId as string),
    enabled: !!repoId,
  })
  const plan = planQuery.data
  const isLoading = planQuery.isLoading

  const buildPlanQuery = useQuery({
    queryKey: ["build-plan", repoId],
    queryFn: () => repositoryService.getBuildFromScratch(repoId as string),
    enabled: !!repoId,
  })
  const buildPlan = buildPlanQuery.data
  const isBuildPlanLoading = buildPlanQuery.isLoading

  // ─── PLAN DATA ──────────────────────────────────────
  const phases: OnboardingPhase[] = plan?.phases ?? [];
  const quiz: QuizQuestion[] = plan?.quiz ?? [];
  const importantFlows = plan?.importantFlows ?? [];
  const architecturePath = plan?.architecturePath ?? [];

  const allTasks = useMemo(() => {
    const tasks: { id: string; status: TaskStatus }[] = [];
    if (plan && plan.phases) {
      for (const p of plan.phases) {
        for (const t of p.tasks ?? []) {
          tasks.push({ id: t.id, status: getTaskStatus(t.id) });
        }
      }
    }
    return tasks;
  }, [plan, tick]);

  const readiness = useMemo(() => calcReadiness(allTasks, quizCompleted), [allTasks, quizCompleted])
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => getTaskStatus(t.id) === "completed").length
  const inProgressTasks = allTasks.filter(t => getTaskStatus(t.id) === "in_progress").length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // ─── SUMMARY DATA ───────────────────────────────────
  const summaryCards = [
    { icon: Layers, label: "Architecture", value: plan?.summary?.architecture || "Analyzing...", color: "text-blue-400" },
    { icon: Database, label: "Tech Stack", value: (plan?.summary?.techStack || []).slice(0, 2).join(", ") + ((plan?.summary?.techStack?.length || 0) > 2 ? ` +${(plan?.summary?.techStack?.length || 0) - 2}` : ""), color: "text-emerald-400" },
    { icon: BarChart3, label: "Complexity", value: plan?.summary?.complexity || "Unknown", color: plan?.summary?.complexity === "High" ? "text-red-400" : plan?.summary?.complexity === "Medium" ? "text-yellow-400" : "text-green-400" },
    { icon: Clock, label: "Est. Learning", value: plan?.summary?.estimatedLearningTime || "2-3 hours", color: "text-purple-400" },
  ]

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !plan ? (
            <Card className="border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Brain className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">Select a repository to view its onboarding plan</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── HEADER ─────────────────────────────────── */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    Onboarding Assistant
                  </h1>
                  <p className="text-sm text-slate-400 mt-0.5">{plan?.summary?.purpose}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBuildModalOpen(true)}
                  className="gap-2 border-slate-700"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Build From Scratch
                </Button>
              </div>

              {/* ── SUMMARY CARDS ─────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summaryCards.map((c, i) => (
                  <motion.div
                    key={c.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl bg-slate-900/50 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <c.icon className={cn("w-3.5 h-3.5", c.color)} />
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200 mt-1">{c.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* ── PROGRESS BAR ──────────────────────────── */}
              <Card className="border-slate-800">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Learning Progress</span>
                      <span className="text-xs font-semibold text-slate-200">{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-2" />
                  </div>
                  <div className="flex gap-3">
                    {[
                      { label: "Done", value: completedTasks, color: "text-green-400" },
                      { label: "Active", value: inProgressTasks, color: "text-blue-400" },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                        <p className="text-[10px] text-slate-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* ── MAIN LAYOUT ───────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* LEFT — TABS */}
                <div className="lg:col-span-2 space-y-4">
                  <Tabs value={extendedTab} onValueChange={setExtendedTab}>
                    <TabsList className="bg-slate-900 border border-slate-800">
                      <TabsTrigger value="roadmap" className="text-xs data-[state=active]:bg-blue-600/20">
                        <Compass className="w-3.5 h-3.5 mr-1.5" />
                        Learning Path
                      </TabsTrigger>
                      <TabsTrigger value="components" className="text-xs data-[state=active]:bg-blue-600/20">
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Files To Read
                      </TabsTrigger>
                      <TabsTrigger value="flows" className="text-xs data-[state=active]:bg-blue-600/20">
                        <Network className="w-3.5 h-3.5 mr-1.5" />
                        Flows To Understand
                      </TabsTrigger>
                      <TabsTrigger value="build_from_scratch" className="text-xs data-[state=active]:bg-blue-600/20">
                        <Building2 className="w-3.5 h-3.5 mr-1.5" />
                        Build From Scratch
                      </TabsTrigger>
                      <TabsTrigger value="quiz" className="text-xs data-[state=active]:bg-blue-600/20">
                        <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                        Quiz
                      </TabsTrigger>
                    </TabsList>

                    {/* ── ROADMAP ────────────────────────── */}
                    <TabsContent value="roadmap" className="mt-4 space-y-2">
                      {phases.length === 0 ? (
                        <Card className="border-slate-800">
                          <CardContent className="text-center py-8">
                            <p className="text-sm text-slate-500">No learning phases generated yet.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        phases.map((phase, i) => (
                          <PhaseCard
                            key={phase.name}
                            phase={phase}
                            index={i}
                            isActive={activePhase === i}
                            onSelect={() => setActivePhase(i === activePhase ? -1 : i)}
                            onToggleTask={(taskId, current) => {
                              const next: TaskStatus = current === "not_started" ? "in_progress" : current === "in_progress" ? "completed" : "not_started"
                              setTaskStatus(taskId, next)
                              setTick(t => t + 1)
                            }}
                          />
                        ))
                      )}
                    </TabsContent>

                    {/* ── COMPONENTS ─────────────────────── */}
                    <TabsContent value="components" className="mt-4 space-y-4">
                      {/* Services */}
                      {!!plan?.importantComponents?.services && plan.importantComponents.services.length > 0 && (
                        <Card className="border-slate-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Zap className="w-4 h-4 text-blue-400" /> Critical Services & Modules
                            </CardTitle>
                            <CardDescription className="text-xs">Key modules ranked by dependency centrality</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {plan.importantComponents.services.map(s => (
                              <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30">
                                <div>
                                  <p className="text-xs font-medium text-slate-200">{s.name}</p>
                                  <p className="text-[10px] text-slate-500">{s.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={cn("text-[10px]", impColor[s.importance] || "")}>
                                    {s.importance}
                                  </Badge>
                                  <span className="text-[10px] text-slate-500">{s.usedByCount} refs</span>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* Important Files */}
                      {!!plan?.importantComponents?.files && plan.importantComponents.files.length > 0 && (
                        <Card className="border-slate-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4 text-orange-400" /> Ranked Files
                            </CardTitle>
                            <CardDescription className="text-xs">Files ordered by architecture importance score</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {plan.importantComponents.files.map((f, i) => (
                              <div key={f.path} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/20 transition-colors">
                                <span className={cn(
                                  "text-[10px] font-mono w-5 text-right",
                                  i < 3 ? "text-yellow-400" : "text-slate-600",
                                )}>#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono text-slate-300 truncate">{f.path}</p>
                                  <p className="text-[10px] text-slate-500">{f.purpose}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5", impColor[f.importance] || "")}>
                                    {f.importance}
                                  </Badge>
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] px-1.5",
                                    f.complexity === "High" ? "text-red-400 border-red-500/30" :
                                    f.complexity === "Medium" ? "text-yellow-400 border-yellow-500/30" :
                                    "text-green-400 border-green-500/30",
                                  )}>
                                    {f.complexity}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* APIs */}
                      {!!plan?.importantComponents?.apis && plan.importantComponents.apis.length > 0 && (
                        <Card className="border-slate-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-purple-400" /> API Controllers
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {plan.importantComponents.apis.map(a => (
                              <div key={a.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30">
                                <div>
                                  <p className="text-xs font-medium text-slate-200">{a.name}</p>
                                  <p className="text-[10px] text-slate-500">{a.description}</p>
                                </div>
                                <Badge variant="outline" className={cn("text-[10px]", impColor[a.importance] || "")}>
                                  {a.importance}
                                </Badge>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ── FLOWS ───────────────────────────── */}
                    <TabsContent value="flows" className="mt-4 space-y-4">
                      {/* Architecture Learning Path */}
                      {architecturePath.length > 0 && (
                        <Card className="border-slate-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Compass className="w-4 h-4 text-blue-400" /> Architecture Learning Path
                            </CardTitle>
                            <CardDescription className="text-xs">Suggested order to explore the codebase</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {architecturePath.map((step, i) => (
                              <div key={step.step} className="flex items-start gap-3 px-3 py-2">
                                <div className="flex flex-col items-center">
                                  <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border",
                                    i < architecturePath.length - 1 ? "bg-blue-600/20 border-blue-600/30 text-blue-400" : "bg-emerald-600/20 border-emerald-600/30 text-emerald-400",
                                  )}>
                                    {i + 1}
                                  </div>
                                  {i < architecturePath.length - 1 && <div className="w-0.5 h-4 bg-blue-600/20 mt-1" />}
                                </div>
                                <div className="pb-3">
                                  <p className="text-xs font-medium text-slate-200">{step.step}</p>
                                  <p className="text-[10px] text-slate-500">{step.description}</p>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* Important Flows */}
                      {importantFlows.length > 0 && (
                        <Card className="border-slate-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Network className="w-4 h-4 text-purple-400" /> Important Flows
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {importantFlows.map(f => (
                              <details key={f.name} className="group">
                                <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-800/30">
                                  <ArrowRight className="w-3 h-3 text-purple-400" />
                                  {f.name}
                                  <ChevronRight className="w-3 h-3 text-slate-500 ml-auto group-open:rotate-90 transition-transform" />
                                </summary>
                                <div className="mt-1 ml-5 space-y-1">
                                  {f.steps.map((step, si) => (
                                    <div key={si} className="flex items-start gap-2 text-[10px] text-slate-400">
                                      <span className="text-slate-600 mt-0.5">{si + 1}.</span>
                                      <span>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ── BUILD FROM SCRATCH ───────────────── */}
                    <TabsContent value="build_from_scratch" className="mt-4">
                      <BuildFromScratch
                        data={buildPlan}
                        isLoading={isBuildPlanLoading}
                        repoName={currentRepository?.name || "repository"}
                        isFullScreen={false}
                      />
                    </TabsContent>

                    {/* ── QUIZ ────────────────────────────── */}
                    <TabsContent value="quiz" className="mt-4">
                      <QuizSection quiz={quiz} />
                    </TabsContent>
                  </Tabs>
                </div>

                {/* RIGHT — SIDEBAR */}
                <div className="space-y-4">
                  {/* Readiness Score */}
                  <Card className="border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-400" /> Developer Readiness
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative w-24 h-24 mx-auto mb-3">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(30 41 59)" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke={readiness.overall >= 70 ? "rgb(52 211 153)" : readiness.overall >= 40 ? "rgb(96 165 250)" : "rgb(251 191 36)"}
                            strokeWidth="8"
                            strokeDasharray={`${(readiness.overall / 100) * 264} 264`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-slate-100">{readiness.overall}%</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { label: "Files Read", value: readiness.filesRead, max: 40 },
                          { label: "Modules Explored", value: readiness.modulesExplored, max: 30 },
                          { label: "Flows Reviewed", value: readiness.flowsReviewed, max: 15 },
                          { label: "Architecture", value: readiness.architectureStudied, max: 15 },
                        ].map(s => (
                          <div key={s.label} className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">{s.label}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={(s.value / s.max) * 100} className="w-16 h-1.5" />
                              <span className="text-[10px] text-slate-400 w-6 text-right">{s.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Mentor */}
                  <AiMentorPanel />

                  {/* Quick Actions */}
                  <Card className="border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" /> Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs border-slate-700"
                        onClick={() => router.push(`/docs/${repoId}`)}
                      >
                        <BookOpen className="w-3 h-3 mr-2" />
                        View Documentation
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs border-slate-700"
                        onClick={() => router.push(`/data-flow`)}
                      >
                        <Network className="w-3 h-3 mr-2" />
                        Explore Data Flow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs border-slate-700"
                        onClick={() => router.push(`/architecture`)}
                      >
                        <Layers className="w-3 h-3 mr-2" />
                        View Architecture
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs border-slate-700"
                        onClick={() => {
                          setExtendedTab("quiz")
                          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
                        }}
                      >
                        <Trophy className="w-3 h-3 mr-2" />
                        Take Knowledge Quiz
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs border-slate-700"
                        onClick={() => setIsBuildModalOpen(true)}
                      >
                        <Building2 className="w-3 h-3 mr-2" />
                        Build From Scratch
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
        {isBuildModalOpen && (
          <BuildFromScratch
            data={buildPlan}
            isLoading={isBuildPlanLoading}
            repoName={currentRepository?.name || "repository"}
            isFullScreen={true}
            onClose={() => setIsBuildModalOpen(false)}
          />
        )}
      </ErrorBoundary>
    </AppLayout>
  )
}
