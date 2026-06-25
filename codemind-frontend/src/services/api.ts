import axios from "axios"
import JSZip from "jszip"
import { API_BASE_URL } from "@/lib/constants"
import { generateBuildPlan } from "@/app/api/documentation/generate-build-plan"
import { analyzeArchitecture } from "@/app/api/architecture/architecture-analyzer"
import { generateDocumentation } from "@/app/api/documentation/generate-documentation"
import { generateOnboardingPlan } from "@/app/api/onboarding/generate-onboarding"
import { extractDataFlow } from "@/app/api/dataflow/extract-dataflow"
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

// IndexedDB Helper implementation
const DB_NAME = "codemind-db"
const DB_VERSION = 1
const STORE_NAME = "repositories"

export interface LocalRepoBundle {
  repository: Repository
  fileTree: RepositoryTreeNode[]
  fileContents: Record<string, string>
  analysis: AnalysisResult
  onboardingPlan: OnboardingPlan
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser"))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getDBRepo(id: string): Promise<LocalRepoBundle | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("Failed to read from IndexedDB:", e)
    return null
  }
}

async function saveDBRepo(bundle: LocalRepoBundle): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ id: bundle.repository.id, ...bundle })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("Failed to write to IndexedDB:", e)
  }
}

async function deleteDBRepo(id: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("Failed to delete from IndexedDB:", e)
  }
}

async function getAllDBRepos(): Promise<LocalRepoBundle[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("Failed to list from IndexedDB:", e)
    return []
  }
}

async function ensureLocalRepoBundle(id: string): Promise<LocalRepoBundle | null> {
  const local = await getDBRepo(id)
  if (local && local.analysis && local.analysis.architecture && local.analysis.dataFlow) {
    return local
  }

  // Fallback to fetch from server or reconstruct
  let repo: Repository | null = null
  let tree: RepositoryTreeNode[] = []
  let contents: Record<string, string> = {}

  try {
    if (local && local.repository) {
      repo = local.repository
    } else {
      const { data } = await api.get(`/api/repository/${id}`)
      repo = data
    }

    if (local && local.fileTree && local.fileTree.length > 0) {
      tree = local.fileTree
    } else {
      const { data } = await api.get(`/api/repository/${id}/tree`)
      tree = data
    }

    if (local && local.fileContents && Object.keys(local.fileContents).length > 0) {
      contents = local.fileContents
    }
  } catch (e) {
    console.warn(`Could not load basic repository details for ${id} from server:`, e)
    if (local && local.repository && local.fileTree) {
      repo = local.repository
      tree = local.fileTree
    }
  }

  if (!repo) {
    if (id === "repo-1") {
      repo = {
        id: "repo-1", name: "e-commerce-api", url: "", language: "TypeScript", framework: "NestJS",
        totalFiles: 42, totalLines: 12450, totalClasses: 18, totalFunctions: 124, status: "complete",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
    } else if (id === "repo-2") {
      repo = {
        id: "repo-2", name: "codemind-backend", url: "", language: "Python", framework: "FastAPI",
        totalFiles: 28, totalLines: 6720, totalClasses: 12, totalFunctions: 84, status: "complete",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
    } else {
      return null
    }
  }

  if (!tree || tree.length === 0) {
    if (id === "repo-1") {
      tree = [
        { name: "src", type: "directory", path: "src", children: [
          { name: "auth", type: "directory", path: "src/auth", children: [
            { name: "auth.controller.ts", type: "file", path: "src/auth/auth.controller.ts" },
            { name: "auth.service.ts", type: "file", path: "src/auth/auth.service.ts" },
          ]}
        ]}
      ]
    } else if (id === "repo-2") {
      tree = [
        { name: "app", type: "directory", path: "app", children: [
          { name: "main.py", type: "file", path: "app/main.py" }
        ]}
      ]
    } else {
      return null
    }
  }

  try {
    const realAnalysis = await analyzeArchitecture(tree, contents, repo.name)
    const graphNodes: { id: string; label: string; type: "file" | "class" | "function" | "module"; filePath?: string }[] = []
    const graphEdges: { source: string; target: string; relation: string }[] = []
    
    for (const node of realAnalysis.nodes) {
      graphNodes.push({ id: node.id, label: node.label, type: node.type === "entry" ? "file" : "module" })
    }
    for (const edge of realAnalysis.edges) {
      graphEdges.push({ source: edge.source, target: edge.target, relation: edge.relation.toLowerCase() })
    }

    const dataFlowExtracted = extractDataFlow(tree, contents, repo.name)

    const analysis: AnalysisResult = {
      repository: repo,
      architecture: realAnalysis,
      dependencies: {
        graph: { nodes: graphNodes, edges: graphEdges },
        hotspots: [],
        circularDependencies: [],
        externalDependencies: realAnalysis.externalAPIs,
        summary: { filesWithImports: 0, totalImportStatements: 0, uniqueExternalDependencies: realAnalysis.externalAPIs.length },
      },
      dataFlow: {
        routes: dataFlowExtracted.routes,
        flow: [`${repo.name} — ${tree.length} files analyzed`],
        sequenceDiagram: `sequenceDiagram\n  participant Dev as Developer\n  participant Repo as ${repo.name}\n  Dev->>+Repo: Analyze\n  Repo-->>-Dev: ${tree.length} files`,
        flowDiagram: `flowchart LR\n  A[${repo.name}] --> B[${repo.language}]`,
        architectureDiagram: `graph TD\n  A[${repo.name}] --> B[${repo.language}]`,
      },
      documentation: generateDocumentation(repo.name, realAnalysis, tree, contents),
      security: [],
      quality: [],
    }

    const onboardingPlan = generateOnboardingPlan(tree, analysis)

    const bundle: LocalRepoBundle = {
      repository: repo,
      fileTree: tree,
      fileContents: contents,
      analysis,
      onboardingPlan,
    }

    await saveDBRepo(bundle)
    return bundle
  } catch (err) {
    console.error("Failed to build local repository bundle client-side:", err)
    return null
  }
}

// ZIP and Analysis Fallback Helpers
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", "env", ".next", "dist", "build", ".github", ".vscode", "vendor", ".idea", "target", ".tox", ".eggs", "egg-info", ".mypy_cache", ".pytest_cache", ".yarn", ".yarn-cache", "bower_components", "elm-stuff", ".stack-work", ".gradle"])
const EXCLUDED_FILES = new Set(["package-lock.json", "yarn.lock", ".DS_Store", "Thumbs.db", "*.pyc"])

function detectLanguage(ext: string): string {
  const langMap: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python", ".rb": "Ruby", ".go": "Go", ".rs": "Rust", ".java": "Java",
    ".kt": "Kotlin", ".swift": "Swift", ".c": "C", ".cpp": "C++", ".h": "C",
    ".cs": "C#", ".php": "PHP", ".r": "R", ".scala": "Scala", ".ex": "Elixir",
    ".exs": "Elixir", ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
    ".css": "CSS", ".scss": "SCSS", ".less": "Less", ".html": "HTML",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".xml": "XML",
    ".md": "Markdown", ".sql": "SQL", ".sh": "Shell", ".bash": "Shell",
    ".dockerfile": "Dockerfile", ".tf": "Terraform",
  }
  return langMap[ext.toLowerCase()] || "Other"
}

function shouldExclude(path: string, type: "blob" | "tree"): boolean {
  const parts = path.split("/")
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true
  }
  if (type === "blob") {
    const name = parts[parts.length - 1]
    if (EXCLUDED_FILES.has(name)) return true
    if (name.endsWith(".pyc") || name.endsWith(".pyo") || name.endsWith(".so") || name.endsWith(".dll") || name.endsWith(".exe") || name.endsWith(".min.js") || name.endsWith(".min.css")) return true
  }
  return false
}

function buildTreeFromPaths(paths: string[]): RepositoryTreeNode[] {
  const root: RepositoryTreeNode[] = []
  
  function getOrCreateDir(nodes: RepositoryTreeNode[], name: string, fullPath: string): RepositoryTreeNode {
    let dir = nodes.find(n => n.name === name && n.type === "directory")
    if (!dir) {
      dir = { name, type: "directory", path: fullPath, children: [] }
      nodes.push(dir)
    }
    return dir
  }
  
  for (const p of paths) {
    const parts = p.split("/")
    let currentLevel = root
    let accumulatedPath = ""
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part
      
      if (i === parts.length - 1) {
        currentLevel.push({ name: part, type: "file", path: p })
      } else {
        const dir = getOrCreateDir(currentLevel, part, accumulatedPath)
        currentLevel = dir.children!
      }
    }
  }
  
  function sortNodes(nodes: RepositoryTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children)
      }
    }
  }
  
  sortNodes(root)
  return root
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

async function downloadGithubZip(owner: string, repo: string, branch: string): Promise<ArrayBuffer> {
  const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download zipball for branch ${branch}`)
  }
  return res.arrayBuffer()
}

async function processZipFile(arrayBuffer: ArrayBuffer, repoName: string, customRepoId?: string, url?: string): Promise<LocalRepoBundle> {
  const repoId = customRepoId || `repo-${Math.random().toString(36).slice(2, 9)}`
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  const fileItems: { path: string; size: number }[] = []
  const zipKeys = Object.keys(zip.files)
  
  // Strip leading directory if zip contains everything in a single root folder
  let firstDir = ""
  if (zipKeys.length > 0) {
    const parts = zipKeys[0].split("/")
    if (parts.length > 1 && zipKeys.every(k => k.startsWith(parts[0] + "/"))) {
      firstDir = parts[0]
    }
  }

  zip.forEach((relativePath, fileEntry) => {
    if (fileEntry.dir) return
    let cleanPath = relativePath
    if (firstDir && relativePath.startsWith(firstDir + "/")) {
      cleanPath = relativePath.substring(firstDir.length + 1)
    }

    if (!cleanPath) return
    if (shouldExclude(cleanPath, "blob")) return

    fileItems.push({ path: cleanPath, size: (fileEntry as any)._data?.uncompressedSize || 0 })
  })

  // Build file tree
  const treeNodes = buildTreeFromPaths(fileItems.map(f => f.path))

  // Parse file contents (up to 100 files)
  const MAX_FILES = 100
  const contentsToFetch = fileItems.slice(0, MAX_FILES)
  const fetchedContents: Record<string, string> = {}

  let totalLines = 0
  const extCount = new Map<string, number>()

  for (const item of contentsToFetch) {
    const zipPath = firstDir ? `${firstDir}/${item.path}` : item.path
    const fileEntry = zip.files[zipPath]
    if (fileEntry) {
      const content = await fileEntry.async("string")
      fetchedContents[item.path] = content
      const lines = content.split("\n").length
      totalLines += lines

      const ext = item.path.includes(".") ? "." + item.path.split(".").pop()!.toLowerCase() : ""
      if (ext) extCount.set(ext, (extCount.get(ext) || 0) + 1)
    }
  }

  // Language detection
  const langFromExt = [...extCount.entries()].sort((a, b) => b[1] - a[1])
  const detectedLanguage = langFromExt.length > 0 ? detectLanguage(langFromExt[0][0]) : "Unknown"

  // Run architecture analysis
  const realAnalysis = await analyzeArchitecture(treeNodes, fetchedContents, repoName)

  // Create repository metadata object
  const repository: Repository = {
    id: repoId,
    name: repoName,
    url: url || "",
    language: detectedLanguage,
    framework: Object.keys(realAnalysis.frameworks)[0] || "",
    totalFiles: fileItems.length,
    totalLines: totalLines,
    totalClasses: realAnalysis.metrics.totalClasses || 0,
    totalFunctions: realAnalysis.metrics.totalFunctions || 0,
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Generate module dependencies graph data
  const graphNodes: { id: string; label: string; type: "file" | "class" | "function" | "module"; filePath?: string }[] = []
  const graphEdges: { source: string; target: string; relation: string }[] = []
  
  for (const node of realAnalysis.nodes) {
    graphNodes.push({
      id: node.id,
      label: node.label,
      type: node.type === "entry" ? "file" : "module",
    })
  }
  for (const edge of realAnalysis.edges) {
    graphEdges.push({
      source: edge.source,
      target: edge.target,
      relation: edge.relation.toLowerCase(),
    })
  }

  const analysis: AnalysisResult = {
    repository,
    architecture: realAnalysis,
    dependencies: {
      graph: { nodes: graphNodes, edges: graphEdges },
      hotspots: [],
      circularDependencies: [],
      externalDependencies: realAnalysis.externalAPIs,
      summary: { filesWithImports: 0, totalImportStatements: 0, uniqueExternalDependencies: realAnalysis.externalAPIs.length },
    },
    dataFlow: {
      routes: [],
      flow: [`${repoName} — ${fileItems.length} files analyzed`],
      sequenceDiagram: `sequenceDiagram\n  participant Dev as Developer\n  participant Repo as ${repoName}\n  Dev->>+Repo: Analyze\n  Repo-->>-Dev: ${fileItems.length} files, ${totalLines} lines`,
      flowDiagram: `flowchart LR\n  A[${repoName}] --> B[${detectedLanguage}]\n  B --> C[${fileItems.length} files]`,
      architectureDiagram: `graph TD\n  A[${repoName}] --> B[${detectedLanguage}]`,
    },
    documentation: generateDocumentation(repoName, realAnalysis, treeNodes, fetchedContents),
    security: [],
    quality: [],
  }

  const onboardingPlan = generateOnboardingPlan(treeNodes, analysis)

  return {
    repository,
    fileTree: treeNodes,
    fileContents: fetchedContents,
    analysis,
    onboardingPlan,
  }
}

export const repositoryService = {
  async upload(formData: FormData): Promise<Repository> {
    try {
      const { data } = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      
      if (data && data.repository) {
        await saveDBRepo(data)
        return data.repository
      }
    } catch (e) {
      console.warn("Backend ZIP upload failed, running browser-side static analysis:", e)
    }

    const file = formData.get("file") as File | null
    if (!file) {
      throw new Error("No file uploaded")
    }

    const repoName = file.name.replace(/\.[^/.]+$/, "")
    const arrayBuffer = await file.arrayBuffer()
    const bundle = await processZipFile(arrayBuffer, repoName)
    await saveDBRepo(bundle)
    return bundle.repository
  },

  async uploadFromUrl(url: string): Promise<Repository> {
    try {
      const { data } = await api.post("/api/upload/url", { url })
      if (data && data.repository) {
        await saveDBRepo(data)
        return data.repository
      }
    } catch (e) {
      console.warn("Backend URL import failed, running browser-side fallback import:", e)
    }

    const parsed = parseGitHubUrl(url)
    if (!parsed) {
      throw new Error("Invalid GitHub URL. Must be like https://github.com/owner/repo")
    }

    const { owner, repo } = parsed
    const repoId = `repo-${Math.random().toString(36).slice(2, 9)}`

    let defaultBranch = "main"
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
      if (repoRes.ok) {
        const repoData = await repoRes.json()
        defaultBranch = repoData.default_branch || "main"
      }
    } catch (e) {
      console.warn("Failed to fetch default branch metadata, defaulting to 'main':", e)
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await downloadGithubZip(owner, repo, defaultBranch)
    } catch (e) {
      try {
        arrayBuffer = await downloadGithubZip(owner, repo, "master")
        defaultBranch = "master"
      } catch (e2) {
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`)}`
          const res = await fetch(proxyUrl)
          if (!res.ok) throw new Error()
          arrayBuffer = await res.arrayBuffer()
        } catch {
          throw new Error(`Failed to download repository zip from branch ${defaultBranch} or master. Make sure the repository is public.`)
        }
      }
    }

    const bundle = await processZipFile(arrayBuffer, repo, repoId, url)
    await saveDBRepo(bundle)
    return bundle.repository
  },

  async getAll(): Promise<Repository[]> {
    let serverRepos: Repository[] = []
    try {
      const { data } = await api.get("/api/repositories")
      serverRepos = data
    } catch (e) {
      console.error("Failed to fetch repositories from server:", e)
    }

    const localBundles = await getAllDBRepos()
    const mergedRepos = [...serverRepos]
    for (const bundle of localBundles) {
      if (!mergedRepos.some(r => r.id === bundle.repository.id)) {
        mergedRepos.push(bundle.repository)
      }
    }
    return mergedRepos
  },

  async getById(id: string): Promise<Repository> {
    const local = await getDBRepo(id)
    if (local && local.repository) {
      return local.repository
    }
    const { data } = await api.get(`/api/repository/${id}`)
    return data
  },

  async getFileTree(id: string): Promise<RepositoryTreeNode[]> {
    const local = await getDBRepo(id)
    if (local && local.fileTree) {
      return local.fileTree
    }
    const { data } = await api.get(`/api/repository/${id}/tree`)
    return data
  },

  async getFileContent(id: string, path: string): Promise<string> {
    const local = await getDBRepo(id)
    if (local && local.fileContents && local.fileContents[path] !== undefined) {
      return local.fileContents[path]
    }
    const { data } = await api.get(`/api/repository/${id}/file`, { params: { path } })
    return data.content
  },

  async getAnalysis(id: string): Promise<ArchitectureAnalysis> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.architecture) {
      return bundle.analysis.architecture
    }
    const { data } = await api.get(`/api/architecture/${id}`)
    return data
  },

  async getDataFlow(id: string): Promise<AnalysisResult["dataFlow"]> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.dataFlow) {
      const extracted = extractDataFlow(bundle.fileTree || [], bundle.fileContents || {}, bundle.repository.name)
      return {
        ...bundle.analysis.dataFlow,
        nodes: extracted.nodes,
        edges: extracted.edges,
        flows: extracted.flows,
        routes: extracted.routes.length > 0 ? extracted.routes : bundle.analysis.dataFlow.routes,
        metrics: extracted.metrics,
        bottlenecks: extracted.bottlenecks,
        mermaidDiagram: extracted.mermaidDiagram,
      } as any
    }
    const { data } = await api.get(`/api/dataflow/${id}`)
    return data
  },

  async getDataFlowAnalysis(id: string): Promise<{
    summary: string; strengths: string[]; weaknesses: string[]; risks: string[]; recommendations: string[]
  }> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis) {
      const extracted = extractDataFlow(bundle.fileTree || [], bundle.fileContents || {}, bundle.repository.name)
      const nodeCount = extracted.nodes.length
      const edgeCount = extracted.edges.length
      const svcCount = extracted.nodes.filter(n => n.type === "service").length
      const extCount = extracted.nodes.filter(n => n.type === "external").length
      const hasDb = extracted.nodes.some(n => n.type === "database")
      const hasAuth = extracted.nodes.some(n => /auth|login|token/i.test(n.label))

      return {
        summary: `${bundle.repository.name} follows a layered request-processing architecture with ${nodeCount} data flow nodes and ${edgeCount} data flow connections. Requests flow through ${svcCount} service layer(s)${hasDb ? " before reaching persistent storage" : ""}.${hasAuth ? " Authentication gates most protected routes." : ""}`,
        strengths: [
          `${svcCount > 1 ? "Well-separated service layer with clear boundaries" : "Service layer encapsulates business logic"}`,
          hasDb ? "Data persistence layer isolated behind repository abstractions" : "Clear request processing pipeline",
          extCount > 0 ? `Integrates with ${extCount} external service(s)` : "Self-contained architecture with minimal external coupling",
          "Animated flow visualization shows request movement"
        ],
        weaknesses: [
          nodeCount < 4 ? "Limited flow diversity — fewer distinct processing stages" : "Some flows may share intermediate processing nodes",
          extCount === 0 ? "No external API integrations detected — may limit functionality" : "External API calls introduce network latency",
          "Data transformation steps are implicit rather than explicitly documented"
        ],
        risks: [
          hasAuth ? "Authentication service is a single point of failure for all protected routes" : "No authentication layer detected — all routes are public",
          hasDb ? "Database is a bottleneck for all operations" : "No persistent storage detected — data may be lost on restart",
          ...(extCount > 0 ? [`${extCount} external service(s) create dependency risks — an outage could cascade`] : []),
          "Flow visualization relies on static analysis — async/event-driven flows may be underdetected"
        ],
        recommendations: [
          hasDb ? "Add read replicas and caching layer (Redis) to reduce database bottleneck" : "Consider adding persistent storage for production data",
          "Introduce distributed tracing (OpenTelemetry) for production flow monitoring",
          extCount > 0 ? `Add circuit breakers for ${extCount} external service call(s) to prevent cascade failures` : "Implement health checks and retry logic for external dependencies",
          "Add message queue (Kafka/RabbitMQ) for async flow processing to improve resilience",
          "Document data transformation contracts between layers for better maintainability"
        ]
      }
    }
    const { data } = await api.get(`/api/dataflow/${id}/analysis`)
    return data
  },

  async getDataFlowJourneys(id: string): Promise<{ journeys: DataFlowJourney[] }> {
    const dataFlow = await this.getDataFlow(id)
    return { journeys: (dataFlow as any).flows || [] }
  },

  async getDataFlowMetrics(id: string): Promise<{ metrics: FlowMetrics; bottlenecks: FlowBottleneck[] }> {
    const dataFlow = await this.getDataFlow(id)
    return {
      metrics: dataFlow.metrics || {
        totalFlows: 0,
        requestFlows: 0,
        databaseFlows: 0,
        externalAPIs: 0,
        bottlenecks: 0,
        riskScore: "Low",
      },
      bottlenecks: dataFlow.bottlenecks || [],
    }
  },

  async getDocumentation(id: string): Promise<AnalysisResult["documentation"]> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.documentation) {
      return bundle.analysis.documentation
    }
    const { data } = await api.get(`/api/documentation/${id}`)
    return data
  },

  async getOnboarding(id: string): Promise<OnboardingPlan> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.onboardingPlan) {
      return bundle.onboardingPlan
    }
    const { data } = await api.get(`/api/onboarding/${id}`)
    return data
  },

  async delete(id: string): Promise<void> {
    await deleteDBRepo(id)
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

    const localBundles = await getAllDBRepos()
    const localCount = localBundles.length
    if (localCount === 0) return serverStats

    let extraFiles = 0
    let extraClasses = 0
    let extraFunctions = 0
    let extraCircular = 0

    for (const bundle of localBundles) {
      const r = bundle.repository
      extraFiles += r.totalFiles || 0
      extraClasses += r.totalClasses || 0
      extraFunctions += r.totalFunctions || 0
      const analysis = bundle.analysis
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
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.architecture) {
      const arch = bundle.analysis.architecture
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
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.architecture) {
      return {
        nodes: bundle.analysis.architecture.nodes || [],
        edges: bundle.analysis.architecture.edges || [],
      }
    }
    const { data } = await api.get(`/api/architecture/${id}/graph`)
    return data
  },

  async getArchitectureMetrics(id: string): Promise<ArchitectureMetrics> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.architecture) {
      return bundle.analysis.architecture.metrics
    }
    const { data } = await api.get(`/api/architecture/${id}/metrics`)
    return data
  },

  async getDocumentationSections(id: string): Promise<DocumentationSection[]> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.documentation) {
      const doc = bundle.analysis.documentation
      const metadataMap: Record<string, { label: string, description: string, icon: string, category: string, complexity: "Low" | "Medium" | "High" | "Critical" }> = {
        overview: { label: "Repository Overview", description: "Project summary, tech stack, statistics", icon: "BookOpen", category: "Overview", complexity: "Low" },
        architecture: { label: "Architecture Docs", description: "Patterns, layers, modules, diagrams", icon: "Cpu", category: "Architecture", complexity: "High" },
        api: { label: "API Documentation", description: "Endpoints, schemas, auth, errors", icon: "Globe", category: "API", complexity: "Medium" },
        services: { label: "Service Documentation", description: "Core services and their responsibilities", icon: "FileText", category: "Services", complexity: "Medium" },
        database: { label: "Database Docs", description: "Tables, relationships, indexes, queries", icon: "Database", category: "Database", complexity: "Medium" },
        dependencies: { label: "Dependency Docs", description: "Module graph, hotspots, circular deps", icon: "Share2", category: "Dependencies", complexity: "High" },
        dataflow: { label: "Data Flow Docs", description: "Request lifecycle, sequence diagrams", icon: "Activity", category: "Flows", complexity: "High" },
        setup: { label: "Setup Documentation", description: "Installation, configuration, prerequisites", icon: "Wrench", category: "Deployment", complexity: "Low" },
        deployment: { label: "Deployment Docs", description: "Docker, CI/CD, production guide", icon: "Rocket", category: "Deployment", complexity: "Medium" },
        ai_guide: { label: "AI Repository Guide", description: "AI analysis, recommendations, onboarding", icon: "Bot", category: "AI", complexity: "Low" },
      }
      return Object.keys(doc).map(key => {
        const meta = metadataMap[key] || {
          label: key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
          description: "Documentation section",
          icon: "BookOpen",
          category: "Other",
          complexity: "Low"
        }
        return {
          id: key,
          ...meta
        }
      })
    }
    const { data } = await api.get(`/api/documentation/${id}/sections`)
    return data
  },

  async getDocumentationSection(id: string, sectionId: string): Promise<string> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.documentation) {
      const doc = bundle.analysis.documentation as unknown as Record<string, string>
      if (doc[sectionId] !== undefined) {
        return doc[sectionId]
      }
    }
    const { data } = await api.get(`/api/documentation/${id}/section/${sectionId}`)
    return typeof data === "string" ? data : data.content
  },

  async getAIDocumentation(id: string): Promise<AIDocumentationContent> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.documentation) {
      const doc = bundle.analysis.documentation
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
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.architecture) {
      return generateBuildPlan(bundle.repository.name, bundle.analysis.architecture, bundle.fileTree || [])
    }
    const { data } = await api.get(`/api/documentation/${id}/build-from-scratch`)
    return data
  },

  async exportDocumentation(
    id: string,
    format: string,
    sections?: string[]
  ): Promise<Blob> {
    const bundle = await ensureLocalRepoBundle(id)
    if (bundle && bundle.analysis && bundle.analysis.documentation) {
      const doc = bundle.analysis.documentation as unknown as Record<string, string>
      const targetSections = sections && sections.length > 0 ? sections : Object.keys(doc)
      let combinedContent = ""
      for (const sectionId of targetSections) {
        if (doc[sectionId]) {
          combinedContent += `\n# ${sectionId.charAt(0).toUpperCase() + sectionId.slice(1).replace("_", " ")}\n\n${doc[sectionId]}\n\n`
        }
      }

      if (format === "markdown" || format === "md") {
        return new Blob([combinedContent], { type: "text/markdown;charset=utf-8" })
      } else if (format === "html") {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${bundle.repository.name} Documentation</title>
            <style>
              body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
              pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
              code { font-family: monospace; background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            ${combinedContent.replace(/\n/g, "<br>")}
          </body>
          </html>
        `
        return new Blob([htmlContent], { type: "text/html;charset=utf-8" })
      } else {
        return new Blob([combinedContent], { type: "text/plain;charset=utf-8" })
      }
    }

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

  async clientSideChat(
    messageText: string,
    openRouterKey: string,
    codebaseContext: any,
    messagesHistory: any[],
    mode: string
  ): Promise<Response> {
    const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"
    const SYSTEM_PROMPT = `You are CodeMind AI, an Enterprise Repository Intelligence Agent.

Your purpose is not to chat about code.

Your purpose is to fully understand a repository and help developers explore, analyze, maintain, document, secure, refactor, onboard, and scale software systems.

You operate as a Senior Software Architect, Principal Engineer, Security Auditor, Performance Engineer, Technical Writer, and Onboarding Mentor simultaneously.

You have access to:
* Repository Knowledge Graph
* Architecture Analysis
* Dependency Graph
* Data Flow Analysis
* Module Intelligence
* Documentation Intelligence
* Security Analysis
* Performance Analysis
* Onboarding Intelligence
* AI Insights Engine

==================================================
PRIMARY OBJECTIVE
=================

Before answering any question:
1. Understand the repository structure.
2. Locate relevant modules.
3. Locate relevant files.
4. Locate related services.
5. Locate related controllers.
6. Locate related repositories.
7. Locate related databases.
8. Locate related flows.
9. Locate related dependencies.
10. Locate risks and bottlenecks.

Then generate a repository-aware response.

Never answer purely from LLM knowledge if repository information exists.
Repository context always takes priority.

==================================================
RESPONSE PHILOSOPHY
===================

Act like:
* A senior engineer who has maintained this repository for years.
* An architect who understands every dependency.
* A technical lead explaining the system to new developers.

Avoid:
* Generic explanations.
* Hallucinated files.
* Assumptions not present in repository context.

Every statement should be grounded in repository intelligence.

==================================================
REPOSITORY REASONING PIPELINE
=============================

For every query:
Question
↓
Identify Subject
↓
Locate Related Files
↓
Locate Related Modules
↓
Locate Related Dependencies
↓
Locate Related Data Flows
↓
Locate Related Architecture Layers
↓
Generate Response

==================================================
MANDATORY RESPONSE SECTIONS
===========================

Every answer MUST include:

<architecture>
  <layer></layer>
  <module></module>
  <pattern></pattern>
</architecture>

---

<visual_card>
  <metric name="Files" value="" />
  <metric name="Classes" value="" />
  <metric name="Functions" value="" />
  <metric name="Flows" value="" />
  <metric name="Risk" value="" />
  <metric name="Dependencies" value="" />
</visual_card>

---

<actions>
  <action type="view_file" target=""></action>
  <action type="view_flow" target=""></action>
  <action type="view_architecture" target=""></action>
  <action type="view_risks" target=""></action>
</actions>

==================================================
MULTI-LEVEL EXPLANATIONS
========================

Whenever possible:

<explanation>
  <beginner>
    Explain for:
    * students
    * new developers
    * non-technical stakeholders
  </beginner>
  <developer>
    Explain:
    * files
    * routes
    * classes
    * functions
    * services
    * database usage
  </developer>
  <architect>
    Explain:
    * architecture style
    * scalability
    * coupling
    * maintainability
    * future growth
  </architect>
</explanation>

==================================================
FILE ANALYSIS MODE
==================

When user asks about a file:
Return:
Purpose
Responsibilities
Dependencies
Consumers
Functions
Database Usage
Risks
Technical Debt
Refactoring Suggestions

==================================================
MODULE ANALYSIS MODE
====================

When user asks about a module:
Return:
Purpose
Files
Classes
Functions
Consumers
Dependencies
Flows
Security
Risks
Metrics
Architecture Role

==================================================
FUNCTION ANALYSIS MODE
======================

When user asks about a function:
Return:
Purpose
Parameters
Returns
Callers
Callees
Database Operations
Complexity
Risks
Optimization Opportunities

==================================================
FLOW ANALYSIS MODE
==================

When user asks about a flow:
Return:
Flow Name
Purpose
Entry Point
Route
Controllers
Services
Repositories
Databases
External APIs
Transformations
Outputs
Dependencies
Performance
Risks
Business Impact

Generate:
Request Journey
User -> Route -> Controller -> Service -> Repository -> Database -> Response

==================================================
DEPENDENCY ANALYSIS MODE
========================

When user asks about dependencies:
Return:
Dependency Graph
Critical Dependencies
Circular Dependencies
Unused Dependencies
Risky Dependencies
Upgrade Recommendations

==================================================
SECURITY AUDITOR MODE
=====================

Check:
Authentication
Authorization
Validation
Secrets
JWT
OAuth
Database Security
Input Sanitization
Sensitive Data Exposure

Generate:
Risk Score (Low/Medium/High/Critical)
Vulnerabilities
Recommendations

==================================================
PERFORMANCE AUDITOR MODE
========================

Check:
Heavy Queries
Large Files
Deep Dependency Chains
Hot Paths
Repeated Computation
Memory Risks

Generate:
Performance Score
Bottlenecks
Optimization Plan

==================================================
REFACTORING MODE
================

Generate:
Architectural Problems
Code Smells
Coupling Problems
Technical Debt
Refactoring Plan
Migration Steps
Estimated Effort

==================================================
ONBOARDING MODE
===============

When a new developer asks about a system:
Generate:
Day 1
Day 2
Day 3
Files To Read
Flows To Learn
Architecture Concepts
Estimated Learning Time

==================================================
DOCUMENTATION MODE
==================

Generate professional documentation:
Overview
Purpose
Architecture
Modules
APIs
Flows
Dependencies
Database
Security
Deployment
Future Scope

==================================================
IMPACT ANALYSIS MODE
====================

When user asks: "What happens if X changes?"
Generate:
Affected Files
Affected Modules
Affected APIs
Affected Flows
Affected Database Operations
Business Impact
Risk Score

==================================================
REPOSITORY MEMORY
=================

Remember conversation context:
Current Module
Current File
Current Flow
Current Feature
Current Architecture Discussion
Use previous context automatically.

==================================================
FINAL RULE
==========

Never behave like a generic AI chatbot.
Behave like a Repository Intelligence Platform that understands architecture, flows, dependencies, documentation, security, onboarding, and system design.`

    const MODE_PROMPTS: Record<string, string> = {
      ask: `Focus on answering user questions in a general yet context-aware manner.`,
      architecture: `Focus deeply on the system's architecture. Analyze patterns (e.g. MVC, microservices, layered), module boundaries, layers (frontend, controllers, services, repositories, databases), and dependency direction. Discuss coupling and scalability.`,
      security: `Act as a Security Auditor. Perform a rigorous security review of the code and components related to the query. Check for proper JWT, password hashing, validation, authorization checks, and sensitive data exposure. Provide a clear security summary, a Risk Score (Low/Medium/High/Critical), specific Vulnerabilities, and Recommendations.`,
      performance: `Act as a Performance Auditor. Search for performance bottlenecks, heavy database queries, deep dependency chains, duplicate logic, and circular dependencies in the codebase.`,
      refactor: `Act as a Refactoring Assistant. Propose high-impact code improvement plans, detailing specific architectural problems, structural smells, coupling issues, a step-by-step Refactoring Plan, and estimated developer effort.`,
      onboarding: `Act as a Senior Developer onboarding a new engineer. Create a clear learning path (Day 1, Day 2, Day 3) for the query subject, list specific Files to Read, Flows to Understand, and core architectural concepts they need to master.`,
      documentation: `Focus on generating clean, professional, structure-oriented documentation for the query subject, explaining component roles, APIs, and integration details.`,
    }

    const formattedHistory = messagesHistory
      ? messagesHistory.map((m: any) => ({ role: m.role, content: m.content }))
      : []

    const modePrompt = MODE_PROMPTS[mode || "ask"] || MODE_PROMPTS.ask

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCURRENT MODE GUIDELINE: ${modePrompt}` },
      ...(codebaseContext
        ? [{ role: "system", content: `Repository context:\n${JSON.stringify(codebaseContext, null, 2)}` }]
        : []),
      ...formattedHistory,
      { role: "user", content: messageText },
    ]

    const response = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://codemind-ai.app",
        "X-Title": "CodeMind AI",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`)
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith("data: ")) continue

              const data = trimmed.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ""
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }

          if (buffer.trim()) {
            const data = buffer.trim().slice(6)
            if (data && data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ""
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("Stream error:", err)
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    })
  },
}

export default api
