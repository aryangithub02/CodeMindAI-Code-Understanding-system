"use client"

import { create } from "zustand"
import type { Repository, AnalysisResult, DashboardStats } from "@/types"

interface RepositoryState {
  repositories: Repository[]
  currentRepository: Repository | null
  analysisResult: AnalysisResult | null
  dashboardStats: DashboardStats
  isLoading: boolean
  error: string | null

  setRepositories: (repos: Repository[]) => void
  addRepository: (repo: Repository) => void
  removeRepository: (id: string) => void
  setCurrentRepository: (repo: Repository | null) => void
  setAnalysisResult: (result: AnalysisResult | null) => void
  updateRepositoryStatus: (id: string, status: Repository["status"]) => void
  setDashboardStats: (stats: DashboardStats) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  repositories: [],
  currentRepository: null,
  analysisResult: null,
  dashboardStats: {
    totalRepositories: 0,
    totalFiles: 0,
    totalClasses: 0,
    totalFunctions: 0,
    architectureStyle: "Unknown",
    riskLevel: "Low",
    circularDependencies: 0,
  },
  isLoading: false,
  error: null,

  setRepositories: (repositories) => set({ repositories }),
  addRepository: (repo) =>
    set((state) => ({ repositories: [...state.repositories, repo] })),
  removeRepository: (id) =>
    set((state) => ({
      repositories: state.repositories.filter((r) => r.id !== id),
      currentRepository:
        state.currentRepository?.id === id ? null : state.currentRepository,
      analysisResult:
        state.analysisResult?.repository?.id === id
          ? null
          : state.analysisResult,
    })),
  setCurrentRepository: (repo) => set({ currentRepository: repo }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  updateRepositoryStatus: (id, status) =>
    set((state) => ({
      repositories: state.repositories.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
      currentRepository:
        state.currentRepository?.id === id
          ? { ...state.currentRepository, status }
          : state.currentRepository,
    })),
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
