"use client"

import { useState } from "react"
import type { ModuleDetail } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  X, Box, FileCode, GitBranch, Activity, Database, Shield,
  Lightbulb, AlertTriangle, CheckCircle2, TrendingUp,
  ArrowRight, ArrowDown, BookOpen, ExternalLink,
} from "lucide-react"

interface ModuleDrawerProps {
  moduleData: ModuleDetail
  onClose: () => void
}

const COMPLEXITY_BADGE: Record<string, { color: string; bg: string }> = {
  Low: { color: "text-green-400", bg: "bg-green-500/10" },
  Medium: { color: "text-yellow-400", bg: "bg-yellow-500/10" },
  High: { color: "text-red-400", bg: "bg-red-500/10" },
  Critical: { color: "text-purple-400", bg: "bg-purple-500/10" },
}

const RISK_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
  Critical: "text-purple-400",
}

const SEVERITY_BADGE: Record<string, string> = {
  Low: "bg-green-500/10 text-green-400 border-green-500/20",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  High: "bg-red-500/10 text-red-400 border-red-500/20",
  Critical: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const TABS = ["Overview", "Files", "Dependencies", "Data Flow", "Risks", "AI Insights", "Impact Analysis"] as const

export function ModuleDrawer({ moduleData, onClose }: ModuleDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>("Overview")
  const m = moduleData

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      <div className="w-1 bg-gradient-to-b from-blue-500/40 via-purple-500/40 to-pink-500/40" />
      <div className="w-[560px] max-w-[90vw] bg-slate-900 border-l border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Box className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100 truncate">{m.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="info" className="text-[10px] capitalize">{m.type}</Badge>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${COMPLEXITY_BADGE[m.complexity]?.bg || ""} ${COMPLEXITY_BADGE[m.complexity]?.color || ""} border-slate-700`}>
                  {m.complexity}
                </span>
                {m.isEntryPoint && <span className="text-[10px] text-red-400">Entry Point</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/50 overflow-x-auto shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "Overview" && <OverviewTab m={m} />}
          {activeTab === "Files" && <FilesTab m={m} />}
          {activeTab === "Dependencies" && <DependenciesTab m={m} />}
          {activeTab === "Data Flow" && <DataFlowTab m={m} />}
          {activeTab === "Risks" && <RisksTab m={m} />}
          {activeTab === "AI Insights" && <AIInsightsTab m={m} />}
          {activeTab === "Impact Analysis" && <ImpactAnalysisTab m={m} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-slate-800 bg-slate-900/90 text-[10px] text-slate-500 shrink-0">
          <span>{m.fileCount} files · {m.totalLoc} LOC</span>
          <span>Maintainability: {m.maintainabilityScore}%</span>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-5">
      {/* Purpose */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-100">Purpose</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{m.purpose}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Business Domain:</span>
          <Badge variant="info" className="text-[10px]">{m.businessRole}</Badge>
        </div>
      </Card>
      {m.consumers && m.consumers.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Consumers:</span>
          {m.consumers.slice(0, 3).map((consumer, idx) => (
            <Badge key={idx} variant="default" className="text-[10px]">{consumer}</Badge>
          ))}
          {m.consumers.length > 3 && (
             <Badge variant="default" className="text-[10px]">+{m.consumers.length - 3}</Badge>
          )}
        </div>
      )}
      {m.ownerLayer && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Owner Layer:</span>
          <Badge variant="default" className="text-[10px] capitalize">{m.ownerLayer}</Badge>
        </div>
      )}

      {/* Importance & Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Importance", value: m.importance, icon: TrendingUp, color: m.importance === "Critical" ? "text-purple-400" : m.importance === "High" ? "text-blue-400" : "text-slate-400" },
          { label: "Complexity", value: m.complexity, icon: Activity, color: COMPLEXITY_BADGE[m.complexity]?.color || "text-slate-400" },
          { label: "Risk Level", value: m.riskLevel, icon: Shield, color: RISK_COLORS[m.riskLevel] || "text-slate-400" },
        ].map((stat) => (
          <Card key={stat.label} className="p-3 text-center">
            <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
            <p className="text-lg font-bold text-slate-100">{stat.value}</p>
            <p className="text-[10px] text-slate-400">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-xs">
          {[
            { label: "Files", value: m.fileCount },
            { label: "Total Lines", value: m.totalLoc },
            { label: "Dependencies", value: m.dependencyCount },
            { label: "Entry Points", value: m.entryPoints.length },
            { label: "DB Tables", value: m.dbTables.length },
            { label: "DB Reads/Writes", value: `${m.dbReads}/${m.dbWrites}` },
          ].map((stat) => (
            <div key={stat.label} className="flex justify-between items-center">
              <span className="text-slate-400">{stat.label}</span>
              <span className="font-mono text-slate-100">{stat.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <FileCode className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-100">Description</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{m.aiExplanation}</p>
      </Card>
    </div>
  )
}

function FilesTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-400" />
          Files ({m.files.length})
        </h3>
      </div>
      {m.files.map((f, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-100 truncate" title={f.path}>{f.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{f.path}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-500">{f.loc} LOC</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${COMPLEXITY_BADGE[f.complexity]?.bg || ""} ${COMPLEXITY_BADGE[f.complexity]?.color || ""} border-slate-700`}>
                {f.complexity}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{f.purpose}</p>
        </Card>
      ))}
    </div>
  )
}

function DependenciesTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-5">
      {/* Depends On */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-100">Depends On ({m.dependsOn.length})</h3>
        </div>
        {m.dependsOn.length > 0 ? (
          <div className="space-y-2">
            {m.dependsOn.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-slate-100">{dep.name}</span>
                <Badge variant="info" className="text-[10px] ml-auto capitalize">{dep.type}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No external dependencies</p>
        )}
      </Card>

      {/* Used By */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ArrowDown className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-100">Used By ({m.usedBy.length})</h3>
        </div>
        {m.usedBy.length > 0 ? (
          <div className="space-y-2">
            {m.usedBy.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <span className="text-xs text-slate-100">{dep.name}</span>
                <Badge variant="info" className="text-[10px] ml-auto capitalize">{dep.type}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Not used by any other module</p>
        )}
      </Card>

      {/* Dep Graph */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-100">Dependency Chain</h3>
        </div>
        <div className="flex flex-col items-center gap-1 py-3">
          {m.dependsOn.length > 0 && (
            <>
              <div className="text-xs text-amber-400 font-medium">{m.name}</div>
              {m.dependsOn.map((dep, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-600">↓</span>
                  <div className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200">{dep.name}</div>
                  <span className="text-[10px] text-slate-600">↓</span>
                  <div className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-400">{dep.type}</div>
                </div>
              ))}
            </>
          )}
          {m.dependsOn.length === 0 && (
            <div className="px-3 py-2 rounded bg-slate-800 text-xs text-slate-400">No dependencies</div>
          )}
        </div>
      </Card>
    </div>
  )
}

function DataFlowTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-5">
      {/* Entry Points */}
      {m.entryPoints.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-slate-100">Entry Points</h3>
          </div>
          <div className="space-y-1">
            {m.entryPoints.map((ep, i) => (
              <div key={i} className="px-3 py-1.5 rounded bg-slate-800/50 text-xs font-mono text-slate-300 truncate">{ep}</div>
            ))}
          </div>
        </Card>
      )}

      {/* Request Flow */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-slate-100">Request Lifecycle</h3>
        </div>
        {m.requestFlow.length > 0 ? (
          <div className="flex flex-col items-center gap-1 py-2">
            {m.requestFlow.map((step, i) => (
              <div key={i} className="flex flex-col items-center">
                {step === "↓" ? (
                  <span className="text-[10px] text-slate-600">↓</span>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-xs text-slate-200 text-center min-w-[180px]">
                    {step}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No request flow data available</p>
        )}
      </Card>

      {/* Database Usage */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-100">Database Usage</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="p-2 rounded bg-slate-800/50 text-center">
            <p className="text-sm font-bold text-slate-100">{m.dbTables.length}</p>
            <p className="text-[10px] text-slate-400">Tables</p>
          </div>
          <div className="p-2 rounded bg-slate-800/50 text-center">
            <p className="text-sm font-bold text-green-400">{m.dbReads}</p>
            <p className="text-[10px] text-slate-400">Reads</p>
          </div>
          <div className="p-2 rounded bg-slate-800/50 text-center">
            <p className="text-sm font-bold text-blue-400">{m.dbWrites}</p>
            <p className="text-[10px] text-slate-400">Writes</p>
          </div>
        </div>
        {m.dbTables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.dbTables.map((t, i) => (
              <Badge key={i} variant="warning" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function RisksTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-5">
      {m.risks.length > 0 ? (
        m.risks.map((risk, i) => (
          <Card key={i} className={`p-3 border-l-2 ${risk.severity === "Critical" ? "border-l-purple-500" : risk.severity === "High" ? "border-l-red-500" : risk.severity === "Medium" ? "border-l-yellow-500" : "border-l-green-500"}`}>
            <div className="flex items-start gap-2">
              <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${risk.severity === "Critical" ? "text-purple-400" : risk.severity === "High" ? "text-red-400" : risk.severity === "Medium" ? "text-yellow-400" : "text-green-400"}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-100 capitalize">{risk.type.replace(/_/g, " ")}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SEVERITY_BADGE[risk.severity] || ""}`}>{risk.severity}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{risk.description}</p>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="text-center py-8">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No risks detected for this module</p>
        </div>
      )}

      {/* Strengths */}
      {m.strengths.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-slate-100">Strengths</h3>
          </div>
          <ul className="space-y-1">
            {m.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function AIInsightsTab({ m }: { m: ModuleDetail }) {
  return (
    <div className="p-5 space-y-5">
      {/* AI Explanation */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-slate-100">Architecture Explanation</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{m.aiExplanation}</p>
        <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-[11px] text-blue-300 leading-relaxed">
            This module was identified as a <strong className="text-blue-200">{m.type}</strong> component
            primarily responsible for <strong className="text-blue-200">{m.businessRole}</strong> business domain.
            It contains {m.fileCount} files ({m.totalLoc} LOC) with {m.dependencyCount} dependency connections.
          </p>
        </div>
      </Card>

      {/* Business Role */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-100">Business Impact</h3>
        </div>
        <p className="text-xs text-slate-300">
          <span className="text-slate-100 font-medium">{m.name}</span> serves the <Badge variant="info" className="text-[10px]">{m.businessRole}</Badge> domain.
          Its business importance is <span className={`font-medium ${m.importance === "Critical" ? "text-purple-400" : m.importance === "High" ? "text-blue-400" : "text-slate-400"}`}>{m.importance}</span>.
        </p>
        <div className="mt-3 p-3 rounded-lg bg-slate-800/50">
          <p className="text-xs text-slate-400 leading-relaxed">
            {m.importance === "Critical" && "This module is critical to the application. Failures here would impact core functionality."}
            {m.importance === "High" && "This module handles important functionality but has some fallback or redundancy."}
            {m.importance === "Medium" && "This module provides supporting functionality that is not business-critical."}
            {m.importance === "Low" && "This module provides auxiliary functionality with limited business impact."}
          </p>
        </div>
      </Card>

      {/* Recommendations */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-100">Recommendations ({m.recommendations.length})</h3>
        </div>
        {m.recommendations.length > 0 ? (
          <ul className="space-y-2">
            {m.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No recommendations at this time</p>
        )}
      </Card>

      {/* Maintainability */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-slate-100">Maintainability</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${m.maintainabilityScore >= 70 ? "bg-green-500" : m.maintainabilityScore >= 50 ? "bg-yellow-500" : m.maintainabilityScore >= 30 ? "bg-red-500" : "bg-purple-500"}`}
                style={{ width: `${m.maintainabilityScore}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-bold text-slate-100">{m.maintainabilityScore}%</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Technical Debt: <span className="text-slate-100">{m.technicalDebt}</span>
        </p>
      </Card>
    </div>
  )
}

function ImpactAnalysisTab({ m }: { m: ModuleDetail }) {
  if (!m.impactAnalysis) {
    return (
      <div className="p-5 flex justify-center items-center h-48">
        <p className="text-slate-500 text-sm">No impact analysis data available.</p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-slate-100">Blast Radius</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">Changing this module affects:</p>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
             <div className="text-xl font-bold text-blue-400">{m.impactAnalysis.affectedApis}</div>
             <div className="text-[10px] text-slate-400">APIs</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
             <div className="text-xl font-bold text-green-400">{m.impactAnalysis.affectedServices}</div>
             <div className="text-[10px] text-slate-400">Services</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
             <div className="text-xl font-bold text-amber-400">{m.impactAnalysis.affectedTables}</div>
             <div className="text-[10px] text-slate-400">Database Tables</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
             <div className="text-xl font-bold text-purple-400">{m.impactAnalysis.affectedFiles}</div>
             <div className="text-[10px] text-slate-400">Files</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-100">Impact Graph</h3>
        </div>
        <div className="flex flex-col items-center gap-1 py-3">
          {m.impactAnalysis.impactGraph.map((node, i) => (
             <div key={i} className="flex flex-col items-center gap-1">
               {i > 0 && <span className="text-[10px] text-slate-600">↓</span>}
               <div className={`px-4 py-2 rounded-lg border text-xs ${i === 0 ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-200" : "bg-slate-800 border-slate-700 text-slate-300"}`}>
                 {node.replace('↓ ', '')}
               </div>
             </div>
          ))}
          {m.impactAnalysis.impactGraph.length === 1 && (
             <div className="text-xs text-slate-500 mt-2">No downstream dependencies affected.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
