"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  FolderGit2, Files, FunctionSquare, Layers, AlertTriangle,
  GitBranch, FileCode, Clock, Trash2,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { repositoryService } from "@/services/api"
import { formatNumber, formatDate } from "@/lib/utils"
import type { DashboardStats, Repository } from "@/types"

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

const statCards = [
  { label: "Total Repositories", key: "totalRepositories" as const, icon: FolderGit2, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Total Files", key: "totalFiles" as const, icon: Files, color: "text-purple-400", bg: "bg-purple-500/10" },
  { label: "Total Classes", key: "totalClasses" as const, icon: Layers, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Total Functions", key: "totalFunctions" as const, icon: FunctionSquare, color: "text-orange-400", bg: "bg-orange-500/10" },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function DashboardRepoCard({ repo }: { repo: Repository }) {
  const queryClient = useQueryClient()
  const [showDelete, setShowDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => repositoryService.delete(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setShowDelete(false)
    },
  })

  return (
    <>
      <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-100">{repo.name}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{repo.language}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(repo.updatedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={repo.status === "complete" ? "success" : "warning"} className="text-[10px]">
            {repo.status}
          </Badge>
          <button
            onClick={() => setShowDelete(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label={`Delete ${repo.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDelete(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
          <Card className="w-full max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="text-sm">Delete Repository</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <span className="font-semibold text-slate-100">{repo.name}</span>? This will permanently remove all associated data.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: repositoryService.getDashboardStats,
    staleTime: 30_000,
  })

  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["repositories"],
    queryFn: repositoryService.getAll,
  })

  const emptyState: DashboardStats = {
    totalRepositories: 0,
    totalFiles: 0,
    totalClasses: 0,
    totalFunctions: 0,
    architectureStyle: "N/A",
    riskLevel: "Low",
    circularDependencies: 0,
  }

  const displayStats = stats || emptyState

  // Build language distribution from actual repos
  const languageDistribution = useMemo(() => {
    const langCount = new Map<string, number>()
    repositories.forEach((r) => {
      langCount.set(r.language, (langCount.get(r.language) || 0) + 1)
    })
    return Array.from(langCount.entries())
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      .filter((d) => d.value > 0)
  }, [repositories])

  // Simulate growth from repository creation dates
  const repoGrowth = useMemo(() => {
    if (repositories.length === 0) return []
    const monthly = new Map<string, number>()
    repositories.forEach((r) => {
      const month = new Date(r.createdAt).toLocaleString("en-US", { month: "short" })
      monthly.set(month, (monthly.get(month) || 0) + 1)
    })
    return Array.from(monthly.entries())
      .map(([month, repos]) => ({ month, repos }))
      .sort((a, b) => a.month.localeCompare(b.month, "en", { sensitivity: "base" }))
  }, [repositories])

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of all analyzed repositories</p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statCards.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20 mt-3" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-100 mt-3">
                      {formatNumber(displayStats[stat.key as keyof DashboardStats] as number)}
                    </p>
                  )}
                  <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Repository Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {isLoading ? (
                  <div className="flex items-end gap-2 h-full pb-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex-1 animate-pulse rounded-md bg-slate-800/50" style={{ height: `${40 + Math.random() * 60}%` }} />
                    ))}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={repoGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                      <YAxis stroke="#64748B" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1E293B",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#F8FAFC",
                        }}
                      />
                      <Bar dataKey="repos" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 flex items-center justify-center">
                {isLoading ? (
                  <Skeleton className="w-44 h-44 rounded-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={languageDistribution.length > 0 ? languageDistribution : [{ name: "No data", value: 1, color: "#1E293B" }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {languageDistribution.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1E293B",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#F8FAFC",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {isLoading ? (
                <div className="space-y-2 mt-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              ) : languageDistribution.length > 0 ? (
                <div className="space-y-2 mt-4">
                  {languageDistribution.map((lang) => (
                    <div key={lang.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lang.color }} />
                        <span className="text-slate-300">{lang.name}</span>
                      </div>
                      <span className="text-slate-500">{lang.value} repos</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-slate-500">Connect repositories to see language breakdown</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Architecture Detected</p>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  {isLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    <span className="text-lg font-semibold text-slate-100">{displayStats.architectureStyle}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Risk Level</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  {isLoading ? (
                    <Skeleton className="h-6 w-16 rounded-full" />
                  ) : (
                    <Badge variant={displayStats.riskLevel === "High" ? "danger" : "warning"}>
                      {displayStats.riskLevel}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Circular Dependencies</p>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-red-400" />
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <span className="text-lg font-semibold text-slate-100">{displayStats.circularDependencies}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Repositories</CardTitle>
              <Badge variant="info" className="text-xs">
                {repositories.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : repositories.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No repositories yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {repositories.map((repo) => (
                  <DashboardRepoCard key={repo.id} repo={repo} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </ErrorBoundary>
    </AppLayout>
  )
}