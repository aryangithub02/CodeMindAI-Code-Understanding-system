import axios from "axios"
import { API_BASE_URL } from "@/lib/constants"
import { generateBuildPlan } from "@/app/api/documentation/generate-build-plan"
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

// Local Storage Caching Helpers
const LOCAL_STORAGE_KEY = "codemind-local-repos"

interface LocalRepoBundle {
  repository: Repository
  fileTree: RepositoryTreeNode[]
  fileContents: Record<string, string>
  analysis: AnalysisResult
  onboardingPlan: OnboardingPlan
}

function getLocalRepos(): Record<string, LocalRepoBundle> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalRepo(id: string, bundle: LocalRepoBundle) {
  if (typeof window === "undefined") return
  try {
    const repos = getLocalRepos()
    repos[id] = bundle
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(repos))
  } catch (e) {
    console.error("Failed to save repo to local storage:", e)
  }
}

function deleteLocalRepo(id: string) {
  if (typeof window === "undefined") return
  try {
    const repos = getLocalRepos()
    if (repos[id]) {
      delete repos[id]
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(repos))
    }
  } catch (e) {
    console.error("Failed to delete repo from local storage:", e)
  }
}

export const repositoryService = {
  async upload(formData: FormData): Promise<Repository> {
    const { data } = await api.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    
    // Server returns the full bundle
    if (data && data.repository) {
      saveLocalRepo(data.repository.id, data)
      return data.repository
    }
    return data
  },

  async uploadFromUrl(url: string): Promise<Repository> {
    const { data } = await api.post("/api/upload/url", { url })
    
    // Server returns the full bundle
    if (data && data.repository) {
      saveLocalRepo(data.repository.id, data)
      return data.repository
    }
    return data
  },

  async getAll(): Promise<Repository[]> {
    let serverRepos: Repository[] = []
    try {
      const { data } = await api.get("/api/repositories")
      serverRepos = data
    } catch (e) {
      console.error("Failed to fetch repositories from server:", e)
    }

    const localRepos = getLocalRepos()
    const mergedRepos = [...serverRepos]
    for (const key of Object.keys(localRepos)) {
      if (!mergedRepos.some(r => r.id === key)) {
        mergedRepos.push(localRepos[key].repository)
      }
    }
    return mergedRepos
  },

  async getById(id: string): Promise<Repository> {
    const local = getLocalRepos()[id]
    if (local && local.repository) {
      return local.repository
    }
    const { data } = await api.get(`/api/repository/${id}`)
    return data
  },

  async getFileTree(id: string): Promise<RepositoryTreeNode[]> {
    const local = getLocalRepos()[id]
    if (local && local.fileTree) {
      return local.fileTree
    }
    const { data } = await api.get(`/api/repository/${id}/tree`)
    return data
  },

  async getFileContent(id: string, path: string): Promise<string> {
    const local = getLocalRepos()[id]
    if (local && local.fileContents && local.fileContents[path] !== undefined) {
      return local.fileContents[path]
    }
    const { data } = await api.get(`/api/repository/${id}/file`, { params: { path } })
    return data.content
  },

  async getAnalysis(id: string): Promise<ArchitectureAnalysis> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.architecture) {
      return local.analysis.architecture
    }
    const { data } = await api.get(`/api/architecture/${id}`)
    return data
  },

  async getDataFlow(id: string): Promise<AnalysisResult["dataFlow"]> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.dataFlow) {
      return local.analysis.dataFlow
    }
    const { data } = await api.get(`/api/dataflow/${id}`)
    return data
  },

  async getDataFlowAnalysis(id: string): Promise<{
    summary: string; strengths: string[]; weaknesses: string[]; risks: string[]; recommendations: string[]
  }> {
    const local = getLocalRepos()[id]
    if (local && local.analysis) {
      const contents = local.fileContents || {}
      const repoName = local.repository.name
      
      const svcCount = Object.keys(contents).filter(p => /service/i.test(p)).length
      const extCount = Object.keys(contents).filter(p => /stripe|aws|openai/i.test(p)).length
      const hasDb = Object.keys(contents).some(p => /database|schema|model/i.test(p))
      const hasAuth = Object.keys(contents).some(p => /auth|login|token/i.test(p))
      
      return {
        summary: `${repoName} follows a layered request-processing architecture. Requests flow through ${svcCount || 1} service layer(s)${hasDb ? " before reaching persistent storage" : ""}. ${hasAuth ? "Authentication gates most protected routes." : ""}`,
        strengths: [
          `${svcCount > 1 ? "Well-separated service layer with clear boundaries" : "Service layer encapsulates business logic"}`,
          hasDb ? "Data persistence layer isolated behind repository abstractions" : "Clear request processing pipeline",
          "Animated flow visualization shows request movement"
        ],
        weaknesses: [
          "Limited flow diversity - fewer distinct processing stages",
          "Data transformation steps are implicit rather than explicitly documented"
        ],
        risks: [
          hasAuth ? "Authentication service is a single point of failure for all protected routes" : "No authentication layer detected",
          hasDb ? "Database is a bottleneck for all operations" : "No persistent storage detected"
        ],
        recommendations: [
          hasDb ? "Add read replicas and caching layer (Redis) to reduce database bottleneck" : "Consider adding persistent storage",
          "Introduce distributed tracing for production flow monitoring"
        ]
      }
    }
    const { data } = await api.get(`/api/dataflow/${id}/analysis`)
    return data
  },

  async getDataFlowJourneys(id: string): Promise<{ journeys: DataFlowJourney[] }> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.dataFlow) {
      const df = local.analysis.dataFlow
      if (df.analysis?.flows) {
        return { journeys: df.analysis.flows }
      }
      const journeys: DataFlowJourney[] = (df.flow || []).map((stepText, idx) => ({
        id: `journey-${idx}`,
        label: `Flow Step ${idx + 1}`,
        description: stepText,
        nodeIds: [],
        edgeIds: [],
        color: "#3B82F6",
      }))
      return { journeys }
    }
    const { data } = await api.get(`/api/dataflow/${id}/journeys`)
    return data
  },

  async getDataFlowMetrics(id: string): Promise<{ metrics: FlowMetrics; bottlenecks: FlowBottleneck[] }> {
    const flow = await this.getDataFlow(id)
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.dataFlow) {
      const df = local.analysis.dataFlow
      return {
        metrics: {
          totalFlows: df.metrics?.totalFlows ?? 0,
          requestFlows: df.metrics?.requestFlows ?? 0,
          databaseFlows: df.metrics?.databaseFlows ?? 0,
          externalAPIs: df.metrics?.externalAPIs ?? 0,
          bottlenecks: df.metrics?.bottlenecks ?? 0,
          riskScore: df.metrics?.riskScore ?? "Low",
        },
        bottlenecks: df.bottlenecks ?? [],
      }
    }
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
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.documentation) {
      return local.analysis.documentation
    }
    const { data } = await api.get(`/api/documentation/${id}`)
    return data
  },

  async getOnboarding(id: string): Promise<OnboardingPlan> {
    const local = getLocalRepos()[id]
    if (local && local.onboardingPlan) {
      return local.onboardingPlan
    }
    const { data } = await api.get(`/api/onboarding/${id}`)
    return data
  },

  async delete(id: string): Promise<void> {
    deleteLocalRepo(id)
    try {
      await api.delete(`/api/repository/${id}`)
    } catch (e) {
      console.error("Failed to delete repository from server:", e)
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    let serverStats: DashboardStats = {
      totalRepositories: 0,
      totalFiles: 0,
      totalClasses: 0,
      totalFunctions: 0,
      architectureStyle: "N/A",
      riskLevel: "Low",
      circularDependencies: 0,
    }
    try {
      const { data } = await api.get("/api/dashboard/stats")
      serverStats = data
    } catch (e) {
      console.error("Failed to fetch dashboard stats from server:", e)
    }

    const localRepos = getLocalRepos()
    const localCount = Object.keys(localRepos).length
    if (localCount === 0) return serverStats

    let extraFiles = 0
    let extraClasses = 0
    let extraFunctions = 0
    let extraCircular = 0

    for (const key of Object.keys(localRepos)) {
      const r = localRepos[key].repository
      extraFiles += r.totalFiles || 0
      extraClasses += r.totalClasses || 0
      extraFunctions += r.totalFunctions || 0
      const analysis = localRepos[key].analysis
      extraCircular += analysis?.dependencies?.circularDependencies?.length || 0
    }

    return {
      totalRepositories: serverStats.totalRepositories + localCount,
      totalFiles: serverStats.totalFiles + extraFiles,
      totalClasses: serverStats.totalClasses + extraClasses,
      totalFunctions: serverStats.totalFunctions + extraFunctions,
      architectureStyle: serverStats.architectureStyle && serverStats.architectureStyle !== "N/A" 
        ? serverStats.architectureStyle 
        : "Layered & MVC",
      riskLevel: serverStats.riskLevel || "Low",
      circularDependencies: serverStats.circularDependencies + extraCircular,
    }
  },

  async getArchitectureInsights(id: string): Promise<ArchitectureInsightResponse> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.architecture) {
      const arch = local.analysis.architecture
      const strengths = arch.insights?.filter((i: any) => i.type === "strength").map((i: any) => i.description) || []
      const weaknesses = arch.insights?.filter((i: any) => i.type === "weakness").map((i: any) => i.description) || []
      const risks = arch.insights?.filter((i: any) => i.type === "risk").map((i: any) => i.description) || []
      const recommendations = arch.insights?.filter((i: any) => i.type === "recommendation").map((i: any) => i.description) || []
      return {
        strengths,
        weaknesses,
        risks,
        recommendations,
        summary: arch.summary || "",
        architectureType: arch.type || "Layered",
        complexity: arch.complexity?.level || "Medium",
        maintainability: arch.maintainabilityScore || 70,
      }
    }
    const { data } = await api.get(`/api/architecture/${id}/insights`)
    return data
  },

  async getArchitectureGraph(id: string): Promise<ArchitectureGraphResponse> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.architecture) {
      return {
        nodes: local.analysis.architecture.nodes || [],
        edges: local.analysis.architecture.edges || [],
      }
    }
    const { data } = await api.get(`/api/architecture/${id}/graph`)
    return data
  },

  async getArchitectureMetrics(id: string): Promise<ArchitectureMetrics> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.architecture) {
      return local.analysis.architecture.metrics
    }
    const { data } = await api.get(`/api/architecture/${id}/metrics`)
    return data
  },

  async getDocumentationSections(id: string): Promise<DocumentationSection[]> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.documentation) {
      const doc = local.analysis.documentation
      return Object.keys(doc).map(key => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
      }))
    }
    const { data } = await api.get(`/api/documentation/${id}/sections`)
    return data
  },

  async getDocumentationSection(id: string, sectionId: string): Promise<string> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.documentation) {
      const doc = local.analysis.documentation as unknown as Record<string, string>
      if (doc[sectionId] !== undefined) {
        return doc[sectionId]
      }
    }
    const { data } = await api.get(`/api/documentation/${id}/section/${sectionId}`)
    return typeof data === "string" ? data : data.content
  },

  async getAIDocumentation(id: string): Promise<AIDocumentationContent> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.documentation) {
      const doc = local.analysis.documentation
      return {
        summary: doc.ai_guide || doc.overview || "AI generated guide based on local repository context.",
        architecture: doc.architecture || "Architecture details from local repository context.",
        onboarding: doc.setup || "Setup and onboarding instructions from local repository context.",
        generated_at: new Date().toISOString()
      }
    }
    const { data } = await api.get(`/api/documentation/${id}/ai`)
    return data
  },

  async getBuildFromScratch(id: string): Promise<BuildFromScratchPlan> {
    const local = getLocalRepos()[id]
    if (local && local.analysis && local.analysis.architecture) {
      return generateBuildPlan(local.repository.name, local.analysis.architecture, local.fileTree || [])
    }
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
