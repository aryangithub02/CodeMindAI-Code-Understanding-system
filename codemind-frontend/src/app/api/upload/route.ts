import { NextResponse } from "next/server"
import { after } from "next/server"
import JSZip from "jszip"
import { repositories, fileTrees, fileContents, analyses, onboardingPlans, saveCache } from "../data"
import type { RepositoryTreeNode } from "@/types"
import { analyzeArchitecture } from "../architecture/architecture-analyzer"

export const maxDuration = 60;

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

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const repoId = `repo-${Math.random().toString(36).slice(2, 9)}`
    const repoName = file.name.replace(/\.[^/.]+$/, "") // Strip extension

    const newRepo = {
      id: repoId,
      name: repoName,
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

    // Process immediately to avoid Vercel killing background tasks
    const repo = repositories.find(r => r.id === repoId)
    if (repo) {
      try {
        repo.status = "scanning"
        repo.updatedAt = new Date().toISOString()
        saveCache()

        const arrayBuffer = await file.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuffer)

        repo.status = "parsing"
        repo.updatedAt = new Date().toISOString()
        saveCache()

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

        repo.status = "graph_building"
        repo.updatedAt = new Date().toISOString()
        saveCache()

        // Run real architecture analysis
        const realAnalysis = await analyzeArchitecture(treeNodes, fetchedContents, repoName)

        // Update repository details
        repo.language = detectedLanguage
        repo.totalFiles = fileItems.length
        repo.totalLines = totalLines
        repo.totalClasses = realAnalysis.metrics.totalClasses || 0
        repo.totalFunctions = realAnalysis.metrics.totalFunctions || 0
        repo.framework = Object.keys(realAnalysis.frameworks)[0] || ""
        repo.status = "complete"
        repo.updatedAt = new Date().toISOString()

        // Save tree & contents
        fileTrees[repoId] = treeNodes
        fileContents[repoId] = fetchedContents

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

        // Build folder structure dirs
        const dirs = [...new Set(
          contentsToFetch
            .map(f => f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "root")
        )].sort()

        analyses[repoId] = {
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
            routes: [],
            flow: [`${repoName} — ${fileItems.length} files analyzed`],
            sequenceDiagram: `sequenceDiagram\n  participant Dev as Developer\n  participant Repo as ${repoName}\n  Dev->>+Repo: Analyze\n  Repo-->>-Dev: ${fileItems.length} files, ${totalLines} lines`,
            flowDiagram: `flowchart LR\n  A[${repoName}] --> B[${detectedLanguage}]\n  B --> C[${fileItems.length} files]`,
            architectureDiagram: `graph TD\n  A[${repoName}] --> B[${detectedLanguage}]`,
          },
          documentation: (() => {
            const moduleNames = realAnalysis.modules.map(m => m.name)
            const moduleDeps = realAnalysis.edges.map(e => `  ${realAnalysis.nodes.find(n => n.id === e.source)?.label || e.source} --> ${realAnalysis.nodes.find(n => n.id === e.target)?.label || e.target}`).join("\n")
            const archMermaid = moduleDeps ? `\`\`\`mermaid\ngraph TD\n${moduleDeps}\n\`\`\`` : ""
            const flowMermaid = `\`\`\`mermaid\nflowchart LR\n  A[${repoName}] --> B[${detectedLanguage}]\n  B --> C[${fileItems.length} files]\n${realAnalysis.modules.slice(0, 5).map(m => `  B --> ${m.name.replace(/\s+/g, "_")}[${m.name}]`).join("\n")}\n\`\`\``
            const extList = [...new Set(fileList.map(f => f.includes(".") ? f.split(".").pop()!.toLowerCase() : "").filter(Boolean))].map(e => `- \`.${e}\``).join("\n")
            const fileListStr = contentsToFetch.slice(0, 20).map(f => `- \`${f.path}\``).join("\n")
            const moduleList = moduleNames.map(m => `- **${m}**`).join("\n")
            
            const moduleDetailsMarkdown = Object.values(realAnalysis.moduleDetails || {})
              .map(m => {
                const fileListStr = m.files.slice(0, 5).map(f => `  - \`${f.name}\` (${f.loc} LOC) — *${f.purpose}*`).join("\n")
                const depsStr = m.dependsOn.length > 0 ? m.dependsOn.map(d => d.name).join(", ") : "None"
                const usedByStr = m.usedBy.length > 0 ? m.usedBy.map(u => u.name).join(", ") : "None"
                
                return `### ${m.name} (${m.type.toUpperCase()})
- **Purpose:** ${m.purpose}
- **Role/Domain:** ${m.businessRole}
- **Complexity:** ${m.complexity} | **Risk Level:** ${m.riskLevel}
- **Size:** ${m.fileCount} file(s) (${m.totalLoc} lines of code)
- **Dependencies:**
  - *Depends on:* ${depsStr}
  - *Used by:* ${usedByStr}
- **Files in Module:**
${fileListStr || "  - No files listed"}
- **AI Explanation:** ${m.aiExplanation}`
              })
              .join("\n\n")

            const apiFiles = contentsToFetch.filter(f => /controller|route|api|handler|endpoint/i.test(f.path))
            const apiEndpoints = apiFiles.length > 0 ? apiFiles.map(f => `- \`${f.path}\``).join("\n") : "- No API route files detected"

            const dbFiles = contentsToFetch.filter(f => /database|schema|model|entity|migration|dal|repository/i.test(f.path))
            const dbContent = dbFiles.length > 0 ? dbFiles.map(f => `- \`${f.path}\``).join("\n") : "- No database files detected"

            const setupFiles = contentsToFetch.filter(f => /^package\.json$|^requirements\.txt$|^\.env|docker-compose|Makefile|^setup\.py$|^pyproject\.toml$/i.test(f.path))
            const setupContent = setupFiles.length > 0 ? setupFiles.map(f => `- \`${f.path}\``).join("\n") : "- No setup files detected"

            const deployFiles = contentsToFetch.filter(f => /^Dockerfile|docker-compose|\.github\/workflows|helm|k8s|deploy/i.test(f.path))
            const deployContent = deployFiles.length > 0 ? deployFiles.map(f => `- \`${f.path}\``).join("\n") : "- No deployment configuration detected"

            return {
              overview: `# Repository Overview\n\n**${repoName}**\n\n## Technology Stack\n- **Primary Language:** ${detectedLanguage}\n- **Total Files:** ${fileItems.length}\n- **Total Lines of Code:** ${totalLines}\n\n## Repository Statistics\n| Metric | Value |\n|--------|-------|\n| Total Files | ${fileItems.length} |\n| Total Lines | ${totalLines.toLocaleString()} |\n| Primary Language | ${detectedLanguage} |\n\n## Key Directories\n${dirs.slice(0, 10).map(d => `- \`${d}\``).join("\n")}`,
              architecture: `# System Architecture\n\n## Architecture Pattern\n**${realAnalysis.type} Architecture** — Default detection for ${repoName}.\n\n## Detected Technologies\n- **Language:** ${detectedLanguage}\n- **File Extensions:**\n${extList || "- None"}\n\n## Modules\n\n${moduleList || "- No modules detected"}\n\n## Architecture Diagram\n\n${archMermaid || "No architecture diagram available."}\n\n## Module Details\n\n${moduleDetailsMarkdown || "- No module details available"}\n\n## Entry Points\n- ${realAnalysis.entryPoints.map(e => `- \`${e}\``).join("\n") || "No explicit entry points detected"}\n\n## Dependencies Between Modules\n- ${realAnalysis.edges.length > 0 ? realAnalysis.edges.length + " dependency relationships mapped" : "No dependencies mapped"}`,
              api: `# API Endpoints\n\n## Detected API Files\n\n${apiEndpoints}\n\n## Notes\n- No structured API documentation available`,
              services: `# Services & Modules\n\n## Discovered Modules\n\n${moduleList || "- No modules detected"}\n\n## Module Responsibilities\n\n${moduleDetailsMarkdown || "- No module details available"}\n\n## Key Files\n\n${fileListStr || "- No files listed"}`,
              database: `# Database Schema\n\n## Detected Database Files\n\n${dbContent}\n\n## Schema Overview\n${dbFiles.length > 0 ? "Database files detected." : "No database schema files detected."}`,
              dependencies: `# Dependencies\n\n## Module Dependency Graph\n\n${archMermaid || "No dependency graph available."}\n\n## Dependency Relationships\n${realAnalysis.edges.length > 0 ? realAnalysis.edges.map(e => `- **${realAnalysis.nodes.find(n => n.id === e.source)?.label || e.source}** → **${realAnalysis.nodes.find(n => n.id === e.target)?.label || e.target}** (${e.relation})`).join("\n") : "- No dependencies"}`,
              dataflow: `# Data Flow\n\n## Flow Diagram\n\n${flowMermaid}\n\n## Request/Response Flow\n${realAnalysis.modules.length > 0 ? `1. Request enters\n2. Routes to ${realAnalysis.modules.map(m => m.name).join(" → ")}` : "- No flow"}`,
              setup: `# Setup & Installation\n\n## Prerequisites\n- ${detectedLanguage} environment\n\n## Setup Files\n${setupContent}`,
              deployment: `# Deployment\n\n## Setup Files\n${deployContent}`,
              ai_guide: `# AI Repository Guide\n\n## Summary\n**${repoName}** is a ${detectedLanguage} repository with ${fileItems.length} files.`,
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

        saveCache()
      } catch (err) {
        console.error("ZIP analysis error:", err)
        repo.status = "error"
        repo.updatedAt = new Date().toISOString()
        saveCache()
      }
    }

    const updatedRepo = repositories.find(r => r.id === repoId) || newRepo
    return NextResponse.json({
      repository: updatedRepo,
      fileTree: fileTrees[repoId] || [],
      fileContents: fileContents[repoId] || {},
      analysis: analyses[repoId] || null,
      onboardingPlan: onboardingPlans[repoId] || null
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to upload repository file" }, { status: 500 })
  }
}
