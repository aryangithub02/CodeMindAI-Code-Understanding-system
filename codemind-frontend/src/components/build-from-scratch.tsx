"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { BuildFromScratchPlan } from "@/types"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Database,
  Code2,
  Layout,
  Workflow,
  FileType,
  Target,
  BookOpen,
  Lightbulb,
  Download,
  Send,
  X,
  AlertTriangle,
  ExternalLink,
  Shield,
  Activity,
  CheckCircle2
} from "lucide-react"

interface BuildFromScratchProps {
  data: BuildFromScratchPlan | undefined
  isLoading: boolean
  repoName: string
  isFullScreen?: boolean
  onClose?: () => void
}

type TabType = "blueprint" | "phases" | "missing_tech" | "learning"

export function BuildFromScratch({
  data,
  isLoading,
  repoName,
  isFullScreen = false,
  onClose
}: BuildFromScratchProps) {
  const [activeTab, setActiveTab] = useState<TabType>("blueprint")
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0)
  const [timelineHoverWeek, setTimelineHoverWeek] = useState<number | null>(null)
  
  const [mentorQuestion, setMentorQuestion] = useState("")
  const [mentorAnswers, setMentorAnswers] = useState<{ q: string; a: string }[]>([])
  const [mentorLoading, setMentorLoading] = useState(false)

  if (isLoading) return <BuildFromScratchSkeleton isFullScreen={isFullScreen} />
  if (!data) return <BuildFromScratchEmpty isFullScreen={isFullScreen} />

  const {
    blueprint,
    reconstructionPhases,
    databaseDetails,
    backendDetails,
    apiDetails,
    frontendDetails,
    integrationDetails,
    aiDetails,
    testingDetails,
    deploymentDetails,
    visualTimeline,
    aiReconstructionExplanation,
    missingPieces
  } = data

  const handleMentorAsk = async () => {
    if (!mentorQuestion.trim()) return
    setMentorLoading(true)
    const q = mentorQuestion.toLowerCase()
    let answer = ""

    if (q.includes("rebuild") || q.includes("start")) {
      answer = `To rebuild this project, start with **Phase 1: Project Setup & Foundation** by copying the core settings files. Next, build out the **Database Layer (Phase 2)** so that you have working models. Then implement **Services & APIs (Phase 3)** to enable the application logic.`
    } else if (q.includes("mvp") || q.includes("minimum")) {
      answer = `The Minimum Viable Product (MVP) requires completing:
1. **Setup & DB models** (Phases 1-2)
2. **Core Authentication**
3. **Primary business APIs** (Phase 4).
You can postpone advanced UI graphs, custom deployment configs, and automated test coverages.`
    } else if (q.includes("database") || q.includes("relationship")) {
      answer = databaseDetails 
        ? `The database uses **${databaseDetails.collections.map(c => c.name).join(", ")}**. ${databaseDetails.relationships}`
        : "No DB details loaded."
    } else if (q.includes("missing")) {
      answer = `The build analyzer detected the following missing pieces in the current repository:
${missingPieces.map((m, i) => `${i + 1}. ${m}`).join("\n")}
You will need to create these to make the project fully enterprise-ready.`
    } else {
      answer = `I am the project's virtual architect. I can help guide your development. Try asking:
- "What is the MVP?"
- "Which database tables exist?"
- "What files are missing from the repo?"
- "How do I implement auth?"`
    }

    setTimeout(() => {
      setMentorAnswers(prev => [...prev, { q: mentorQuestion, a: answer }])
      setMentorQuestion("")
      setMentorLoading(false)
    }, 400)
  }

  const handleExport = (format: string) => {
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${repoName}-reconstruction-blueprint.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === "markdown") {
      let md = `# Project Reconstruction Blueprint - ${repoName}\n\n`
      md += `**Project Type:** ${blueprint.projectType}\n`
      md += `**Tech Stack:** ${blueprint.techStack.join(", ")}\n`
      md += `**Architecture Pattern:** ${blueprint.architecturePattern}\n`
      md += `**Complexity:** ${blueprint.complexity}\n`
      md += `**Est. Build Time:** ${blueprint.estimatedBuildTime}\n`
      md += `\n---\n\n## 1. Phased Roadmap\n\n`
      
      reconstructionPhases.forEach(p => {
        md += `### Phase ${p.phaseId}: ${p.name}\n`
        md += `*Why this exists:* ${p.whyExists}\n`
        md += `*Expected Output:* ${p.expectedOutput}\n`
        md += `*Files to Create:*\n`
        p.filesToCreate.forEach(f => {
          md += `  - \`${f.path}\`: ${f.purpose}\n`
        })
        md += `\n`
      })

      md += `\n---\n\n## 2. Database Design\n\n`
      if (databaseDetails) {
        md += `### Schemas\n\`\`\`sql\n${databaseDetails.schemas}\n\`\`\`\n`
        md += `### Relationships\n${databaseDetails.relationships}\n`
      } else {
        md += `No database schema found.\n`
      }

      md += `\n---\n\n## 3. AI Reconstruction Analysis\n\n${aiReconstructionExplanation}\n`

      const blob = new Blob([md], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${repoName}-reconstruction-blueprint.md`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // PDF or DOCX - simple textual representation for browser fallback
      const text = `PROJECT RECONSTRUCTION BLUEPRINT\nRepository: ${repoName}\nCreated: ${new Date().toLocaleDateString()}\n\nType: ${blueprint.projectType}\nComplexity: ${blueprint.complexity}\nTimeline: ${blueprint.estimatedBuildTime}\n\nAI Explanation:\n${aiReconstructionExplanation}`
      const blob = new Blob([text], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${repoName}-blueprint.${format}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const mainLayout = (
    <div className="flex flex-col h-full overflow-hidden text-slate-100 bg-slate-950">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Project Reconstruction Blueprint</h1>
            <p className="text-xs text-slate-400 mt-0.5">Step-by-step roadmap to rebuild 80–90% of {repoName} from scratch</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFullScreen && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* METRICS / STATS RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 border-b border-slate-800 bg-slate-900/20 shrink-0">
        {[
          { label: "Project Type", value: blueprint.projectType, color: "text-blue-400" },
          { label: "Tech Stack", value: blueprint.techStack.slice(0, 3).join(" + "), color: "text-emerald-400" },
          { label: "Architecture", value: blueprint.architecturePattern.split(" (")[0], color: "text-purple-400" },
          { label: "Complexity", value: blueprint.complexity, color: blueprint.complexity === "High" ? "text-red-400" : "text-yellow-400" },
          { label: "Build Time", value: blueprint.estimatedBuildTime, color: "text-pink-400" },
          { label: "Learning Time", value: blueprint.estimatedLearningTime, color: "text-orange-400" },
          { label: "Difficulty", value: blueprint.difficulty, color: "text-indigo-400" },
        ].map((s, idx) => (
          <div key={idx} className="p-4 flex flex-col justify-center min-w-0 border-r border-b lg:border-b-0 border-slate-800/60 last:border-r-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</span>
            <p className={cn("text-xs font-bold mt-1 truncate", s.color)} title={s.value}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* SIDEBAR TABS */}
        <div className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/10 shrink-0 p-3 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-y-auto">
          {[
            { id: "blueprint" as const, label: "Blueprint & Timeline", desc: "Estimated schedule", icon: Activity },
            { id: "phases" as const, label: "Implementation Phases", desc: "Detailed build guide", icon: Workflow },
            { id: "missing_tech" as const, label: "AI Guide & Gaps", desc: "Rebuild risks", icon: AlertTriangle },
            { id: "learning" as const, label: "Learning Accelerator", desc: "Key developer concepts", icon: BookOpen },
          ].map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all shrink-0",
                  active
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-blue-400" : "text-slate-500")} />
                <div className="hidden lg:block min-w-0">
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{t.desc}</div>
                </div>
              </button>
            )
          })}

          <div className="hidden lg:block mt-auto pt-4 border-t border-slate-800/60">
            <span className="text-[10px] text-slate-500 uppercase font-semibold px-3 mb-2 block">Download Plan</span>
            <div className="grid grid-cols-2 gap-1.5 px-2">
              {["pdf", "docx", "markdown", "json"].map((format) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(format)}
                  className="text-[10px] py-1 border-slate-800 capitalize"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {format}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* TAB WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {activeTab === "blueprint" && (
                <div className="space-y-6">
                  {/* Timeline Title */}
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Project Reconstruction Timeline</h2>
                    <p className="text-sm text-slate-400">Interactive Gantt roadmap indicating tasks mapping per development week.</p>
                  </div>

                  {/* TIMELINE VISUAL GRAPH */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visualTimeline.map((w, wIdx) => (
                      <div
                        key={w.week}
                        className="cursor-pointer"
                        onMouseEnter={() => setTimelineHoverWeek(wIdx)}
                        onMouseLeave={() => setTimelineHoverWeek(null)}
                        onClick={() => {
                          setActiveTab("phases")
                          setActivePhaseIndex(wIdx * 2)
                        }}
                      >
                        <Card
                          className={cn(
                            "border-slate-800 transition-all relative overflow-hidden group h-full",
                            timelineHoverWeek === wIdx ? "border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/5" : "bg-slate-900/20"
                          )}
                        >
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                          <CardHeader className="pb-2">
                            <span className="text-[10px] text-blue-400 font-mono font-bold uppercase">{w.week}</span>
                            <CardTitle className="text-sm text-slate-100 mt-1">{w.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {w.tasks.map((t, tIdx) => (
                              <div key={tIdx} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500/50 shrink-0 mt-0.5" />
                                <span>{t}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>

                  {/* TECH STACK CHIPS */}
                  <Card className="border-slate-800 bg-slate-900/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" /> Complete Reconstruction Tech Stack
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {blueprint.techStack.map((tech) => (
                        <Badge key={tech} variant="outline" className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/50 text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "phases" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT PHASE LIST */}
                  <div className="lg:col-span-1 space-y-2">
                    <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Reconstruction Steps</h3>
                    <div className="space-y-1.5">
                      {reconstructionPhases.map((phase, idx) => {
                        const active = activePhaseIndex === idx
                        return (
                          <button
                            key={phase.phaseId}
                            onClick={() => setActivePhaseIndex(idx)}
                            className={cn(
                              "w-full text-left px-3.5 py-3 rounded-xl transition-all border",
                              active
                                ? "bg-blue-600/10 border-blue-600/30 text-blue-400 shadow-md shadow-blue-500/5"
                                : "bg-slate-900/10 border-slate-800/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-slate-500">Step {phase.phaseId}</span>
                              <Badge variant="outline" className="text-[9px] px-1 text-slate-400 border-slate-700">{phase.technologiesNeeded[0]}</Badge>
                            </div>
                            <h4 className="text-xs font-bold mt-1 truncate">{phase.name}</h4>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* RIGHT PHASE Workspace */}
                  <div className="lg:col-span-2 space-y-4">
                    {(() => {
                      const phase = reconstructionPhases[activePhaseIndex]
                      if (!phase) return null
                      return (
                        <div className="space-y-4">
                          {/* Phase Header */}
                          <Card className="border-slate-800 bg-slate-900/20">
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded">Step {phase.phaseId}</span>
                                <h3 className="text-base font-bold text-slate-100">{phase.name}</h3>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4 text-xs">
                              <div>
                                <span className="text-slate-500 block mb-1 uppercase font-semibold">Objective</span>
                                <p className="text-slate-300 leading-relaxed">{phase.whyExists}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Expected Outcome</span>
                                  <p className="text-slate-300 font-medium">{phase.expectedOutput}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Primary Stack</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {phase.technologiesNeeded.map(t => (
                                      <Badge key={t} variant="outline" className="text-[10px] border-slate-800 text-slate-300">{t}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Files to Create */}
                          <Card className="border-slate-800 bg-slate-900/20">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xs flex items-center gap-2 text-slate-400 uppercase tracking-wider font-semibold">
                                <FileType className="w-4 h-4 text-orange-400" /> Files to Create
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {phase.filesToCreate.map((f, fi) => (
                                <div key={fi} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
                                  <div className="min-w-0">
                                    <span className="text-xs font-mono font-bold text-blue-300 truncate block">{f.path}</span>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{f.purpose}</p>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>

                          {/* Phase details conditionals */}
                          {phase.phaseId === 2 && databaseDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Database className="w-4 h-4 text-purple-400" /> Database Entity & ER Diagram
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div>
                                  <span className="text-slate-500 block mb-1.5 uppercase font-semibold">Entities / Collections</span>
                                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    {databaseDetails.collections.map((c, ci) => (
                                      <div key={ci} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                        <h5 className="font-bold text-slate-200">{c.name}</h5>
                                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{c.description}</p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {c.fields.map(fd => (
                                            <span key={fd} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-850 text-slate-300 border border-slate-800">{fd}</span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2">
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Schema Scripts</span>
                                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-850">
                                    {databaseDetails.schemas}
                                  </pre>
                                </div>

                                <div className="pt-2">
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Constraints & Indexes</span>
                                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-xs">
                                    {databaseDetails.indexes.map((idxVal, ii) => (
                                      <li key={ii}>{idxVal}</li>
                                    ))}
                                  </ul>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 3 && backendDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Workflow className="w-4 h-4 text-indigo-400" /> Business Logic Architecture
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div className="space-y-2">
                                  <span className="text-slate-500 block uppercase font-semibold">Core Services</span>
                                  {backendDetails.services.map((s, si) => (
                                    <div key={si} className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-850 flex items-start justify-between">
                                      <div>
                                        <span className="font-bold text-slate-200">{s.name}</span>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{s.purpose}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-[9px] text-slate-500"><span className="text-slate-650">In:</span> {s.inputs}</div>
                                        <div className="text-[9px] text-slate-500 mt-0.5"><span className="text-slate-650">Out:</span> {s.outputs}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {backendDetails.repositories.length > 0 && (
                                  <div className="space-y-2 pt-2">
                                    <span className="text-slate-500 block uppercase font-semibold">Data Access Repositories</span>
                                    {backendDetails.repositories.map((r, ri) => (
                                      <div key={ri} className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-850">
                                        <span className="font-bold text-slate-200">{r.name}</span>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{r.purpose}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                  <div>
                                    <span className="text-slate-500 block uppercase font-semibold">Middleware & Interceptors</span>
                                    <div className="space-y-1 mt-1">
                                      {backendDetails.middleware.map((m, mi) => (
                                        <div key={mi} className="text-xs text-slate-350">
                                          <strong className="text-slate-200">{m.name}</strong>: {m.purpose}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block uppercase font-semibold">Validation Constraints</span>
                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{backendDetails.validation}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 4 && apiDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Code2 className="w-4 h-4 text-blue-400" /> API Endpoints & Request Sequence
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div>
                                  <span className="text-slate-500 block mb-1.5 uppercase font-semibold">Build Sequencing</span>
                                  <div className="flex flex-wrap gap-2">
                                    {apiDetails.apiBuildOrder.map((order, oi) => (
                                      <div key={oi} className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[10px]">
                                        <span className="font-mono text-blue-400 font-bold">{oi + 1}</span>
                                        <span className="font-mono text-slate-200">{order}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2 pt-2">
                                  <span className="text-slate-500 block uppercase font-semibold">Endpoint Details</span>
                                  {apiDetails.endpoints.map((ep, ei) => (
                                    <div key={ei} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Badge className={cn(
                                            "text-[10px]",
                                            ep.method === "POST" ? "bg-green-600/20 text-green-400" : "bg-blue-600/20 text-blue-400"
                                          )}>{ep.method}</Badge>
                                          <span className="font-mono font-bold text-slate-100 text-xs">{ep.path}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-700">{ep.authentication}</Badge>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] font-mono">
                                        <div>
                                          <span className="text-slate-500 block mb-1">Request:</span>
                                          <pre className="p-2 bg-slate-950 rounded text-slate-300 overflow-x-auto max-h-24">{ep.request}</pre>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block mb-1">Response:</span>
                                          <pre className="p-2 bg-slate-950 rounded text-slate-350 overflow-x-auto max-h-24">{ep.response}</pre>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 5 && frontendDetails && frontendDetails.uiSequence.length > 0 && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Layout className="w-4 h-4 text-pink-400" /> UI Component Sequence
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div>
                                  <span className="text-slate-500 block mb-1.5 uppercase font-semibold">Development Order</span>
                                  <div className="flex flex-wrap gap-2">
                                    {frontendDetails.uiSequence.map((page, pi) => (
                                      <div key={pi} className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-855 text-xs">
                                        <span className="text-blue-400 font-bold">Step {pi + 1}</span>
                                        <span className="text-slate-200">{page}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                  <span className="text-slate-500 block uppercase font-semibold">Pages Components Mapping</span>
                                  {frontendDetails.pages.map((p, pi) => (
                                    <div key={pi} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2">
                                      <h5 className="font-bold text-slate-200">{p.name}</h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
                                        <div>
                                          <strong className="text-slate-300 block mb-1">State Managed:</strong>
                                          <span>{p.state}</span>
                                        </div>
                                        <div>
                                          <strong className="text-slate-300 block mb-1">APIs Consumed:</strong>
                                          <span>{p.apisConsumed.join(", ")}</span>
                                        </div>
                                      </div>
                                      <div className="pt-1 text-[11px]">
                                        <strong className="text-slate-350">Data Flow Journey:</strong>
                                        <p className="text-slate-400 mt-0.5 italic">{p.flows.join("; ")}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 6 && integrationDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-yellow-400" /> Integration & Lifecycles
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-slate-200 block mb-1">Frontend → Backend Connection</strong>
                                    <p className="text-slate-400 leading-relaxed text-[11px]">{integrationDetails.frontendToBackend}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-slate-200 block mb-1">Backend → Database Connection</strong>
                                    <p className="text-slate-400 leading-relaxed text-[11px]">{integrationDetails.backendToDatabase}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-2">
                                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-slate-200 block mb-1">Security & Authentication Flow</strong>
                                    <p className="text-slate-400 leading-relaxed text-[11px]">{integrationDetails.authFlow}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                                    <strong className="text-slate-200 block mb-1">Error Handling Routines</strong>
                                    <p className="text-slate-400 leading-relaxed text-[11px]">{integrationDetails.errorHandling}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 7 && aiDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Lightbulb className="w-4 h-4 text-purple-400" /> AI & Auxiliary Features
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-xs leading-relaxed">
                                <div>
                                  <strong className="text-slate-200">ML Model Core:</strong>
                                  <p className="text-slate-400 text-[11px] mt-0.5">{aiDetails.mlModel}</p>
                                </div>
                                <div>
                                  <strong className="text-slate-200">Prediction Engine:</strong>
                                  <p className="text-slate-400 text-[11px] mt-0.5">{aiDetails.predictionEngine}</p>
                                </div>
                                <div>
                                  <strong className="text-slate-200">Feature Engineering Steps:</strong>
                                  <p className="text-slate-400 text-[11px] mt-0.5">{aiDetails.featureEngineering}</p>
                                </div>
                                <div>
                                  <strong className="text-slate-200">Inference Request Pipeline:</strong>
                                  <p className="text-slate-400 text-[11px] mt-0.5">{aiDetails.inferencePipeline}</p>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 8 && testingDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-green-400" /> Testing Quality Strategy
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <strong className="text-slate-300 block mb-1">Unit Tests</strong>
                                    {testingDetails.unitTests.map((t, ti) => (
                                      <div key={ti} className="text-slate-400 text-[11px] flex gap-1"><span className="text-green-500">✓</span> {t}</div>
                                    ))}
                                  </div>
                                  <div className="space-y-2">
                                    <strong className="text-slate-300 block mb-1">Integration Tests</strong>
                                    {testingDetails.integrationTests.map((t, ti) => (
                                      <div key={ti} className="text-slate-400 text-[11px] flex gap-1"><span className="text-green-500">✓</span> {t}</div>
                                    ))}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                  <div className="space-y-2">
                                    <strong className="text-slate-300 block mb-1">API Endpoint Tests</strong>
                                    {testingDetails.apiTests.map((t, ti) => (
                                      <div key={ti} className="text-slate-400 text-[11px] flex gap-1"><span className="text-green-500">✓</span> {t}</div>
                                    ))}
                                  </div>
                                  <div className="space-y-2">
                                    <strong className="text-slate-300 block mb-1">End-to-End Tests</strong>
                                    {testingDetails.e2eTests.map((t, ti) => (
                                      <div key={ti} className="text-slate-400 text-[11px] flex gap-1"><span className="text-green-500">✓</span> {t}</div>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {phase.phaseId === 9 && deploymentDetails && (
                            <Card className="border-slate-800 bg-slate-900/20">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                  <Target className="w-4 h-4 text-pink-400" /> Infrastructure & Deploy Settings
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 text-xs">
                                <div>
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Environment Variables Checklist</span>
                                  <div className="space-y-1.5 mt-1 font-mono">
                                    {deploymentDetails.envVars.map((v, vi) => (
                                      <div key={vi} className="p-2 rounded bg-slate-900 text-blue-300 border border-slate-855 text-[11px]">
                                        {v}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2">
                                  <span className="text-slate-500 block mb-1 uppercase font-semibold">Dockerfile Configuration</span>
                                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-850 leading-relaxed">
                                    {deploymentDetails.dockerConfig}
                                  </pre>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                  <div>
                                    <span className="text-slate-500 block mb-1 uppercase font-semibold">CI/CD automation pipeline</span>
                                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{deploymentDetails.ciCd}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block mb-1 uppercase font-semibold">Hosting target environment</span>
                                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{deploymentDetails.hosting}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {activeTab === "missing_tech" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT DETECTED GAPS PANEL */}
                  <div className="lg:col-span-2 space-y-4">
                    <Card className="border-red-900/40 bg-red-950/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" /> Missing Pieces Detection
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400">Analysis of files and configurations not found in this repository that you will need to add to complete the rebuild.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 mt-2">
                        {missingPieces.map((gap, gIdx) => (
                          <div key={gIdx} className="p-3 rounded-lg bg-red-950/10 border border-red-900/30 text-xs text-slate-300 flex items-start gap-2.5">
                            <span className="text-red-500 mt-0.5 font-bold">•</span>
                            <span>{gap}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-800 bg-slate-900/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-200">AI Reconstruction Explanation</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-slate-400 leading-relaxed space-y-2">
                        <p>{aiReconstructionExplanation}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* RIGHT AI ARCHITECT ADVISOR PANEL */}
                  <div className="lg:col-span-1">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col h-full">
                      <div className="p-4 border-b border-slate-800">
                        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          Virtual Architect Mentor
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Ask questions about how this application was built.</p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                        {mentorAnswers.length === 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-500 font-semibold block">Suggested Questions</span>
                            {[
                              "How do I rebuild the databases?",
                              "What is the MVP scope?",
                              "Which files are missing from the repo?",
                              "Explain auth layer services"
                            ].map((q, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setMentorQuestion(q)
                                }}
                                className="w-full text-left text-xs text-slate-400 hover:text-blue-400 py-1.5 px-2 rounded-lg hover:bg-blue-600/10 border border-slate-800/40 transition-colors"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}

                        {mentorAnswers.map((chat, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="text-right">
                              <span className="inline-block text-[11px] bg-blue-600/20 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-500/20">{chat.q}</span>
                            </div>
                            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-850">
                              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{chat.a}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
                        <div className="flex gap-2">
                          <input
                            value={mentorQuestion}
                            onChange={(e) => setMentorQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleMentorAsk()}
                            placeholder="Ask the architect..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleMentorAsk}
                            disabled={mentorLoading}
                            className="shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "learning" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Learning Accelerator</h3>
                    <p className="text-sm text-slate-400">Core architectural concepts to learn before recreating each phase.</p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {reconstructionPhases.map((phase) => {
                      if (!phase.learningAccelerator) return null
                      return (
                        <Card key={phase.phaseId} className="border-slate-850 bg-slate-900/20">
                          <CardHeader className="pb-2">
                            <span className="text-[9px] font-bold text-slate-500">PHASE {phase.phaseId} CONCEPTS</span>
                            <CardTitle className="text-sm text-slate-200 mt-0.5">{phase.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 mt-1 text-xs">
                            {phase.learningAccelerator.concepts.map((concept, ci) => (
                              <div key={ci} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-bold text-slate-200 flex-1 min-w-0 leading-tight">{concept.name}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-350 border-slate-700 shrink-0">{concept.time}</Badge>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-slate-700 text-slate-400 shrink-0">{concept.difficulty}</Badge>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Resources:</span>
                                  {concept.resources.map((res, ri) => (
                                    <a
                                      key={ri}
                                      href="#"
                                      onClick={(e) => e.preventDefault()}
                                      className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 hover:underline"
                                    >
                                      {res} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm p-4 md:p-6 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-6xl h-[85vh] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col bg-slate-950">
          {mainLayout}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-slate-800 overflow-hidden flex flex-col bg-slate-950 min-h-[500px]">
      {mainLayout}
    </div>
  )
}

function BuildFromScratchSkeleton({ isFullScreen }: { isFullScreen: boolean }) {
  const content = (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 bg-slate-800" />
          <Skeleton className="h-4 w-72 bg-slate-800" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl bg-slate-800" />
        ))}
      </div>
      <div className="flex gap-4">
        <div className="w-48 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg bg-slate-800" />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-48 rounded-xl bg-slate-800" />
        </div>
      </div>
    </div>
  )

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 p-6 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-5xl h-[80vh] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
          {content}
        </div>
      </div>
    )
  }

  return <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-4">{content}</div>
}

function BuildFromScratchEmpty({ isFullScreen }: { isFullScreen: boolean }) {
  const content = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Building2 className="h-12 w-12 text-slate-600 mb-4 animate-pulse" />
      <h3 className="text-lg font-semibold text-slate-300 mb-2">Analyzing Repository Structure...</h3>
      <p className="text-sm text-slate-500 max-w-md">
        Generating reconstruction blueprints, ER diagrams, test fixtures, and visual timeline coordinates.
      </p>
    </div>
  )

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 p-6 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-5xl h-[80vh] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl flex items-center justify-center">
          {content}
        </div>
      </div>
    )
  }

  return <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-4">{content}</div>
}
