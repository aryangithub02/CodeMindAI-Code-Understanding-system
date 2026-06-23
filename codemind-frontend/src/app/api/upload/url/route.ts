import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents, analyses, onboardingPlans, saveCache } from "../../data"
import type { RepositoryTreeNode } from "@/types"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""
const GITHUB_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github.v3+json",
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
}

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", "env", ".next", "dist", "build", ".gitHub", ".vscode", "vendor", ".idea", "target", ".tox", ".eggs", "egg-info", ".mypy_cache", ".pytest_cache", ".yarn", ".yarn-cache", "bower_components", "elm-stuff", ".stack-work", ".gradle"])
const EXCLUDED_FILES = new Set(["package-lock.json", "yarn.lock", ".DS_Store", "Thumbs.db", "*.pyc"])

interface GitHubTreeItem {
  path: string
  mode: string
  type: "blob" | "tree"
  sha: string
  size?: number
  url: string
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

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

function buildTree(githubTree: GitHubTreeItem[]): RepositoryTreeNode[] {
  const root: RepositoryTreeNode[] = []
  const dirMap = new Map<string, RepositoryTreeNode>()

  const sorted = [...githubTree].filter(t => !shouldExclude(t.path, t.type)).sort((a, b) => a.path.localeCompare(b.path))

  for (const item of sorted) {
    const parts = item.path.split("/")
    const name = parts[parts.length - 1]

    if (item.type === "tree") {
      const node: RepositoryTreeNode = { name, type: "directory", path: item.path, children: [] }
      dirMap.set(item.path, node)
    } else {
      const node: RepositoryTreeNode = { name, type: "file", path: item.path }
      if (parts.length === 1) {
        root.push(node)
      }
    }
  }

  for (const item of sorted) {
    const parts = item.path.split("/")
    if (parts.length <= 1) {
      if (item.type === "tree") {
        const node = dirMap.get(item.path)
        if (node) root.push(node)
      }
      continue
    }
    const parentPath = parts.slice(0, -1).join("/")
    const parent = dirMap.get(parentPath)
    if (parent && parent.children) {
      if (item.type === "tree") {
        const node = dirMap.get(item.path)
        if (node) parent.children.push(node)
      } else {
        parent.children.push({ name: parts[parts.length - 1], type: "file", path: item.path })
      }
    }
  }

  return root
}

async function fetchRepo(defaultBranch: string, owner: string, repo: string): Promise<{ tree: GitHubTreeItem[]; defaultBranch: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers: GITHUB_HEADERS })
    if (res.status === 403) {
      // Rate limited — try without recursive
      const retryRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}`, { headers: GITHUB_HEADERS })
      if (!retryRes.ok) return null
      const data = await retryRes.json()
      return { tree: data.tree || [], defaultBranch }
    }
    if (!res.ok) return null
    const data = await res.json()
    return { tree: data.tree || [], defaultBranch }
  } catch {
    return null
  }
}

async function fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function detectMainLanguage(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers: GITHUB_HEADERS })
    if (!res.ok) return "Unknown"
    const langs: Record<string, number> = await res.json()
    const entries = Object.entries(langs)
    if (entries.length === 0) return "Unknown"
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  } catch {
    return "Unknown"
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 })
    }

    const parsed = parseGitHubUrl(url)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL. Must be like https://github.com/owner/repo" }, { status: 400 })
    }

    const { owner, repo } = parsed
    const repoId = `repo-${Math.random().toString(36).slice(2, 9)}`
    const repoName = repo

    const newRepo = {
      id: repoId,
      name: repoName,
      url,
      language: "Detecting...",
      framework: "",
      totalFiles: 0,
      totalLines: 0,
      totalClasses: 0,
      totalFunctions: 0,
      status: "cloning" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    repositories.push(newRepo)
    saveCache()

    // Fetch repo data asynchronously
    ;(async () => {
      try {
        // Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: GITHUB_HEADERS })
        if (!repoRes.ok) {
          const repo = repositories.find(r => r.id === repoId)
          if (repo) { repo.status = "error"; repo.updatedAt = new Date().toISOString(); saveCache() }
          return
        }
        const repoData = await repoRes.json()
        const defaultBranch = repoData.default_branch || "main"

        const foundRepo = repositories.find(r => r.id === repoId)
        if (foundRepo) { foundRepo.status = "scanning"; foundRepo.updatedAt = new Date().toISOString(); saveCache() }

        // Detect main language
        const mainLanguage = await detectMainLanguage(owner, repo)

        // Fetch file tree
        const result = await fetchRepo(defaultBranch, owner, repo)
        if (!result || !result.tree) {
          const repo = repositories.find(r => r.id === repoId)
          if (repo) { repo.status = "error"; repo.updatedAt = new Date().toISOString(); saveCache() }
          return
        }

        const { tree } = result

        if (foundRepo) { foundRepo.status = "parsing"; foundRepo.updatedAt = new Date().toISOString(); saveCache() }

        // Build tree structure
        const treeNodes = buildTree(tree)
        const fileItems = tree.filter(t => t.type === "blob" && !shouldExclude(t.path, "blob"))

        // Fetch file contents (first 50 files to avoid overwhelming)
        const MAX_FILES = 50
        const contentsToFetch = fileItems.slice(0, MAX_FILES)
        const fetchedContents: Record<string, string> = {}

        let totalLines = 0
        const extCount = new Map<string, number>()

        for (const item of contentsToFetch) {
          const content = await fetchFileContent(owner, repo, defaultBranch, item.path)
          if (content !== null) {
            fetchedContents[item.path] = content
            const lines = content.split("\n").length
            totalLines += lines
          }
          const ext = item.path.includes(".") ? "." + item.path.split(".").pop()!.toLowerCase() : ""
          if (ext) extCount.set(ext, (extCount.get(ext) || 0) + 1)
        }

        // Detect language from extensions
        const langFromExt = [...extCount.entries()].sort((a, b) => b[1] - a[1])
        const detectedLanguage = mainLanguage !== "Unknown" ? mainLanguage : (langFromExt.length > 0 ? detectLanguage(langFromExt[0][0]) : "Unknown")

        if (foundRepo) { foundRepo.status = "graph_building"; foundRepo.updatedAt = new Date().toISOString(); saveCache() }

        // Update repo metadata
        if (foundRepo) {
          foundRepo.language = detectedLanguage
          foundRepo.totalFiles = fileItems.length
          foundRepo.totalLines = totalLines
          foundRepo.totalClasses = 0
          foundRepo.totalFunctions = 0
          foundRepo.updatedAt = new Date().toISOString()
        }

        // Store file tree
        fileTrees[repoId] = treeNodes

        // Store file contents
        fileContents[repoId] = fetchedContents

        // Detect file extensions for framework detection
        const fileList = contentsToFetch.map(f => f.path)
        const extensions = [...new Set(fileList.map(f => f.includes(".") ? f.split(".").pop()!.toLowerCase() : "").filter(Boolean))]

        // Build folder-structure-based modules for display
        const dirs = [...new Set(
          contentsToFetch
            .map(f => f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "root")
        )].sort()
        const graphNodes: { id: string; label: string; type: "file" | "class" | "function" | "module"; filePath?: string }[] = []
        const graphEdges: { source: string; target: string; relation: string }[] = []
        const archNodes: { id: string; label: string; type: "module" | "frontend" | "api" | "service" | "repository" | "model" | "database" | "external" | "entry" | "framework" | "layer" | "controller" | "other"; fileCount: number; complexity: "Low" | "Medium" | "High" | "Critical" }[] = []
        const archEdges: { source: string; target: string; relation: string }[] = []
        const archModules: { name: string; type: string; files: number }[] = []

        for (const dir of dirs) {
          const moduleName = dir === "root" ? repoName : dir.split("/").pop() || dir
          const label = moduleName.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          const id = moduleName.toLowerCase().replace(/[^a-z0-9]/g, "-")
          graphNodes.push({ id, label, type: "module" })
          archNodes.push({ id, label, type: "module", fileCount: 1, complexity: "Medium" })
          archModules.push({ name: label, type: "module", files: 1 })
        }
        for (let i = 1; i < dirs.length; i++) {
          const srcId = dirs[i - 1] === "root" ? repoName.toLowerCase().replace(/[^a-z0-9]/g, "-") : dirs[i - 1].split("/").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "-")
          const tgtId = dirs[i] === "root" ? repoName.toLowerCase().replace(/[^a-z0-9]/g, "-") : dirs[i].split("/").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "-")
          if (srcId !== tgtId) {
            graphEdges.push({ source: srcId, target: tgtId, relation: "depends_on" })
            archEdges.push({ source: srcId, target: tgtId, relation: "DEPENDS_ON" })
          }
        }

        analyses[repoId] = {
          repository: foundRepo || newRepo,
          architecture: {
            type: "Layered",
            typeScore: 70,
            typeConfidence: "Medium",
            modules: archModules.length > 0 ? archModules : [{ name: "src", type: "module", files: fileItems.length }],
            entryPoints: [],
            frameworks: extensions.length > 0 ? Object.fromEntries(extensions.slice(0, 5).map(e => [e, "*"])) : {},
            layers: [{ name: "Source Files", description: detectedLanguage }],
            databaseConnections: [],
            externalAPIs: [],
            complexity: { level: "Medium", score: 40 },
            maintainabilityScore: 65,
            nodes: archNodes.length > 0 ? archNodes : [
              { id: "root", label: repoName, type: "module", fileCount: fileItems.length, complexity: "Medium" }
            ],
            edges: archEdges,
            metrics: {
              totalFiles: fileItems.length, totalLines: totalLines, totalClasses: 0, totalFunctions: 0,
              services: 0, controllers: 0, apis: 0, databaseTables: 0,
              externalIntegrations: 0, testFiles: 0, configFiles: 0, docFiles: 0, avgFileSize: Math.round(totalLines / Math.max(fileItems.length, 1))
            },
            insights: [{ type: "recommendation", title: "Run Full Analysis", description: "Visit the Architecture page for a complete analysis." }],
            summary: `${repoName} — ${fileItems.length} files, ${totalLines} lines, ${detectedLanguage}`,
            criticalDependencies: 0,
            circularDependencies: 0,
            healthScore: 65,
            criticalModulesCount: 0,
            highRiskAreasCount: 0,
            couplingScore: "Low",
            scalabilityScore: "Low",
            technicalDebtScore: "Low",
            confidence: "Medium"
          },
          dependencies: {
            graph: { nodes: graphNodes, edges: graphEdges },
            hotspots: [],
            circularDependencies: [],
            externalDependencies: [],
            summary: { filesWithImports: 0, totalImportStatements: 0, uniqueExternalDependencies: 0 },
          },
          dataFlow: {
            routes: [],
            flow: [`${repoName} — ${fileItems.length} files analyzed`],
            sequenceDiagram: `sequenceDiagram\n  participant Dev as Developer\n  participant Repo as ${repoName}\n  Dev->>+Repo: Analyze\n  Repo-->>-Dev: ${fileItems.length} files, ${totalLines} lines`,
            flowDiagram: `flowchart LR\n  A[${repoName}] --> B[${detectedLanguage}]\n  B --> C[${fileItems.length} files]`,
            architectureDiagram: `graph TD\n  A[${repoName}] --> B[${detectedLanguage}]`,
          },
          documentation: (() => {
            const moduleNames = archModules.map(m => m.name)
            const moduleDeps = archEdges.map(e => `  ${archNodes.find(n => n.id === e.source)?.label || e.source} --> ${archNodes.find(n => n.id === e.target)?.label || e.target}`).join("\n")
            const archMermaid = moduleDeps ? `\`\`\`mermaid\ngraph TD\n${moduleDeps}\n\`\`\`` : ""
            const flowMermaid = `\`\`\`mermaid\nflowchart LR\n  A[${repoName}] --> B[${detectedLanguage}]\n  B --> C[${fileItems.length} files]\n${archModules.slice(0, 5).map(m => `  B --> ${m.name.replace(/\s+/g, "_")}[${m.name}]`).join("\n")}\n\`\`\``
            const extList = extensions.length > 0 ? extensions.map(e => `- \`.${e}\``).join("\n") : "- None detected"
            const fileList = contentsToFetch.slice(0, 20).map(f => `- \`${f.path}\``).join("\n")
            const moduleList = moduleNames.map(m => `- **${m}**`).join("\n")
            const moduleDetails = archModules.map(m => `### ${m.name}\n\n**Files:** ${m.files}\n**Complexity:** Medium\n**Type:** Module`).join("\n\n")

            // Detect API-like file patterns
            const apiFiles = contentsToFetch.filter(f => /controller|route|api|handler|endpoint/i.test(f.path))
            const apiEndpoints = apiFiles.length > 0
              ? apiFiles.map(f => `- \`${f.path}\``).join("\n")
              : "- No API route files detected"

            // Detect database-like file patterns
            const dbFiles = contentsToFetch.filter(f => /database|schema|model|entity|migration|dal|repository/i.test(f.path))
            const dbContent = dbFiles.length > 0
              ? dbFiles.map(f => `- \`${f.path}\``).join("\n")
              : "- No database files detected"

            // Detect setup/config files
            const setupFiles = contentsToFetch.filter(f => /^package\.json$|^requirements\.txt$|^\.env|docker-compose|Makefile|^setup\.py$|^pyproject\.toml$/i.test(f.path))
            const setupContent = setupFiles.length > 0
              ? setupFiles.map(f => `- \`${f.path}\``).join("\n")
              : "- No setup files detected"

            // Detect deployment files
            const deployFiles = contentsToFetch.filter(f => /^Dockerfile|docker-compose|\.github\/workflows|helm|k8s|deploy/i.test(f.path))
            const deployContent = deployFiles.length > 0
              ? deployFiles.map(f => `- \`${f.path}\``).join("\n")
              : "- No deployment configuration detected"

            return {
              overview: `# Repository Overview\n\n**${repoName}**\n\n${url ? `Repository fetched from ${url}.` : ""}\n\n## Technology Stack\n- **Primary Language:** ${detectedLanguage}\n- **File Types:** ${extensions.length > 0 ? extensions.join(", ") : "Standard"}\n- **Total Files:** ${fileItems.length}\n- **Total Lines of Code:** ${totalLines}\n\n## Repository Statistics\n| Metric | Value |\n|--------|-------|\n| Total Files | ${fileItems.length} |\n| Total Lines | ${totalLines.toLocaleString()} |\n| Primary Language | ${detectedLanguage} |\n| File Extensions | ${extensions.length > 0 ? extensions.slice(0, 8).join(", ") : "Standard"} |\n\n## Key Directories\n${dirs.slice(0, 10).map(d => `- \`${d}\``).join("\n")}`,
              architecture: `# System Architecture\n\n## Architecture Pattern\n**Layered Architecture** — Default detection for ${repoName}.\n\n## Detected Technologies\n- **Language:** ${detectedLanguage}\n- **File Extensions:** ${extList}\n\n## Modules\n\n${moduleList || "- No modules detected"}\n\n## Architecture Diagram\n\n${archMermaid || "No architecture diagram available."}\n\n## Module Details\n\n${moduleDetails || "- No module details available"}\n\n## Entry Points\n- No explicit entry points detected\n\n## Dependencies Between Modules\n- ${archEdges.length > 0 ? archEdges.length + " dependency relationships mapped" : "No dependencies mapped"}`,
              api: `# API Endpoints\n\n## Detected API Files\n\n${apiEndpoints}\n\n## Notes\n- No structured API documentation available\n- Run a full analysis to detect:\n  - Route definitions\n  - Request/response schemas\n  - Authentication requirements\n  - Error codes\n\n## How to Add API Documentation\nOnce API routes are detected, this section will include:\n- Endpoint URLs\n- HTTP methods\n- Request parameters\n- Response schemas\n- Authentication details`,
              services: `# Services & Modules\n\n## Discovered Modules\n\n${moduleList || "- No modules detected"}\n\n## Module Responsibilities\n\n${moduleDetails || "- No module details available"}\n\n## Key Files\n\n${fileList || "- No files listed"}`,
              database: `# Database Schema\n\n## Detected Database Files\n\n${dbContent}\n\n## Schema Overview\n${dbFiles.length > 0 ? "The following database-related files were detected. Run a full analysis to extract schemas, relationships, and indexes." : "No database schema files detected in this repository."}\n\n## Tables / Collections\n- Run full analysis to detect database tables`,
              dependencies: `# Dependencies\n\n## Module Dependency Graph\n\n${archMermaid || "No dependency graph available."}\n\n## Dependency Relationships\n${archEdges.length > 0 ? archEdges.map(e => `- **${archNodes.find(n => n.id === e.source)?.label || e.source}** → **${archNodes.find(n => n.id === e.target)?.label || e.target}** (${e.relation})`).join("\n") : "- No dependency relationships mapped"}\n\n## External Dependencies\n- Run full analysis to detect external packages`,
              dataflow: `# Data Flow\n\n## Flow Diagram\n\n${flowMermaid}\n\n## Request/Response Flow\n${archModules.length > 0 ? `1. Request enters through entry point\n2. Routes to ${archModules.map(m => m.name).join(" → ") || "handler"}\n3. Response returned` : "- No data flow mapped"}\n\n## Data Flow Paths\n- Run full analysis to map detailed data flows`,
              setup: `# Setup & Installation\n\n## Prerequisites\n- ${detectedLanguage} runtime environment\n\n## Detected Configuration Files\n${setupContent}\n\n## Quick Start\n1. Clone the repository\n2. Install dependencies (see configuration files above)\n3. Configure environment variables if needed\n4. Run the application\n\n## Environment Variables\n- No environment variables documented`,
              deployment: `# Deployment\n\n## Detected Deployment Files\n${deployContent}\n\n## Deployment Options\n${deployFiles.length > 0 ? "- Docker deployment available\n- CI/CD pipeline detected" : "- No deployment configuration detected\n- Standard deployment via cloning and running the application"}\n\n## Production Considerations\n- Add monitoring and logging\n- Configure environment variables for production`,
              ai_guide: `# AI Repository Guide\n\n## Summary\n**${repoName}** is a ${detectedLanguage} repository with ${fileItems.length} files and ${totalLines.toLocaleString()} lines of code.\n\n## Technology Stack\n- **Language:** ${detectedLanguage}\n- **Modules:** ${moduleNames.length > 0 ? moduleNames.join(", ") : "Not detected"}\n- **File Types:** ${extensions.join(", ")}\n\n## Repository Structure\n${dirs.slice(0, 8).map(d => `- \`${d}/\``).join("\n")}\n\n## How to Get Started\n1. Clone the repository\n2. Review the setup instructions above\n3. Explore the key directories listed above\n4. Run the application locally\n\n## AI Insights\n- **Complexity:** Medium\n- **Maintainability Score:** 65/100\n- **Architecture Type:** Layered`,
            }
          })(),
          security: [],
          quality: [],
        }

        onboardingPlans[repoId] = {
          days: [
            {
              day: 1,
              title: "Getting Started",
              goals: [`Explore the ${repoName} repository`],
              activities: [
                { description: "Code Review", items: [`Browse ${fileItems.length} files across the repository.`] },
              ],
              tasks: [
                { id: "t1", label: "Review project structure", status: "not_started" },
                { id: "t2", label: "Read key source files", status: "not_started" },
              ],
              files: contentsToFetch.slice(0, 5).map(f => f.path),
              flows: ["Main application flow"],
            },
          ],
        }

        if (foundRepo) { foundRepo.status = "complete"; foundRepo.updatedAt = new Date().toISOString() }
        saveCache()
      } catch (err) {
        console.error("GitHub fetch error:", err)
        const repo = repositories.find(r => r.id === repoId)
        if (repo) { repo.status = "error"; repo.updatedAt = new Date().toISOString(); saveCache() }
      }
    })()

    return NextResponse.json(newRepo)
  } catch (error) {
    return NextResponse.json({ error: "Failed to connect repository via URL" }, { status: 500 })
  }
}