import type {
  RepositoryTreeNode, AnalysisResult, OnboardingPlan, OnboardingPhase,
  OnboardingTask, OnboardingFile, ImportantComponent, ImportantFlow,
  QuizQuestion, ReadinessScore,
} from "@/types"

const FILE_FORMAT_EXTS = new Set([".csv", ".log", ".txt", ".env", ".png", ".pkl", ".json", ".yaml", ".yml", ".xml", ".md", ".svg", ".ico", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".eot", ".lock", ".toml", ".ini", ".cfg", ".editorconfig", ".gitignore", ".dockerignore", ".prettierrc", ".eslintrc"])
const ENTRY_EXTENSIONS = new Set([".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".cs"])

function getNodeImportCount(nodeId: string, edges: { source: string; target: string }[]): number {
  return edges.filter(e => e.target === nodeId || e.source === nodeId).length
}

function getAllFiles(tree: RepositoryTreeNode[], prefix = ""): { path: string; name: string }[] {
  let result: { path: string; name: string }[] = []
  for (const node of tree) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === "file") {
      result.push({ path: fullPath, name: node.name })
    }
    if (node.children) {
      result = result.concat(getAllFiles(node.children, fullPath))
    }
  }
  return result
}

function getExt(path: string): string {
  const i = path.lastIndexOf(".")
  return i >= 0 ? path.slice(i).toLowerCase() : ""
}

function scoreFile(
  filePath: string,
  entryPoints: string[],
  architectureNodes: { id: string; label: string; type: string; fileCount: number; complexity: string }[],
  architectureEdges: { source: string; target: string; relation: string }[],
  hotspots: { module: string; referencedBy: number }[],
  moduleDetails: Record<string, { name: string; importance: string; files: { path: string }[] }> | undefined,
): { path: string; score: number; importance: OnboardingFile["importance"]; complexity: OnboardingFile["complexity"]; purpose: string; estimatedMinutes: number } {
  const ext = getExt(filePath)
  const fileName = filePath.split("/").pop() || filePath

  if (FILE_FORMAT_EXTS.has(ext)) {
    return { path: filePath, score: -100, importance: "Low", complexity: "Low", purpose: "Configuration or data file", estimatedMinutes: 5 }
  }

  let score = 0
  let purpose = "Source file"
  let complexity: OnboardingFile["complexity"] = "Low"
  let isSource = false

  // Entry points score
  if (entryPoints.some(ep => filePath.includes(ep) || filePath === ep)) {
    score += 50
    purpose = "Application entry point"
    complexity = "Low"
    isSource = true
  }

  // Centrality from architecture nodes
  for (const node of architectureNodes) {
    if (filePath.includes(node.label.toLowerCase().replace(/\s+/g, "")) ||
        filePath.includes(node.label)) {
      const importCount = getNodeImportCount(node.id, architectureEdges)
      score += importCount * 4
    }
  }

  // Hotspot score
  for (const h of hotspots) {
    if (filePath.toLowerCase().includes(h.module.toLowerCase())) {
      score += h.referencedBy * 2
      purpose = `Hotspot — referenced by ${h.referencedBy} files`
      isSource = true
    }
  }

  // Module detail importance
  if (moduleDetails) {
    for (const [, detail] of Object.entries(moduleDetails)) {
      if (detail.files.some(f => filePath.includes(f.path) || f.path.includes(filePath))) {
        if (detail.importance === "Critical") score += 20
        else if (detail.importance === "High") score += 15
        else if (detail.importance === "Medium") score += 8
        if (purpose === "Source file") purpose = `Part of ${detail.name}`
        isSource = true
      }
    }
  }

  // Directory-based scoring
  const lowerPath = filePath.toLowerCase()
  if (/\b(service|services)\b/.test(lowerPath)) { score += 10; purpose = "Business logic layer"; isSource = true }
  if (/\b(controller|controllers|route|routes|api|endpoint)\b/.test(lowerPath)) { score += 10; purpose = "API route handler"; isSource = true }
  if (/\b(model|entity|schema|repository|dal|database|db)\b/.test(lowerPath)) { score += 8; purpose = "Data access layer"; isSource = true }
  if (/\b(auth|login|jwt|session|guard|middleware)\b/.test(lowerPath)) { score += 12; purpose = "Authentication & authorization"; isSource = true }
  if (/\b(config|configuration|settings?)\b/.test(lowerPath)) { score += 5; purpose = "Configuration"; isSource = true }
  if (/\b(test|spec|e2e|__tests__)\b/.test(lowerPath)) { score += 3; purpose = "Test file"; isSource = true }
  if (/\b(util|helper|common|shared)\b/.test(lowerPath)) { score += 6; purpose = "Shared utilities"; isSource = true }
  if (/\b(main|app|index|server)\b/.test(fileName)) { score += 15; purpose = "Entry point"; isSource = true }
  if (/\b(module|modules)\b/.test(lowerPath)) { score += 10; purpose = "Module definition"; isSource = true }
  if (/\b(decorator|pipe|filter|interceptor|provider)\b/.test(lowerPath)) { score += 7; purpose = "Framework extension"; isSource = true }
  if (/\b(type|types|interface|dto)\b/.test(lowerPath)) { score += 6; purpose = "Type definitions"; isSource = true }
  if (/\b(migration|migrate|seed)\b/.test(lowerPath)) { score += 4; purpose = "Database migration"; isSource = true }

  // Complexity estimation
  if (isSource) {
    if (score >= 30) complexity = "High"
    else if (score >= 15) complexity = "Medium"
    else complexity = "Low"
  }

  // Estimated minutes
  const est = isSource ? (complexity === "High" ? 30 : complexity === "Medium" ? 20 : 10) : 5

  // Importance mapping
  let importance: OnboardingFile["importance"]
  if (score >= 25) importance = "Critical"
  else if (score >= 15) importance = "High"
  else if (score >= 5) importance = "Medium"
  else importance = "Low"

  return { path: filePath, score, importance, complexity, purpose: purpose || "Source file", estimatedMinutes: est }
}

function generateTasks(
  phases: { name: string; description: string; keywords: string[] }[],
  files: { path: string; purpose: string; importance: OnboardingFile["importance"]; complexity: OnboardingFile["complexity"] }[],
  modules: { name: string; type: string }[],
  entryPoints: string[],
  dataFlow: any,
  deps: any,
): OnboardingTask[][] {
  const tasksByPhase: OnboardingTask[][] = []
  let taskId = 1

  for (const phase of phases) {
    const tasks: OnboardingTask[] = []
    const phaseFiles = files.filter(f =>
      phase.keywords.some(k => f.path.toLowerCase().includes(k) || f.purpose.toLowerCase().includes(k))
    )
    const phaseModules = modules.filter(m =>
      phase.keywords.some(k => m.name.toLowerCase().includes(k))
    )

    // Explore entry points task
    if (phase.name === "Getting Started") {
      tasks.push({
        id: `t${taskId++}`,
        label: "Explore entry points and bootstrap",
        description: entryPoints.length
          ? `Find and read the main entry points: ${entryPoints.join(", ")}`
          : "Identify how the application starts up",
        difficulty: "Beginner",
        estimatedMinutes: 10,
        importance: "Critical",
        type: "read",
      })
      tasks.push({
        id: `t${taskId++}`,
        label: "Review project structure and configuration",
        description: "Understand the directory layout, package manager, and build config",
        difficulty: "Beginner",
        estimatedMinutes: 15,
        importance: "High",
        type: "explore",
      })
    }

    // Core architecture
    if (phase.name === "Core Architecture") {
      const criticalFiles = files.filter(f => f.importance === "Critical" || f.importance === "High")
      tasks.push({
        id: `t${taskId++}`,
        label: "Study critical source files",
        description: `Review ${Math.min(criticalFiles.length, 8)} critical files to understand core architecture`,
        difficulty: "Intermediate",
        estimatedMinutes: 25,
        importance: "Critical",
        type: "read",
      })
      tasks.push({
        id: `t${taskId++}`,
        label: "Trace dependency graph",
        description: "Follow imports and references between modules to understand coupling",
        difficulty: "Intermediate",
        estimatedMinutes: 20,
        importance: "High",
        type: "trace",
      })
    }

    // Module-specific tasks
    for (const mod of phaseModules.slice(0, 3)) {
      tasks.push({
        id: `t${taskId++}`,
        label: `Understand the ${mod.name} module`,
        description: `Review structure, responsibilities, and dependencies of ${mod.name}`,
        difficulty: "Intermediate",
        estimatedMinutes: 20,
        importance: "High",
        type: "understand",
      })
    }

    // File reading tasks
    for (const f of phaseFiles.filter(f => f.importance === "Critical").slice(0, 3)) {
      tasks.push({
        id: `t${taskId++}`,
        label: `Read ${f.path.split("/").pop()}`,
        description: `Study ${f.path} (${f.purpose})`,
        difficulty: f.complexity === "High" ? "Advanced" as const : f.complexity === "Medium" ? "Intermediate" as const : "Beginner" as const,
        estimatedMinutes: f.complexity === "High" ? 25 : 15,
        importance: f.importance,
        type: "read",
      })
    }

    // Data flow tasks
    if (phase.name === "Authentication & Security" && dataFlow?.routes) {
      tasks.push({
        id: `t${taskId++}`,
        label: "Trace authentication request lifecycle",
        description: "Follow a complete auth request from route → controller → service → database → response",
        difficulty: "Intermediate",
        estimatedMinutes: 20,
        importance: "Critical",
        type: "trace",
      })
    }

    if (phase.name === "API & External Integrations" && dataFlow?.routes) {
      tasks.push({
        id: `t${taskId++}`,
        label: "Review all API routes and flow",
        description: `Explore ${dataFlow.routes.length} API endpoints and their request lifecycles`,
        difficulty: "Intermediate",
        estimatedMinutes: 15,
        importance: "High",
        type: "explore",
      })
    }

    // External deps
    if (phase.name === "API & External Integrations" && deps?.externalDependencies?.length) {
      tasks.push({
        id: `t${taskId++}`,
        label: "Review external integrations",
        description: `Understand the ${deps.externalDependencies.length} external dependencies and their roles`,
        difficulty: "Intermediate",
        estimatedMinutes: 15,
        importance: "Medium",
        type: "explore",
      })
    }

    // Practice tasks
    if (tasks.length >= 3) {
      tasks.push({
        id: `t${taskId++}`,
        label: `Exercise: ${phase.name === "Getting Started" ? "Run the app and verify it works" : phase.name === "Core Architecture" ? "Draw the architecture diagram from memory" : `Make a small change in ${phase.name}`}`,
        description: "Practice what you learned with a hands-on exercise",
        difficulty: "Intermediate",
        estimatedMinutes: 20,
        importance: "Medium",
        type: "practice",
      })
    }

    tasksByPhase.push(tasks)
  }

  return tasksByPhase
}

function generateQuiz(
  modules: { name: string; type: string }[],
  frameworks: Record<string, string>,
  entryPoints: string[],
  layers: { name: string; description: string }[],
  externalAPIs: string[],
  databaseConnections: string[],
  insights: { type: string; title: string; description: string }[],
  architectureType: string,
  dataFlowRoutes: { method: string; path: string; file: string }[] | undefined,
): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  const usedTopics = new Set<string>()

  // Architecture type question
  if (architectureType && architectureType !== "Unknown") {
    questions.push({
      question: `What architectural pattern does this repository follow?`,
      options: [
        architectureType,
        "Microservices",
        "Event-Driven",
        "Serverless",
      ].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: `The repository uses ${architectureType} architecture, detected during analysis.`,
    })
    usedTopics.add("architecture")
  }

  // Framework question
  const fwKeys = Object.keys(frameworks)
  if (fwKeys.length > 0) {
    const mainFw = fwKeys[0]
    const answers = [mainFw, "React", "Django", "Express", "Spring Boot"].filter(Boolean)
    const shuffled = answers.sort(() => Math.random() - 0.5)
    questions.push({
      question: `Which primary framework is used in this repository?`,
      options: shuffled,
      correctIndex: shuffled.indexOf(mainFw),
      explanation: `The analysis detected ${mainFw} as the primary framework.`,
    })
    usedTopics.add("framework")
  }

  // Module count question
  if (modules.length >= 2) {
    const answers = [String(modules.length), String(modules.length + 1), String(modules.length - 1), String(Math.max(1, modules.length - 2))]
    const shuffled = answers.sort(() => Math.random() - 0.5)
    questions.push({
      question: `How many modules were identified in the architecture?`,
      options: shuffled,
      correctIndex: shuffled.indexOf(String(modules.length)),
      explanation: `The analysis identified ${modules.length} modules: ${modules.map(m => m.name).join(", ")}.`,
    })
    usedTopics.add("modules")
  }

  // Entry point question
  if (entryPoints.length > 0) {
    const real = entryPoints[0]
    const fake = ["src/app.ts", "index.js", "server.py", "main.go"].filter(f => f !== real)
    const options = [real, ...fake.slice(0, 3)].sort(() => Math.random() - 0.5)
    questions.push({
      question: "Which file serves as the main entry point?",
      options,
      correctIndex: options.indexOf(real),
      explanation: `${real} is the main entry point bootstrap file.`,
    })
    usedTopics.add("entry")
  }

  // Layer question
  if (layers.length >= 2) {
    const correctLayer = layers[0].name
    const fakeLayers = ["Middleware Layer", "Cache Layer", "Event Layer"].filter(l => !layers.some(rl => rl.name === l))
    questions.push({
      question: `Which layer is ${correctLayer} part of this architecture?`,
      options: [correctLayer, ...fakeLayers.slice(0, 3)].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: `${correctLayer}: ${layers[0].description}`,
    })
    usedTopics.add("layers")
  }

  // Database question
  if (databaseConnections.length > 0) {
    const db = databaseConnections[0]
    const fakes = ["MySQL", "MongoDB", "SQLite", "Redis"].filter(f => f !== db && !databaseConnections.includes(f))
    questions.push({
      question: "Which database technology is used?",
      options: [db, ...fakes.slice(0, 3)].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: `The repository connects to ${db}.`,
    })
    usedTopics.add("database")
  }

  // External API question
  if (externalAPIs.length > 0) {
    const api = externalAPIs[0]
    const fakes = ["GitHub API", "Slack API", "Twitter API", "Google Maps API"].filter(f => f !== api)
    questions.push({
      question: `Which external service is integrated?`,
      options: [api, ...fakes.slice(0, 3)].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: `The repository integrates with ${api}.`,
    })
    usedTopics.add("api")
  }

  // Risk question from insights
  const risks = insights.filter(i => i.type === "risk")
  if (risks.length > 0) {
    const risk = risks[0]
    questions.push({
      question: `What is a key risk identified in this repository?`,
      options: [
        risk.title,
        "Too many files",
        "Outdated dependencies",
        "Missing documentation",
      ].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: risk.description,
    })
    usedTopics.add("risk")
  }

  // Strength question
  const strengths = insights.filter(i => i.type === "strength")
  if (strengths.length > 0) {
    const strength = strengths[0]
    questions.push({
      question: "What is a key strength of this codebase?",
      options: [
        strength.title,
        "Fast performance",
        "High test coverage",
        "Modern syntax",
      ].sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: strength.description,
    })
    usedTopics.add("strength")
  }

  // API route question
  if (dataFlowRoutes && dataFlowRoutes.length >= 2) {
    const route = dataFlowRoutes[0]
    const fakeRoutes = ["PUT /api/update", "DELETE /api/remove", "PATCH /api/modify"].filter(
      f => !dataFlowRoutes.some(r => `${r.method} ${r.path}` === f)
    )
    const options = [`${route.method} ${route.path}`, ...fakeRoutes.slice(0, 3)].sort(() => Math.random() - 0.5)
    questions.push({
      question: "Which API route exists in this application?",
      options,
      correctIndex: options.indexOf(`${route.method} ${route.path}`),
      explanation: `${route.method} ${route.path} is handled in ${route.file}.`,
    })
    usedTopics.add("routes")
  }

  // Circular deps question
  if (modules.length >= 3) {
    questions.push({
      question: `Which module is most central to the architecture?`,
      options: modules.slice(0, 4).map(m => m.name).sort(() => Math.random() - 0.5),
      correctIndex: 0,
      explanation: `${modules[0].name} is the most central module (${modules[0].type}).`,
    })
    usedTopics.add("central")
  }

  return questions.slice(0, 8)
}

function generateFlows(
  dataFlow: any,
  entryPoints: string[],
  modules: { name: string; type: string }[],
  databaseConnections: string[],
  externalAPIs: string[],
): ImportantFlow[] {
  const flows: ImportantFlow[] = []

  if (dataFlow?.flow?.length) {
    flows.push({
      name: "Primary Request Flow",
      description: "End-to-end request processing lifecycle",
      steps: dataFlow.flow,
    })
  }

  if (dataFlow?.routes?.length) {
    for (const route of dataFlow.routes.slice(0, 3)) {
      flows.push({
        name: `${route.method} ${route.path}`,
        description: `Request handled by ${route.file}`,
        steps: [
          `Incoming ${route.method} request to ${route.path}`,
          `Routing to ${route.file}`,
          `Business logic processing`,
          `Database interaction (if applicable)`,
          `Response returned to client`,
        ],
      })
    }
  }

  if (databaseConnections.length > 0) {
    flows.push({
      name: "Database Interaction",
      description: "How the application interacts with the database",
      steps: [
        `Service layer requests data via ORM/query`,
        `Connection pool resolves connection`,
        `Query executed against ${databaseConnections[0]}`,
        `Results mapped to application models`,
        `Response returned to caller`,
      ],
    })
  }

  if (externalAPIs.length > 0 && modules.length > 0) {
    flows.push({
      name: `External API Integration (${externalAPIs[0]})`,
      description: "Communication with external service",
      steps: [
        `Request triggers external API call in ${modules[0].name}`,
        `HTTP client builds and signs request`,
        `External service processes request`,
        `Response parsed and validated`,
        `Result integrated into application flow`,
      ],
    })
  }

  // Auth flow (if auth module exists)
  if (modules.some(m => /auth/i.test(m.name))) {
    flows.push({
      name: "Authentication Flow",
      description: "How users authenticate with the application",
      steps: [
        `User submits credentials via login endpoint`,
        `System validates credentials against stored records`,
        `Authentication token (JWT/Session) generated`,
        `Token returned to client for subsequent requests`,
        `Middleware validates token on protected routes`,
      ],
    })
  }

  return flows.slice(0, 6)
}

function generateArchitecturePath(
  modules: { name: string; type: string }[],
  layers: { name: string; description: string }[],
  entryPoints: string[],
  architectureType: string,
  frameworks: Record<string, string>,
  databaseConnections: string[],
  externalAPIs: string[],
): { step: string; description: string }[] {
  const path: { step: string; description: string }[] = []

  path.push({
    step: "Entry Point",
    description: entryPoints.length
      ? `Application starts at ${entryPoints[0]} — learn how the app bootstraps`
      : "Identify how the application initializes",
  })

  if (frameworks && Object.keys(frameworks).length > 0) {
    const fws = Object.keys(frameworks)
    path.push({
      step: "Framework Core",
      description: `Built with ${fws[0]} — understand framework conventions used`,
    })
  }

  path.push({
    step: `${architectureType} Architecture`,
    description: `Architecture pattern: ${architectureType}. ${layers.length} layers identified.`,
  })

  if (layers.length > 0) {
    for (const layer of layers) {
      path.push({
        step: layer.name,
        description: layer.description,
      })
    }
  }

  if (modules.length > 0) {
    path.push({
      step: `Key Modules (${modules.length})`,
      description: `Core modules: ${modules.map(m => m.name).join(", ")}`,
    })
  }

  if (databaseConnections.length > 0) {
    path.push({
      step: "Data Layer",
      description: `Connected to ${databaseConnections.join(", ")}`,
    })
  }

  if (externalAPIs.length > 0) {
    path.push({
      step: "External Integrations",
      description: `Integrates with: ${externalAPIs.join(", ")}`,
    })
  }

  path.push({
    step: "Putting It All Together",
    description: "Trace a complete request through the entire stack to see how all components interact",
  })

  return path
}

function generatePhases(
  modules: { name: string; type: string }[],
  entryPoints: string[],
  frameworks: Record<string, string>,
  databaseConnections: string[],
  externalAPIs: string[],
  layers: { name: string; description: string }[],
): { name: string; description: string; estimatedTime: string; keywords: string[] }[] {
  const phases: { name: string; description: string; estimatedTime: string; keywords: string[] }[] = []

  phases.push({
    name: "Getting Started",
    description: "Clone, configure, and run the application locally",
    estimatedTime: "20-30 min",
    keywords: ["entry", "main", "index", "server", "app", "config", "setup", "docker", "package", "readme"],
  })

  phases.push({
    name: "Core Architecture",
    description: `Understand the ${Object.keys(frameworks).length > 0 ? Object.keys(frameworks)[0] : ""} structure, patterns, and module organization`,
    estimatedTime: "25-35 min",
    keywords: ["architecture", "module", "core", "framework", "layer", "app", "module"],
  })

  if (modules.some(m => /auth|login|jwt|session|user/i.test(m.name))) {
    phases.push({
      name: "Authentication & Security",
      description: "Learn how authentication, authorization, and security are handled",
      estimatedTime: "20-30 min",
      keywords: ["auth", "login", "jwt", "session", "guard", "middleware", "user", "token"],
    })
  }

  const svcModules = modules.filter(m => /service|payment|order|product|item/i.test(m.name))
  if (svcModules.length > 0) {
    phases.push({
      name: "Business Logic & Services",
      description: `Understand key services: ${svcModules.map(m => m.name).join(", ")}`,
      estimatedTime: "25-35 min",
      keywords: ["service", "business", ...svcModules.map(m => m.name.toLowerCase())],
    })
  }

  if (databaseConnections.length > 0 || modules.some(m => /model|entity|database|repository/i.test(m.name))) {
    phases.push({
      name: "Data Layer & Persistence",
      description: `Explore data models, ${databaseConnections.length > 0 ? databaseConnections[0] : "database"} schema, and queries`,
      estimatedTime: "20-25 min",
      keywords: ["database", "model", "entity", "schema", "repository", "migration", "seed", "sql", "orm"],
    })
  }

  if (externalAPIs.length > 0 || modules.some(m => /api|route|controller|gateway/i.test(m.name))) {
    phases.push({
      name: "API & External Integrations",
      description: `Explore API routes${externalAPIs.length > 0 ? ` and external services like ${externalAPIs.join(", ")}` : ""}`,
      estimatedTime: "20-30 min",
      keywords: ["api", "route", "controller", "integration", "external", externalAPIs.length > 0 ? externalAPIs[0].toLowerCase() : ""],
    })
  }

  // Testing & deployment
  phases.push({
    name: "Testing & Deployment",
    description: "Understand test strategy and deployment pipeline",
    estimatedTime: "15-20 min",
    keywords: ["test", "spec", "e2e", "deploy", "docker", "ci", "cd", "github"],
  })

  return phases
}

function identifyComponents(
  architectureNodes: { id: string; label: string; type: string; fileCount: number; complexity: string }[],
  architectureEdges: { source: string; target: string; relation: string }[],
  moduleDetails: Record<string, { name: string; type: string; importance: string; purpose: string; files: { path: string }[]; usedBy: { name: string }[] }> | undefined,
): { services: ImportantComponent[]; apis: ImportantComponent[]; databases: string[] } {
  const services: ImportantComponent[] = []
  const apis: ImportantComponent[] = []

  if (moduleDetails) {
    for (const [, detail] of Object.entries(moduleDetails)) {
      const type = detail.type || "module"
      const usedByCount = detail.usedBy?.length || 0
      if (type === "service" || type === "module") {
        services.push({
          name: detail.name,
          type: type === "service" ? "Service" : "Module",
          importance: detail.importance || "Medium",
          description: detail.purpose || "",
          usedByCount,
          files: detail.files.map(f => f.path),
        })
      }
    }
  } else {
    for (const node of architectureNodes) {
      if (node.type === "module" || node.type === "service") {
        const importCount = getNodeImportCount(node.id, architectureEdges)
        services.push({
          name: node.label,
          type: node.type === "service" ? "Service" : "Module",
          importance: importCount >= 5 ? "Critical" : importCount >= 3 ? "High" : "Medium",
          description: `${node.label} — ${node.complexity} complexity, ${node.fileCount} files`,
          usedByCount: importCount,
          files: [],
        })
      }
    }
  }

  for (const node of architectureNodes) {
    if (node.type === "api" || node.type === "controller" || node.type === "frontend") {
      apis.push({
        name: node.label,
        type: "API",
        importance: node.complexity === "Critical" || node.complexity === "High" ? "Critical" : "Medium",
        description: `${node.label} — ${node.fileCount} files, ${node.complexity} complexity`,
        usedByCount: getNodeImportCount(node.id, architectureEdges),
        files: [],
      })
    }
  }

  return { services, apis, databases: [] }
}

export function generateOnboardingPlan(
  tree: RepositoryTreeNode[] | null | undefined,
  analysis: AnalysisResult | null | undefined,
): OnboardingPlan {
  const architecture = analysis?.architecture
  const deps = analysis?.dependencies
  const dataFlow = analysis?.dataFlow

  const modules: { name: string; type: string }[] = architecture?.modules || []
  const entryPoints: string[] = architecture?.entryPoints || []
  const frameworks: Record<string, string> = architecture?.frameworks || {}
  const layers: { name: string; description: string }[] = architecture?.layers || []
  const databaseConnections: string[] = architecture?.databaseConnections || []
  const externalAPIs: string[] = architecture?.externalAPIs || []
  const insights: { type: string; title: string; description: string }[] = architecture?.insights || []
  const architectureNodes: any[] = architecture?.nodes || []
  const architectureEdges: any[] = architecture?.edges || []
  const moduleDetails = architecture?.moduleDetails
  const allFiles = tree ? getAllFiles(tree) : []
  const hotspots: { module: string; referencedBy: number }[] = deps?.hotspots || []
  const dataFlowRoutes = dataFlow?.routes
  const metrics = architecture?.metrics
  const complexity = architecture?.complexity
  const fwNames = Object.keys(frameworks)
  const techStack = [analysis?.repository?.language || "Unknown", ...fwNames].filter(Boolean)
  const totalFiles = metrics?.totalFiles || analysis?.repository?.totalFiles || allFiles.length
  const totalLines = metrics?.totalLines || analysis?.repository?.totalLines || 0

  // Generate phases
  const phaseDefs = generatePhases(modules, entryPoints, frameworks, databaseConnections, externalAPIs, layers)

  // Score and rank all files
  const scoredFiles: { path: string; score: number; importance: OnboardingFile["importance"]; complexity: OnboardingFile["complexity"]; purpose: string; estimatedMinutes: number }[] = allFiles.map(f =>
    scoreFile(f.path, entryPoints, architectureNodes, architectureEdges, hotspots, moduleDetails)
  )
  scoredFiles.sort((a, b) => b.score - a.score)
  const topFiles = scoredFiles.filter(f => f.score > 0).slice(0, 30)

  // Generate tasks for each phase
  const taskMatrix = generateTasks(phaseDefs, topFiles, modules, entryPoints, dataFlow, deps)

  // Map files to phases
  const importantComponents = identifyComponents(architectureNodes, architectureEdges, moduleDetails)

  // Build phases with files and flows
  const phases: OnboardingPhase[] = phaseDefs.map((pd, i) => {
    const phaseFiles = topFiles.filter(f =>
      pd.keywords.some(k => k && (f.path.toLowerCase().includes(k) || f.purpose.toLowerCase().includes(k)))
    ).slice(0, 8)

    const phaseTasks = taskMatrix[i] || []
    const phaseFlows = generateFlows(dataFlow, entryPoints, modules, databaseConnections, externalAPIs)
      .filter(f => pd.keywords.some(k => k && f.name.toLowerCase().includes(k)))
      .map(f => f.name)

    return {
      name: pd.name,
      description: pd.description,
      estimatedTime: pd.estimatedTime,
      tasks: phaseTasks,
      files: phaseFiles.map(f => ({
        path: f.path,
        purpose: f.purpose,
        importance: f.importance,
        complexity: f.complexity,
        estimatedMinutes: f.estimatedMinutes,
        score: f.score,
      })),
      flows: phaseFlows,
    }
  })

  // Generate important flows
  const importantFlows = generateFlows(dataFlow, entryPoints, modules, databaseConnections, externalAPIs)

  // Architecture learning path
  const architecturePath = generateArchitecturePath(modules, layers, entryPoints, architecture?.type || "Unknown", frameworks, databaseConnections, externalAPIs)

  // Quiz
  const quiz = generateQuiz(modules, frameworks, entryPoints, layers, externalAPIs, databaseConnections, insights, architecture?.type || "", dataFlowRoutes)

  // Readiness score
  const readiness: ReadinessScore = {
    overall: 5,
    filesRead: 0,
    modulesExplored: 0,
    flowsReviewed: 0,
    architectureStudied: 0,
  }

  // All critical files as ImportantComponent
  const criticalFiles: OnboardingFile[] = scoredFiles
    .filter(f => f.importance === "Critical" || f.importance === "High")
    .slice(0, 12)
    .map(f => ({
      path: f.path,
      purpose: f.purpose,
      importance: f.importance,
      complexity: f.complexity,
      estimatedMinutes: f.estimatedMinutes,
      score: f.score,
    }))

  // Summary
  const summary = {
    purpose: architecture?.summary || `${modules.length} modules, ${totalFiles} files — repository analysis complete`,
    architecture: architecture?.type || "Unknown",
    techStack,
    complexity: complexity?.level || "Unknown",
    estimatedLearningTime: "2-3 hours",
    mainComponents: modules.map(m => m.name),
    totalFiles,
    totalLines,
  }

  return {
    summary,
    phases,
    importantComponents: {
      ...importantComponents,
      files: criticalFiles,
    },
    importantFlows,
    architecturePath,
    quiz,
    readiness,
  }
}
