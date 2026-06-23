import axios from "axios"
import { API_BASE_URL } from "@/lib/constants"
import type {
  Repository,
  AnalysisResult,
  ArchitectureAnalysis,
  ArchitectureInsightResponse,
  ArchitectureGraphResponse,
  ArchitectureMetrics,
  ChatMessage,
  DashboardStats,
  RepositoryTreeNode,
  OnboardingPlan,
  FlowMetrics,
  FlowBottleneck,
  DataFlowJourney,
  DocumentationSection,
  AIDocumentationContent,
  BuildFromScratchPlan,
} from "@/types"

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("codemind-settings")
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state.settings?.apiKey) {
        config.headers.Authorization = `Bearer ${state.settings.apiKey}`
      }
    } catch { }
  }
  return config
})

export const repositoryService = {
  async upload(formData: FormData): Promise<Repository> {
    const { data } = await api.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return data
  },

  async uploadFromUrl(url: string): Promise<Repository> {
    const { data } = await api.post("/api/upload/url", { url })
    return data
  },

  async getAll(): Promise<Repository[]> {
    const { data } = await api.get("/api/repositories")
    return data
  },

  async getById(id: string): Promise<Repository> {
    const { data } = await api.get(`/api/repository/${id}`)
    return data
  },

  async getFileTree(id: string): Promise<RepositoryTreeNode[]> {
    const { data } = await api.get(`/api/repository/${id}/tree`)
    return data
  },

  async getFileContent(id: string, path: string): Promise<string> {
    const { data } = await api.get(`/api/repository/${id}/file`, { params: { path } })
    return data.content
  },

  async getAnalysis(id: string): Promise<ArchitectureAnalysis> {
    const { data } = await api.get(`/api/architecture/${id}`)
    return data
  },

  async getDataFlow(id: string): Promise<AnalysisResult["dataFlow"]> {
    const { data } = await api.get(`/api/dataflow/${id}`)
    return data
  },

  async getDataFlowAnalysis(id: string): Promise<{
    summary: string; strengths: string[]; weaknesses: string[]; risks: string[]; recommendations: string[]
  }> {
    const { data } = await api.get(`/api/dataflow/${id}/analysis`)
    return data
  },

  async getDataFlowJourneys(id: string): Promise<{ journeys: DataFlowJourney[] }> {
    const { data } = await api.get(`/api/dataflow/${id}/journeys`)
    return data
  },

  async getDataFlowMetrics(id: string): Promise<{ metrics: FlowMetrics; bottlenecks: FlowBottleneck[] }> {
    const flow = await this.getDataFlow(id)
    return {
      metrics: {
        totalFlows: flow.metrics?.totalFlows ?? 0,
        requestFlows: flow.metrics?.requestFlows ?? 0,
        databaseFlows: flow.metrics?.databaseFlows ?? 0,
        externalAPIs: flow.metrics?.externalAPIs ?? 0,
        bottlenecks: flow.metrics?.bottlenecks ?? 0,
        riskScore: flow.metrics?.riskScore ?? "Low",
      },
      bottlenecks: flow.bottlenecks ?? [],
    }
  },

  async getDocumentation(id: string): Promise<AnalysisResult["documentation"]> {
    const { data } = await api.get(`/api/documentation/${id}`)
    return data
  },

  async getOnboarding(id: string): Promise<OnboardingPlan> {
    const { data } = await api.get(`/api/onboarding/${id}`)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/repository/${id}`)
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await api.get("/api/dashboard/stats")
    return data
  },

  async getArchitectureInsights(id: string): Promise<ArchitectureInsightResponse> {
    const { data } = await api.get(`/api/architecture/${id}/insights`)
    return data
  },

  async getArchitectureGraph(id: string): Promise<ArchitectureGraphResponse> {
    const { data } = await api.get(`/api/architecture/${id}/graph`)
    return data
  },

  async getArchitectureMetrics(id: string): Promise<ArchitectureMetrics> {
    const { data } = await api.get(`/api/architecture/${id}/metrics`)
    return data
  },

  async getDocumentationSections(id: string): Promise<DocumentationSection[]> {
    const { data } = await api.get(`/api/documentation/${id}/sections`)
    return data
  },

  async getDocumentationSection(id: string, sectionId: string): Promise<string> {
    const { data } = await api.get(`/api/documentation/${id}/section/${sectionId}`)
    return typeof data === "string" ? data : data.content
  },

  async getAIDocumentation(id: string): Promise<AIDocumentationContent> {
    const { data } = await api.get(`/api/documentation/${id}/ai`)
    return data
  },

  async getBuildFromScratch(id: string): Promise<BuildFromScratchPlan> {
    const { data } = await api.get(`/api/documentation/${id}/build-from-scratch`)
    return data
  },

  async exportDocumentation(
    id: string,
    format: string,
    sections?: string[]
  ): Promise<Blob> {
    const { data } = await api.get(`/api/documentation/${id}/export/${format}`, {
      params: sections ? { sections: sections.join(",") } : undefined,
      responseType: "blob",
    })
    return data
  },
}

export const chatService = {
  async send(
    repositoryId: string,
    message: string
  ): Promise<ChatMessage> {
    const { data } = await api.post("/chat", {
      repository_id: repositoryId,
      message,
    })
    return data
  },

  async sendStream(
    repositoryId: string,
    message: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await api.post(
      "/chat/stream",
      { repository_id: repositoryId, message },
      { responseType: "stream" }
    )
    const reader = response.data.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onChunk(decoder.decode(value))
    }
  },
}

export default api
