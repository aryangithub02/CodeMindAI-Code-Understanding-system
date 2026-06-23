import type { RepositoryTreeNode, ArchitectureAnalysis, Route, ModuleDetail } from "@/types"

interface FileInfo {
  path: string
  name: string
  ext: string
}

const FILE_FORMAT_EXTS = new Set(["csv", "txt", "log", "env", "png", "pkl", "jpg", "jpeg", "gif", "svg", "ico", "pdf", "zip", "tar", "gz", "lock", "yaml", "yml", "toml", "cfg", "ini", "md", "rst", "json", "xml", "drawio", "excalidraw", "whl", "pyc", "DS_Store"])

const TECH_LANG_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript (React)", js: "JavaScript", jsx: "React", mjs: "JavaScript",
  py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", cs: "C#", rb: "Ruby",
  php: "PHP", vue: "Vue.js", svelte: "Svelte", swift: "Swift", scala: "Scala", dart: "Dart",
  r: "R", sql: "SQL", prisma: "Prisma", graphql: "GraphQL", gql: "GraphQL",
}

const FRAMEWORK_TECH_MAP: Record<string, string> = {
  "NestJS": "NestJS", "Next.js": "Next.js", "React": "React", "Angular": "Angular",
  "Vue": "Vue.js", "Express": "Express", "FastAPI": "FastAPI", "Django": "Django",
  "Flask": "Flask", "Spring Boot": "Spring Boot", "Ruby on Rails": "Ruby on Rails",
  "Laravel": "Laravel", "ASP.NET": "ASP.NET", "Svelte": "Svelte", "PyTorch": "PyTorch",
  "TensorFlow": "TensorFlow", "TypeORM": "TypeORM", "Prisma": "Prisma",
}

function flattenTree(nodes: RepositoryTreeNode[], parentPath = ""): FileInfo[] {
  const result: FileInfo[] = []
  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
    if (node.type === "file") {
      result.push({ path: fullPath, name: node.name, ext: node.name.includes(".") ? node.name.split(".").pop()!.toLowerCase() : "" })
    }
    if (node.children) {
      result.push(...flattenTree(node.children, fullPath))
    }
  }
  return result
}

function detectTechnologies(files: FileInfo[], contents: Record<string, string>, arch: ArchitectureAnalysis): string[] {
  const techs = new Set<string>()

  for (const fw of Object.keys(arch.frameworks)) {
    const mapped = FRAMEWORK_TECH_MAP[fw] || fw
    techs.add(mapped)
  }

  const exts = new Set(files.map(f => f.ext))
  for (const ext of exts) {
    if (FILE_FORMAT_EXTS.has(ext)) continue
    const mapped = TECH_LANG_MAP[ext]
    if (mapped) techs.add(mapped)
  }

  const allContent = Object.values(contents).join(" ")
  const libPatterns = [
    { name: "Tailwind CSS", pattern: /tailwind/i },
    { name: "Bootstrap", pattern: /bootstrap/i },
    { name: "Redis", pattern: /redis|ioredis/i },
    { name: "PostgreSQL", pattern: /postgres|pg\s/i },
    { name: "MongoDB", pattern: /mongo|mongoose/i },
    { name: "MySQL", pattern: /mysql/i },
    { name: "SQLite", pattern: /sqlite/i },
    { name: "Docker", pattern: /docker/i },
    { name: "Kubernetes", pattern: /k8s|kubernetes|helm/i },
    { name: "GraphQL", pattern: /graphql|apollo/i },
    { name: "gRPC", pattern: /grpc/i },
    { name: "WebSocket", pattern: /websocket|socket\.io/i },
    { name: "JWT", pattern: /jwt|jsonwebtoken/i },
    { name: "Stripe", pattern: /stripe/i },
    { name: "AWS", pattern: /aws-sdk|aws\/|amazon/i },
    { name: "Azure", pattern: /azure/i },
    { name: "GCP", pattern: /gcp|google-cloud/i },
    { name: "Scikit-learn", pattern: /sklearn|scikit-learn/i },
    { name: "Pandas", pattern: /pandas/i },
    { name: "NumPy", pattern: /numpy/i },
    { name: "TensorFlow", pattern: /tensorflow/i },
    { name: "PyTorch", pattern: /pytorch|torch\./i },
  ]
  for (const lib of libPatterns) {
    if (lib.pattern.test(allContent)) techs.add(lib.name)
  }

  return [...techs]
}

function getConfidenceScore(section: string, arch: ArchitectureAnalysis, files: FileInfo[], contents: Record<string, string>): number {
  switch (section) {
    case "overview":
      if (arch.modules.length > 0 && files.length > 0) return 92
      if (files.length > 0) return 75
      return 50
    case "architecture":
      if (arch.layers.length > 0 && arch.moduleDetails && Object.keys(arch.moduleDetails).length > 0) return 90
      if (arch.modules.length > 0) return 70
      return 45
    case "api": {
      const routes = detectApiEndpoints(contents)
      if (routes.length > 5) return 88
      if (routes.length > 0) return 72
      return 50
    }
    case "services":
      if (arch.moduleDetails && Object.keys(arch.moduleDetails).length > 3) return 85
      return 60
    case "database":
      if (arch.databaseConnections.length > 0) return 90
      return 55
    case "dependencies":
      if (arch.nodes.length > 5) return 85
      return 60
    case "dataflow":
      if (arch.entryPoints.length > 0) return 80
      return 55
    case "setup":
      if (files.some(f => /package\.json|requirements\.txt|go\.mod/i.test(f.name))) return 90
      return 65
    case "deployment":
      if (files.some(f => /docker/i.test(f.name) || /\.github/i.test(f.path))) return 85
      return 50
    case "ai_guide":
      if (arch.moduleDetails && Object.keys(arch.moduleDetails).length > 0) return 88
      return 60
    default:
      return 70
  }
}

function detectBusinessDomain(arch: ArchitectureAnalysis, files: FileInfo[], repoName: string): { domain: string; problem: string; users: string[]; goals: string[] } {
  const name = repoName.toLowerCase()
  const modNames = arch.modules.map(m => m.name.toLowerCase())
  const allContent = files.map(f => f.name.toLowerCase().replace(/\.\w+$/, "")).join(" ")

  const domains: { pattern: RegExp; domain: string; problem: string; users: string[]; goals: string[] }[] = [
    { pattern: /e-commerce|ecommerce|shop|store|product|catalog|cart|order|payment|checkout|stripe/i, domain: "E-Commerce", problem: "Businesses need an online platform to list products, process payments, and manage customer orders.", users: ["Customers", "Store Administrators", "Customer Support Team"], goals: ["Browse and search products", "Process payments securely", "Manage inventory and orders", "Track customer behavior"] },
    { pattern: /employee|hr|human.?resource|retention|payroll|staff|recruit|onboard/i, domain: "Human Resources", problem: "Organizations need to manage employee data, track retention risk, and streamline HR operations.", users: ["HR Managers", "Team Leads", "Employees"], goals: ["Predict employee churn risk", "Manage employee records", "Track performance metrics", "Generate HR reports"] },
    { pattern: /health|medical|clinic|patient|doctor|hospital|diagnos|disease|symptom/i, domain: "Healthcare", problem: "Healthcare providers need a system to manage patient data, appointments, and medical records.", users: ["Doctors", "Patients", "Administrative Staff"], goals: ["Schedule and manage appointments", "Maintain patient records", "Track treatment history", "Generate medical reports"] },
    { pattern: /finance|bank|account|invest|portfolio|trad|transaction|ledger|invoice|billing/i, domain: "Financial Services", problem: "Financial institutions need a platform to manage accounts, process transactions, and track investments.", users: ["Customers", "Financial Advisors", "Compliance Officers"], goals: ["Manage accounts and balances", "Process transactions securely", "Track investment portfolio", "Generate financial reports"] },
    { pattern: /analytics|metric|dashboard|insight|report|visualize|kpi|bi |business.?intel/i, domain: "Business Analytics", problem: "Companies need to collect, analyze, and visualize data to make informed business decisions.", users: ["Business Analysts", "Executives", "Data Scientists"], goals: ["Track key performance indicators", "Build interactive dashboards", "Generate periodic reports", "Identify trends and patterns"] },
    { pattern: /auth|login|sso|identity|oauth|saml|permission|rbac|iam/i, domain: "Authentication & Authorization", problem: "Applications need secure user authentication, role management, and access control.", users: ["End Users", "System Administrators"], goals: ["Authenticate users securely", "Manage roles and permissions", "Support single sign-on", "Audit access logs"] },
    { pattern: /ml |machine.?learn|model|train|predict|classif|regression|cluster|recommend|forecast/i, domain: "Machine Learning", problem: "Data scientists and engineers need a platform to build, train, and deploy machine learning models.", users: ["Data Scientists", "ML Engineers", "Business Stakeholders"], goals: ["Train and evaluate models", "Make predictions on new data", "Monitor model performance", "Deploy models to production"] },
    { pattern: /blog|cms|content|article|post|news|publish|media|editor/i, domain: "Content Management", problem: "Content creators need a platform to publish, manage, and distribute digital content.", users: ["Content Creators", "Editors", "Readers"], goals: ["Create and edit content", "Manage media assets", "Publish and schedule posts", "Analyze content performance"] },
    { pattern: /chat|message|notification|sms|email|push|alert|notify|communicat/i, domain: "Messaging & Notifications", problem: "Applications need reliable communication channels to notify users and facilitate messaging.", users: ["End Users", "System Administrators"], goals: ["Send real-time notifications", "Manage email templates", "Track delivery status", "Support two-way messaging"] },
    { pattern: /iot|sensor|device|smart|automation|control|monitor/i, domain: "IoT & Automation", problem: "Organizations need to collect data from sensors and automate device control.", users: ["Operators", "System Administrators", "End Users"], goals: ["Collect sensor data in real-time", "Automate device control", "Monitor system health", "Generate alerts on anomalies"] },
    { pattern: /api|rest|graphql|service|sdk|integration|microservice|gateway|proxy/i, domain: "API Platform", problem: "Developers need a centralized platform to build, expose, and manage APIs.", users: ["API Consumers", "Developer Teams", "Platform Administrators"], goals: ["Expose consistent APIs", "Manage API versions", "Monitor API usage", "Ensure API security"] },
  ]

  for (const candidate of domains) {
    if (candidate.pattern.test(name) || candidate.pattern.test(allContent)) {
      return { domain: candidate.domain, problem: candidate.problem, users: candidate.users, goals: candidate.goals }
    }
  }

  return {
    domain: "General Application",
    problem: `The ${repoName} repository serves as a software project that needs clear documentation for its specific business domain.`,
    users: ["Developers", "System Administrators"],
    goals: ["Run and maintain the application", "Understand the codebase structure", "Contribute new features", "Debug and fix issues"],
  }
}

function generateRepoStructure(tree: RepositoryTreeNode[]): string {
  function dirSummary(nodes: RepositoryTreeNode[], depth = 0): string[] {
    const lines: string[] = []
    for (const node of nodes) {
      if (node.type === "directory") {
        const dirFiles = node.children?.filter(c => c.type === "file").length || 0
        const dirDirs = node.children?.filter(c => c.type === "directory").length || 0
        const hint = dirHint(node.name, dirFiles, dirDirs)
        lines.push(`${"  ".repeat(depth)}- **${node.name}/** — ${hint}`)
        if (node.children) {
          lines.push(...dirSummary(node.children, depth + 1))
        }
      }
    }
    return lines
  }
  return dirSummary(tree).join("\n")
}

function dirHint(name: string, fileCount: number, subdirCount: number): string {
  const hints: Record<string, string> = {
    src: "Main source code directory",
    app: "Application entry point and routing",
    components: "Reusable UI components",
    pages: "Page-level components and routes",
    api: "API route handlers",
    services: "Business logic and service layer",
    controllers: "Request handlers and routing logic",
    models: "Data models and database schemas",
    entities: "Database entity definitions",
    migrations: "Database migration files",
    repositories: "Data access and query layer",
    middleware: "Express/FastAPI middleware functions",
    config: "Application configuration files",
    utils: "Utility and helper functions",
    helpers: "Helper functions",
    lib: "Library code and shared utilities",
    hooks: "React hooks",
    store: "State management",
    styles: "CSS and style files",
    public: "Static assets served directly",
    assets: "Static assets (images, fonts, etc.)",
    tests: "Test files",
    __tests__: "Test files",
    test: "Test files",
    specs: "Test specification files",
    e2e: "End-to-end tests",
    docs: "Documentation files",
    scripts: "Build and utility scripts",
    docker: "Docker configuration files",
    kubernetes: "Kubernetes deployment manifests",
    ".github": "GitHub Actions workflows and CI/CD",
    node_modules: "Node.js dependencies (generated)",
    dist: "Built/compiled output files",
    build: "Build output directory",
    coverage: "Code coverage reports",
    data: "Data files and datasets",
    datasets: "Training datasets",
    notebooks: "Jupyter notebooks",
    experiments: "Experimental code",
    features: "Feature-specific modules",
    layouts: "Layout components",
    routes: "Route definitions",
    types: "TypeScript type definitions",
    interfaces: "TypeScript interface definitions",
    constants: "Constant values",
    enums: "Enumeration definitions",
    validators: "Input validation logic",
    guards: "Authentication guards",
    interceptors: "Request/response interceptors",
    pipes: "Data transformation pipes",
    filters: "Error filters",
    decorators: "Custom decorators",
    dto: "Data transfer objects",
    strategies: "Authentication strategies",
    ui: "User interface components",
    providers: "Context providers",
    context: "React context definitions",
  }
  return hints[name] || `Contains ${fileCount} file(s)${subdirCount > 0 ? ` and ${subdirCount} subfolder(s)` : ""}`
}

function detectImportantFiles(files: FileInfo[], contents: Record<string, string>): { path: string; name: string; purpose: string; complexity: string; importance: string }[] {
  const important: { path: string; name: string; purpose: string; complexity: string; importance: string }[] = []

  const entryPatterns = [/main\.(ts|js|py|go|rs|java|kt|cs)$/, /index\.(ts|js|tsx|jsx)$/, /app\.(ts|js|py|go)$/, /server\.(ts|js|py)$/, /manage\.py$/, /Program\.cs$/]
  const configPatterns = [/package\.json$/, /tsconfig\.json$/, /next\.config/, /vite\.config/, /docker-compose/, /Dockerfile$/, /requirements\.txt$/, /go\.mod$/, /Cargo\.toml$/]
  const modelPatterns = [/(model|entity|schema)\.(ts|js|py|go|java|cs)$/]
  const servicePatterns = [/(service|provider|handler)\.(ts|js|py|go|java|cs)$/]
  const pipelinePatterns = [/train\.(py|r)$/, /predict\.(py|r)$/, /preprocess\.(py|r)$/, /feature.*\.(py|r)$/]

  for (const f of files) {
    const content = contents[f.path]
    const loc = content ? content.split("\n").length : 0

    if (entryPatterns.some(p => p.test(f.name))) {
      important.push({ path: f.path, name: f.name, purpose: "Application entry point — bootstraps and starts the application", complexity: loc > 200 ? "High" : "Low", importance: "Critical" })
    } else if (configPatterns.some(p => p.test(f.name))) {
      important.push({ path: f.path, name: f.name, purpose: "Configuration file — defines project settings and dependencies", complexity: "Low", importance: "High" })
    } else if (modelPatterns.some(p => p.test(f.name))) {
      important.push({ path: f.path, name: f.name, purpose: "Data model — defines database schema and entity structure", complexity: loc > 150 ? "Medium" : "Low", importance: "High" })
    } else if (servicePatterns.some(p => p.test(f.name))) {
      const domain = f.name.replace(/\.\w+$/, "").replace(/Service|Provider|Handler/i, "")
      important.push({ path: f.path, name: f.name, purpose: `Core service — implements ${domain} business logic`, complexity: loc > 300 ? "High" : loc > 100 ? "Medium" : "Low", importance: loc > 300 ? "Critical" : "High" })
    } else if (pipelinePatterns.some(p => p.test(f.name))) {
      important.push({ path: f.path, name: f.name, purpose: "ML pipeline — trains or runs predictions using trained models", complexity: loc > 200 ? "High" : "Medium", importance: "Critical" })
    }
  }

  const importanceRank: Record<string, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 }
  return important.sort((a, b) => {
    return (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0)
  }).slice(0, 8)
}

function detectApiEndpoints(contents: Record<string, string>): Route[] {
  const routes: Route[] = []
  for (const [filePath, content] of Object.entries(contents)) {
    const methodPatterns = [
      { method: "GET", patterns: [/\.get\s*\(/g, /@Get\s*\(/g, /@app\.get\s*\(/g, /router\.get\s*\(/g] },
      { method: "POST", patterns: [/\.post\s*\(/g, /@Post\s*\(/g, /@app\.post\s*\(/g, /router\.post\s*\(/g] },
      { method: "PUT", patterns: [/\.put\s*\(/g, /@Put\s*\(/g, /@app\.put\s*\(/g, /router\.put\s*\(/g] },
      { method: "DELETE", patterns: [/\.delete\s*\(/g, /@Delete\s*\(/g, /@app\.delete\s*\(/g, /router\.delete\s*\(/g] },
      { method: "PATCH", patterns: [/\.patch\s*\(/g, /@Patch\s*\(/g, /@app\.patch\s*\(/g, /router\.patch\s*\(/g] },
    ]
    for (const { method, patterns } of methodPatterns) {
      for (const p of patterns) {
        const matches = content.match(p)
        if (matches) {
          const pathMatch = content.match(/'([^']+)'|"([^"]+)"/)
          const path = pathMatch ? pathMatch[1] || pathMatch[2] : "/"
          if (!routes.some(r => r.method === method && r.path === path)) {
            routes.push({ method, path, file: filePath })
          }
        }
      }
    }
  }
  return routes
}

function getMetricsSummary(arch: ArchitectureAnalysis): { documents: number; apis: number; services: number; databaseTables: number; flows: number; modules: number } {
  return {
    documents: 10,
    apis: arch.externalAPIs.length,
    services: arch.moduleDetails ? Object.values(arch.moduleDetails).filter(d => d.type === "service" || d.type === "api").length : 0,
    databaseTables: arch.databaseConnections.length,
    flows: arch.entryPoints.length + (arch.databaseConnections.length > 0 ? 1 : 0) + (arch.externalAPIs.length > 0 ? 1 : 0),
    modules: arch.modules.length,
  }
}

function generateOverview(
  repoName: string,
  arch: ArchitectureAnalysis,
  files: FileInfo[],
  contents: Record<string, string>,
  tree: RepositoryTreeNode[]
): string {
  const totalLoc = files.reduce((s, f) => s + (contents[f.path]?.split("\n").length || 0), 0)
  const fileCount = files.length
  const techs = detectTechnologies(files, contents, arch)
  const business = detectBusinessDomain(arch, files, repoName)
  const importantFiles = detectImportantFiles(files, contents)
  const confidence = getConfidenceScore("overview", arch, files, contents)

  return [
    `# ${repoName}`,
    "",
    "> **Documentation Confidence**: ${confidence}% — Generated from static repository analysis",
    "",
    "---",
    "",
    "## Purpose",
    "",
    `${repoName} is a **${business.domain}** application built with **${techs.join(", ")}**.`,
    "",
    business.problem,
    "",
    "### Who Uses This",
    "",
    ...business.users.map(u => `- **${u}**`),
    "",
    "### Key Goals",
    "",
    ...business.goals.map(g => `- ${g}`),
    "",
    business.domain !== "General Application" ? [
      "## Business Problem",
      "",
      business.problem,
      "",
      `This system addresses the need for organizations to manage ${business.domain.toLowerCase()} workflows efficiently and at scale.`,
      "",
    ].join("\n") : "",
    "## Technology Stack",
    "",
    "| Technology | Category |",
    "| --- | --- |",
    ...techs.map(t => {
      const isFramework = Object.values(FRAMEWORK_TECH_MAP).includes(t) || Object.keys(arch.frameworks).includes(t)
      const isLanguage = Object.values(TECH_LANG_MAP).includes(t)
      const category = isFramework ? "Framework" : isLanguage ? "Language" : "Library / Tool"
      return `| ${t} | ${category} |`
    }),
    "",
    "## Repository Statistics",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Total Files | ${fileCount} |`,
    `| Total Lines of Code | ${totalLoc.toLocaleString()} |`,
    `| Modules | ${arch.modules.length} |`,
    `| Entry Points | ${arch.entryPoints.length} |`,
    `| Complexity | ${arch.complexity.level} (${arch.complexity.score}/100) |`,
    `| Maintainability | ${arch.maintainabilityScore}% |`,
    `| Database Connections | ${arch.databaseConnections.length} |`,
    `| External APIs | ${arch.externalAPIs.length} |`,
    "",
    "## Repository Structure",
    "",
    generateRepoStructure(tree),
    "",
    "## Main Components",
    "",
    ...arch.modules.map((m, i) => `${i + 1}. **${m.name}** — ${m.type} layer with ${m.files} files`),
    "",
    ...(importantFiles.length > 0 ? [
      "## Important Files",
      "",
      "| File | Purpose | Complexity | Importance |",
      "| --- | --- | --- | --- |",
      ...importantFiles.map(f => `| \`${f.name}\` | ${f.purpose} | ${f.complexity} | ${f.importance} |`),
      "",
    ] : []),
    "## Architecture Pattern",
    "",
    `${arch.type} (Confidence: ${arch.typeConfidence}, Score: ${arch.typeScore}/100)`,
    "",
    arch.layers.length > 0 ? [
      "",
      "### Layers",
      ...arch.layers.map(l => `- **${l.name}**: ${l.description}`),
      "",
    ].join("\n") : "",
    arch.databaseConnections.length > 0 ? [
      "",
      "## Databases",
      ...arch.databaseConnections.map(db => `- **${db}**`),
      "",
    ].join("\n") : "",
    arch.externalAPIs.length > 0 ? [
      "",
      "## External Integrations",
      ...arch.externalAPIs.map(api => `- **${api}**`),
      "",
    ].join("\n") : "",
  ].join("\n")
}

function generateArchitecture(arch: ArchitectureAnalysis, files: FileInfo[], contents: Record<string, string>): string {
  const modules = arch.modules || []
  const entryPoints = arch.entryPoints || []
  const layers = arch.layers || []
  const details = arch.moduleDetails ? Object.values(arch.moduleDetails) : []
  const confidence = getConfidenceScore("architecture", arch, files, contents)

  const lines: string[] = [
    "# Architecture Documentation",
    "",
    "> **Documentation Confidence**: ${confidence}% — Based on detected layers, modules, and dependency analysis",
    "",
    "---",
    "",
    "## Architecture Pattern",
    "",
    `**${arch.type}** (Confidence: ${arch.typeConfidence}, Score: ${arch.typeScore}/100)`,
    "",
    arch.summary ? `${arch.summary}\n` : "",
    "### Complexity Assessment",
    "",
    `- **Complexity Level**: ${arch.complexity.level} (${arch.complexity.score}/100)`,
    `- **Maintainability**: ${arch.maintainabilityScore}%`,
    `- **Critical Dependencies**: ${arch.criticalDependencies || 0}`,
    `- **Circular Dependencies**: ${arch.circularDependencies || 0}`,
    "",
    "## Architecture Flow",
    "",
    "```mermaid",
    "flowchart LR",
  ]

  const entrySafe = entryPoints.length > 0 ? entryPoints[0].replace(/[^a-zA-Z0-9]/g, "_") : "entry"
  if (entryPoints.length > 0) {
    lines.push(`  ${entrySafe}["${entryPoints[0]}"]:::entryPoint`)
  }

  if (modules.length > 0) {
    for (let i = 0; i < Math.min(modules.length, 6); i++) {
      const safe = modules[i].name.replace(/[^a-zA-Z0-9]/g, "_")
      lines.push(`  ${safe}["${modules[i].name}"]:::module`)
    }
    if (entryPoints.length > 0) {
      lines.push(`  ${entrySafe} --> ${modules[0].name.replace(/[^a-zA-Z0-9]/g, "_")}`)
    }
    for (let i = 0; i < Math.min(modules.length - 1, 5); i++) {
      lines.push(`  ${modules[i].name.replace(/[^a-zA-Z0-9]/g, "_")} --> ${modules[i + 1].name.replace(/[^a-zA-Z0-9]/g, "_")}`)
    }
  }

  if (arch.databaseConnections.length > 0) {
    const dbSafe = "database"
    lines.push(`  ${dbSafe}["${arch.databaseConnections[0]}"]:::database`)
    if (modules.length > 0) {
      lines.push(`  ${modules[modules.length - 1].name.replace(/[^a-zA-Z0-9]/g, "_")} --> ${dbSafe}`)
    }
  }

  lines.push(
    "  classDef entryPoint fill:#1e40af,stroke:#3b82f6,color:#fff",
    "  classDef module fill:#1e293b,stroke:#475569,color:#e2e8f0",
    "  classDef database fill:#064e3b,stroke:#10b981,color:#d1fae5",
    "```",
    "",
  )

  if (layers.length > 0) {
    lines.push("## Layers", "")
    lines.push("| Layer | Description |")
    lines.push("| --- | --- |")
    for (const layer of layers) {
      lines.push(`| ${layer.name} | ${layer.description} |`)
    }
    lines.push("")
  }

  lines.push("## Modules", "")
  if (modules.length > 0) {
    lines.push("| Module | Type | Files | Purpose | Complexity | Risk |")
    lines.push("| --- | --- | --- | --- | --- | --- |")
    for (const mod of modules) {
      const det = details.find(d => d.id === `module-${mod.name}` || d.name.toLowerCase() === mod.name.toLowerCase())
      lines.push(`| ${mod.name} | ${mod.type} | ${mod.files} | ${det?.purpose || "Module handling " + mod.name.toLowerCase() + " operations"} | ${det?.complexity || "—"} | ${det?.riskLevel || "—"} |`)
    }
    lines.push("")
  }

  if (entryPoints.length > 0) {
    lines.push("## Entry Points", "")
    for (const ep of entryPoints) {
      lines.push(`- \`${ep}\``)
    }
    lines.push("")
  }

  if (details.length > 0) {
    lines.push("## Module Details", "")
    for (const det of details.slice(0, 10)) {
      lines.push(`### ${det.name}`)
      lines.push("")
      lines.push(`**Purpose**: ${det.purpose || "General module for " + det.name.toLowerCase() + " operations"}`)
      lines.push("")
      lines.push("| Attribute | Value |")
      lines.push("| --- | --- |")
      lines.push(`| Type | ${det.type} |`)
      lines.push(`| Complexity | ${det.complexity} |`)
      lines.push(`| Risk Level | ${det.riskLevel} |`)
      lines.push(`| Importance | ${det.importance} |`)
      lines.push(`| Files | ${det.fileCount} |`)
      lines.push(`| Lines of Code | ${det.totalLoc} |`)
      lines.push(`| Maintainability | ${det.maintainabilityScore}% |`)
      lines.push(`| Technical Debt | ${det.technicalDebt} |`)
      lines.push(`| DB Reads | ${det.dbReads || "—"} |`)
      lines.push(`| DB Writes | ${det.dbWrites || "—"} |`)
      if (det.dependsOn && det.dependsOn.length > 0) {
        lines.push(`| Dependencies | ${det.dependsOn.map(d => d.name).join(", ")} |`)
      }
      if (det.usedBy && det.usedBy.length > 0) {
        lines.push(`| Used By | ${det.usedBy.map(d => d.name).join(", ")} |`)
      }
      if (det.entryPoints && det.entryPoints.length > 0) {
        lines.push(`| Entry Points | ${det.entryPoints.join(", ")} |`)
      }
      lines.push("")
      if (det.dbTables && det.dbTables.length > 0) {
        lines.push("**Database Tables**: " + det.dbTables.join(", "))
        lines.push("")
      }
      if (det.strengths && det.strengths.length > 0) {
        lines.push("**Strengths**:")
        for (const s of det.strengths) {
          lines.push(`- ✅ ${s}`)
        }
        lines.push("")
      }
      if (det.risks && det.risks.length > 0) {
        const highRisks = det.risks.filter(r => r.severity === "Critical" || r.severity === "High")
        if (highRisks.length > 0) {
          lines.push("**Risks**:")
          for (const r of highRisks) {
            lines.push(`- ⚠️ **${r.severity}**: ${r.description}`)
          }
          lines.push("")
        }
      }
      lines.push("---")
      lines.push("")
    }
  }

  const hasDb = arch.databaseConnections && arch.databaseConnections.length > 0
  const hasExt = arch.externalAPIs && arch.externalAPIs.length > 0
  if (hasDb || hasExt) {
    lines.push("## Integrations", "")
    if (hasDb) {
      lines.push("### Database Connections")
      for (const db of arch.databaseConnections) {
        lines.push(`- **${db}**`)
      }
      lines.push("")
    }
    if (hasExt) {
      lines.push("### External APIs")
      for (const api of arch.externalAPIs) {
        lines.push(`- **${api}**`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

function generateApi(files: FileInfo[], contents: Record<string, string>, arch: ArchitectureAnalysis): string {
  const endpoints = detectApiEndpoints(contents)
  const lines: string[] = [
    "# API Documentation",
    "",
    "## Overview",
    "",
    `Detected **${endpoints.length} API endpoint(s)** across the repository.`,
    "",
    arch.summary ? `${arch.summary}\n` : "",
  ]

  if (endpoints.length > 0) {
    lines.push("## Endpoints")
    lines.push("")
    lines.push("| Method | Path | File |")
    lines.push("| --- | --- | --- |")
    for (const ep of endpoints) {
      lines.push(`| \`${ep.method}\` | \`${ep.path}\` | \`${ep.file}\` |`)
    }
    lines.push("")

    // Detail each endpoint
    lines.push("## Endpoint Details")
    lines.push("")
    for (const ep of endpoints) {
      const content = contents[ep.file] || ""
      const hasAuth = /auth|guard|secure|token|jwt|login|@UseGuards|requires_auth/i.test(content)
      lines.push(`### ${ep.method} ${ep.path}`)
      lines.push("")
      lines.push(`**File**: \`${ep.file}\``)
      lines.push("")
      lines.push("**Purpose**: ", ep.method === "GET" ? "Retrieve data" : ep.method === "POST" ? "Create or submit data" : ep.method === "PUT" ? "Update existing data" : ep.method === "DELETE" ? "Remove data" : "Perform operation")
      lines.push("")
      lines.push("**Authentication**: " + (hasAuth ? "✅ Required" : "❌ Not required"))
      lines.push("")
      if (ep.method === "POST" || ep.method === "PUT") {
        lines.push("**Request Body**: `application/json`")
        lines.push("")
      }
      lines.push("**Response**: `application/json`")
      lines.push("")
      // Extract schema from content
      const dtoMatches = content.match(/interface\s+(\w+Dto|\w+Request|\w+Response|\w+Schema)/g)
      if (dtoMatches) {
        lines.push("**Schemas**: " + dtoMatches.map(s => `\`${s}\``).join(", "))
        lines.push("")
      }
      lines.push("---")
      lines.push("")
    }
  } else {
    lines.push("No explicit API endpoints detected through static analysis. The repository may use dynamic routing or a different framework pattern.")
    lines.push("")
  }

  // Auth section
  const allContent = Object.values(contents).join(" ")
  const hasAuthSystem = /auth|jwt|token|oauth|session|login|password/i.test(allContent)
  if (hasAuthSystem) {
    lines.push("## Authentication")
    lines.push("")
    lines.push("This application includes an authentication system. Endpoints may require:")
    lines.push("- JWT tokens in the Authorization header")
    lines.push("- Session cookies")
    lines.push("- API keys")
    lines.push("")
  }

  // Error codes
  lines.push("## Error Codes")
  lines.push("")
  lines.push("| Status Code | Description |")
  lines.push("| --- | --- |")
  lines.push("| 200 | Success |")
  lines.push("| 201 | Created |")
  lines.push("| 400 | Bad Request — invalid input |")
  lines.push("| 401 | Unauthorized — missing or invalid credentials |")
  lines.push("| 403 | Forbidden — insufficient permissions |")
  lines.push("| 404 | Not Found |")
  lines.push("| 422 | Unprocessable Entity — validation error |")
  lines.push("| 429 | Too Many Requests — rate limit exceeded |")
  lines.push("| 500 | Internal Server Error |")
  lines.push("")

  return lines.join("\n")
}

function generateServices(arch: ArchitectureAnalysis, files: FileInfo[], contents: Record<string, string>): string {
  const serviceFiles = files.filter(f => /service/i.test(f.name))
  const importantFiles = detectImportantFiles(files, contents)
  const confidence = getConfidenceScore("services", arch, files, contents)
  const lines: string[] = [
    "# Service Documentation",
    "",
    "> **Documentation Confidence**: ${confidence}% — Based on detected module structure and file analysis",
    "",
    "---",
    "",
    "## Overview",
    "",
    `This repository contains **${arch.modules.length} module(s)** across **${files.length} file(s)**. ` +
    `The service layer manages business logic, data transformation, and external integrations.`,
    "",
    "### Service Metrics",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Total Modules | ${arch.modules.length} |`,
    `| Service Files | ${serviceFiles.length} |`,
    `| Controllers | ${arch.metrics.controllers} |`,
    `| API Endpoints | ${arch.metrics.apis} |`,
    `| Database Tables | ${arch.metrics.databaseTables} |`,
    `| External Integrations | ${arch.metrics.externalIntegrations} |`,
    "",
  ]

  if (importantFiles.length > 0) {
    lines.push("## Important Files", "")
    lines.push("| File | Purpose | Complexity | Importance |")
    lines.push("| --- | --- | --- | --- |")
    for (const f of importantFiles) {
      lines.push(`| \`${f.name}\` | ${f.purpose} | ${f.complexity} | ${f.importance} |`)
    }
    lines.push("")
  }

  if (arch.moduleDetails) {
    const details = Object.values(arch.moduleDetails)
    const serviceDetails = details.filter(d => d.type === "service" || d.type === "api")
    if (serviceDetails.length > 0) {
      lines.push("## Services", "")
      for (const svc of serviceDetails) {
        lines.push(`### ${svc.name}`)
        lines.push("")
        lines.push(`**Purpose**: ${svc.purpose || `Handles ${svc.businessRole || svc.type} operations in the ${svc.name} domain.`}`)
        lines.push("")
        lines.push("| Attribute | Value |")
        lines.push("| --- | --- |")
        lines.push(`| Type | ${svc.type} |`)
        lines.push(`| Complexity | ${svc.complexity} |`)
        lines.push(`| Risk Level | ${svc.riskLevel} |`)
        lines.push(`| Importance | ${svc.importance} |`)
        lines.push(`| Files | ${svc.fileCount} |`)
        lines.push(`| Lines of Code | ${svc.totalLoc} |`)
        lines.push(`| Maintainability | ${svc.maintainabilityScore}% |`)
        lines.push(`| DB Reads | ${svc.dbReads || "—"} |`)
        lines.push(`| DB Writes | ${svc.dbWrites || "—"} |`)
        if (svc.dependsOn && svc.dependsOn.length > 0) {
          lines.push(`| Dependencies | ${svc.dependsOn.map(d => d.name).join(", ")} |`)
        }
        if (svc.usedBy && svc.usedBy.length > 0) {
          lines.push(`| Used By | ${svc.usedBy.map(d => d.name).join(", ")} |`)
        }
        if (svc.entryPoints && svc.entryPoints.length > 0) {
          lines.push(`| Entry Points | ${svc.entryPoints.join(", ")} |`)
        }
        lines.push("")

        if (svc.dbTables && svc.dbTables.length > 0) {
          lines.push("**Database Tables**: " + svc.dbTables.join(", "))
          lines.push("")
        }

        if (svc.strengths && svc.strengths.length > 0) {
          lines.push("**Responsibilities**:")
          for (const s of svc.strengths) {
            lines.push(`- ✅ ${s}`)
          }
          lines.push("")
        }

        if (svc.risks && svc.risks.length > 0) {
          const highRisks = svc.risks.filter(r => r.severity === "Critical" || r.severity === "High")
          if (highRisks.length > 0) {
            lines.push("**Risks**:")
            for (const risk of highRisks) {
              lines.push(`- ⚠️ **${risk.severity}**: ${risk.description}`)
            }
            lines.push("")
          }
        }

        if (svc.aiExplanation) {
          lines.push("**AI Analysis**:")
          lines.push("")
          lines.push(svc.aiExplanation)
          lines.push("")
        }

        lines.push("---")
        lines.push("")
      }
    }
  }

  if (serviceFiles.length > 0) {
    lines.push("## Service Files", "")
    lines.push("| File | Path |")
    lines.push("| --- | --- |")
    for (const f of serviceFiles) {
      lines.push(`| ${f.name} | \`${f.path}\` |`)
    }
    lines.push("")
  }

  // All modules listed
  lines.push("## All Modules", "")
  lines.push("| Module | Purpose | Complexity | Risk |")
  lines.push("| --- | --- | --- | --- |")
  if (arch.moduleDetails) {
    for (const det of Object.values(arch.moduleDetails)) {
      lines.push(`| ${det.name} | ${det.purpose || "Core module"} | ${det.complexity} | ${det.riskLevel} |`)
    }
  } else {
    for (const mod of arch.modules) {
      lines.push(`| ${mod.name} | Module handling ${mod.name.toLowerCase()} operations | ${arch.complexity.level} | — |`)
    }
  }
  lines.push("")

  return lines.join("\n")
}

function generateDatabase(arch: ArchitectureAnalysis, files: FileInfo[], contents: Record<string, string>): string {
  const allContent = Object.values(contents).join(" ")
  const tablePatterns = [
    { name: "User", pattern: /create\s+table\s+users?|users?\s*\(|User\s*\(|user\.(id|email|name)/gi },
    { name: "Session", pattern: /create\s+table\s+sessions?|sessions?\s*\(|Session\s*\(/gi },
    { name: "Payment", pattern: /create\s+table\s+payments?|payments?\s*\(|Payment\s*\(/gi },
    { name: "Order", pattern: /create\s+table\s+orders?|orders?\s*\(|Order\s*\(/gi },
    { name: "Product", pattern: /create\s+table\s+products?|products?\s*\(|Product\s*\(/gi },
    { name: "Report", pattern: /create\s+table\s+reports?|reports?\s*\(|Report\s*\(/gi },
    { name: "Log", pattern: /create\s+table\s+logs?|logs?\s*\(|Log\s*\(/gi },
    { name: "Config", pattern: /create\s+table\s+config|config\s*\(|Setting\s*\(/gi },
  ]

  const detectedTables = tablePatterns
    .filter(t => t.pattern.test(allContent))
    .map(t => t.name)

  const lines: string[] = [
    "# Database Documentation",
    "",
    "## Overview",
    "",
    arch.databaseConnections && arch.databaseConnections.length > 0
      ? `Database connections detected: ${arch.databaseConnections.join(", ")}.`
      : `This repository uses data persistence with ${detectedTables.length || "various"} table(s) and entities.`,
    "",
  ]

  if (arch.databaseConnections && arch.databaseConnections.length > 0) {
    lines.push("## Database Systems")
    lines.push("")
    for (const db of arch.databaseConnections) {
      lines.push(`- **${db}**`)
    }
    lines.push("")
  }

  lines.push("## Tables & Collections")
  lines.push("")
  if (detectedTables.length > 0) {
    lines.push("| Table | Description |")
    lines.push("| --- | --- |")
    for (const table of detectedTables) {
      lines.push(`| ${table} | Stores ${table.toLowerCase()} data |`)
    }
  } else {
    lines.push("No specific tables detected through static analysis. The following common entity types are expected:")
    lines.push("")
    lines.push("| Entity | Typical Columns |")
    lines.push("| --- | --- |")
    lines.push("| User | id, email, password_hash, created_at |")
    lines.push("| Session | id, user_id, token, expires_at |")
    lines.push("| Audit Log | id, action, user_id, timestamp |")
  }
  lines.push("")

  // ER Diagram
  lines.push("## Entity Relationship Diagram")
  lines.push("")
  lines.push("```mermaid")
  lines.push("erDiagram")
  if (detectedTables.length >= 2) {
    for (let i = 0; i < detectedTables.length; i++) {
      const table = detectedTables[i]
      lines.push(`  ${table} {`)
      lines.push(`    int id PK`)
      lines.push(`    string ${table.toLowerCase()}_data`)
      if (i > 0) {
        lines.push(`    int ${detectedTables[i - 1].toLowerCase()}_id FK`)
      }
      lines.push(`    datetime created_at`)
      lines.push(`  }`)
    }
    for (let i = 1; i < detectedTables.length; i++) {
      lines.push(`  ${detectedTables[i - 1]} ||--o{ ${detectedTables[i]} : has`)
    }
  } else {
    lines.push("  Entity {")
    lines.push("    int id PK")
    lines.push("    string name")
    lines.push("    string description")
    lines.push("    datetime created_at")
    lines.push("  }")
  }
  lines.push("```")
  lines.push("")

  // Module details with DB info
  if (arch.moduleDetails) {
    const dbModules = Object.values(arch.moduleDetails).filter(d => d.dbTables && d.dbTables.length > 0)
    if (dbModules.length > 0) {
      lines.push("## Module Table Mappings")
      lines.push("")
      for (const mod of dbModules) {
        lines.push(`### ${mod.name}`)
        lines.push("")
        lines.push(`| Table | Reads | Writes |`)
        lines.push(`| --- | --- | --- |`)
        for (const table of (mod.dbTables || [])) {
          lines.push(`| ${table} | ${mod.dbReads || "—"} | ${mod.dbWrites || "—"} |`)
        }
        lines.push("")
      }
    }
  }

  return lines.join("\n")
}

function generateDependencies(arch: ArchitectureAnalysis, files: FileInfo[]): string {
  const details = arch.moduleDetails ? Object.values(arch.moduleDetails) : []
  const confidence = getConfidenceScore("dependencies", arch, files, {})
  const lines: string[] = [
    "# Dependency Documentation",
    "",
    "> **Documentation Confidence**: ${confidence}% — Based on detected module relationships and import analysis",
    "",
    "---",
    "",
    "## Overview",
    "",
    `This repository has **${arch.criticalDependencies || 0} critical dependencies** and **${arch.circularDependencies || 0} circular dependencies** ` +
    `across **${arch.nodes.length} component(s)** and **${arch.edges.length} relationship(s)**.`,
    "",
    "### Dependency Summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Total Components | ${arch.nodes.length} |`,
    `| Total Relationships | ${arch.edges.length} |`,
    `| Critical Dependencies | ${arch.criticalDependencies || 0} |`,
    `| Circular Dependencies | ${arch.circularDependencies || 0} |`,
    `| Database Connections | ${arch.databaseConnections.length} |`,
    `| External APIs | ${arch.externalAPIs.length} |`,
    "",
  ]

  if (arch.moduleDetails) {
    lines.push("## Module Dependencies", "")
    lines.push("| Module | Depends On | Used By | Risk |")
    lines.push("| --- | --- | --- | --- |")
    for (const mod of details) {
      const dependsOn = mod.dependsOn?.length > 0 ? mod.dependsOn.map(d => d.name).join(", ") : "None"
      const usedBy = mod.usedBy?.length > 0 ? mod.usedBy.map(d => d.name).join(", ") : "None"
      lines.push(`| ${mod.name} | ${dependsOn} | ${usedBy} | ${mod.riskLevel} |`)
    }
    lines.push("")
  }

  if (arch.nodes && arch.nodes.length > 0 && arch.edges && arch.edges.length > 0) {
    lines.push("## Dependency Graph", "")
    lines.push("```mermaid")
    lines.push("graph LR")
    for (const node of arch.nodes.slice(0, 15)) {
      lines.push(`  ${node.id}["${node.label}"]:::${node.type}`)
    }
    for (const edge of arch.edges.slice(0, 30)) {
      lines.push(`  ${edge.source} -->|"${edge.relation}"| ${edge.target}`)
    }
    lines.push("  classDef module fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0")
    lines.push("  classDef service fill:#1e293b,stroke:#475569,color:#e2e8f0")
    lines.push("  classDef file fill:#0f172a,stroke:#334155,color:#94a3b8")
    lines.push("  classDef layer fill:#312e81,stroke:#6366f1,color:#e0e7ff")
    lines.push("```")
    lines.push("")
  }

  const allRisks = details.flatMap(d => (d.risks || []).filter(r => r.severity === "Critical" || r.severity === "High"))
  if (allRisks.length > 0) {
    lines.push("## Detected Risks", "")
    lines.push("| Severity | Module | Description |")
    lines.push("| --- | --- | --- |")
    for (const risk of allRisks) {
      const mod = details.find(d => d.risks?.includes(risk))
      lines.push(`| ${risk.severity} | ${mod?.name || "—"} | ${risk.description} |`)
    }
    lines.push("")
  }

  if (arch.databaseConnections.length > 0) {
    lines.push("## External Dependencies", "")
    for (const db of arch.databaseConnections) {
      lines.push(`- **${db}** — Data persistence layer`)
    }
    for (const api of arch.externalAPIs) {
      lines.push(`- **${api}** — External service integration`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function generateDataflow(files: FileInfo[], contents: Record<string, string>, arch: ArchitectureAnalysis): string {
  const allContent = Object.values(contents).join(" ")
  const modNames = arch.modules.map(m => m.name.toLowerCase()).join(" ")
  const confidence = getConfidenceScore("dataflow", arch, files, contents)

  const hasAuth = /auth|login|register|token|jwt/i.test(allContent) || /auth/i.test(modNames)
  const hasPayment = /payment|stripe|charge|invoice|checkout/i.test(allContent) || /payment/i.test(modNames)
  const hasNotification = /notif|email|sms|push|alert|mail/i.test(allContent)
  const hasAnalytics = /analytics|metric|track|report|insight/i.test(allContent) || /analytics|report/i.test(modNames)
  const hasUser = /user|profile|account/i.test(modNames) || /user|profile|account/i.test(allContent)
  const hasMl = /model|train|predict|ml /i.test(modNames) || /sklearn|tensorflow|pytorch|model\.predict/i.test(allContent)

  const lines: string[] = [
    "# Data Flow Documentation",
    "",
    "> **Documentation Confidence**: ${confidence}% — Flows inferred from module names, file content, and architecture",
    "",
    "---",
    "",
    "## Overview",
    "",
    "This section documents how data moves through the system, from initial request to final response. " +
    `${arch.entryPoints.length > 0 ? `Requests enter via **${arch.entryPoints.length} entry point(s)**` : "Requests flow through the application"} ` +
    `and are processed by **${arch.modules.length} module(s)** ` +
    `${arch.databaseConnections.length > 0 ? `with data persisted in **${arch.databaseConnections.join(", ")}**.` : "."}`,
    "",
  ]

  const flows: { name: string; steps: string[]; mermaidEdges: string[] }[] = []

  if (hasAuth) {
    flows.push({
      name: "Authentication Flow",
      steps: [
        "User submits login credentials",
        "Frontend sends POST /auth/login request",
        "Auth Controller validates input format",
        "Auth Service verifies credentials against user store",
        "User Repository queries database for user record",
        "Database returns user record with hashed password",
        "Auth Service compares password hash",
        "Auth Service generates signed JWT token",
        "Response returns access token to client",
      ],
      mermaidEdges: [
        'User["User"] -->|"submits credentials"| Frontend["Frontend"]',
        'Frontend -->|"POST /auth/login"| AuthCtrl["Auth Controller"]',
        'AuthCtrl -->|"validates"| AuthSvc["Auth Service"]',
        'AuthSvc -->|"queries"| UserRepo["User Repository"]',
        'UserRepo -->|"SQL query"| DB[("Database")]',
        'DB -->|"user record"| UserRepo',
        'UserRepo -->|"User entity"| AuthSvc',
        'AuthSvc -->|"JWT token"| AuthCtrl',
        'AuthCtrl -->|"200 OK + token"| Frontend',
        'Frontend -->|"response"| User',
      ],
    })
  }

  if (hasPayment) {
    flows.push({
      name: "Payment Flow",
      steps: [
        "User submits payment details",
        "Frontend sends POST /payments/charge request",
        "Auth middleware validates JWT token from header",
        "Payment Controller validates payment payload",
        "Payment Service processes payment via Stripe API",
        "Stripe API charges payment method",
        "Payment Service records transaction in database",
        "Database persists payment record with status",
        "Response returns payment confirmation to client",
      ],
      mermaidEdges: [
        'User["User"] -->|"payment details"| Frontend["Frontend"]',
        'Frontend -->|"POST /payments/charge"| PaymentCtrl["Payment Controller"]',
        'PaymentCtrl -->|"validates"| PaymentSvc["Payment Service"]',
        'PaymentSvc -->|"charge"| Stripe["Stripe API"]',
        'Stripe -->|"confirmation"| PaymentSvc',
        'PaymentSvc -->|"persists"| DB[("Database")]',
        'DB -->|"receipt"| PaymentSvc',
        'PaymentSvc -->|"result"| PaymentCtrl',
        'PaymentCtrl -->|"200 OK"| Frontend',
        'Frontend -->|"confirmation"| User',
      ],
    })
  }

  if (hasNotification) {
    flows.push({
      name: "Notification Flow",
      steps: [
        "System event triggers notification requirement",
        "Notification Service prepares message template",
        "Email/SMS Service formats message for channel",
        "External provider delivers notification",
        "Database logs delivery status for audit",
      ],
      mermaidEdges: [
        'Event["System Event"] -->|"triggers"| NotifSvc["Notification Service"]',
        'NotifSvc -->|"formats"| Channel["Email / SMS Service"]',
        'Channel -->|"delivers"| Provider["External Provider"]',
        'Provider -->|"status"| Channel',
        'Channel -->|"logs"| DB[("Database")]',
      ],
    })
  }

  if (hasAnalytics) {
    flows.push({
      name: "Analytics Flow",
      steps: [
        "User action is captured by frontend event tracking",
        "Analytics event sent to processing pipeline",
        "Event processor validates and enriches data",
        "Aggregation layer computes metrics and insights",
        "Data warehouse stores processed metrics",
        "Dashboard queries and visualizes insights",
      ],
      mermaidEdges: [
        'User["User Action"] -->|"tracked"| Frontend["Frontend"]',
        'Frontend -->|"event"| AnalyticsSvc["Analytics Service"]',
        'AnalyticsSvc -->|"processes"| Aggregator["Aggregation Layer"]',
        'Aggregator -->|"stores"| DW[("Data Warehouse")]',
        'Dashboard["Dashboard"] -->|"queries"| DW',
      ],
    })
  }

  if (hasUser) {
    flows.push({
      name: "User Management Flow",
      steps: [
        "Client sends request for user data",
        "User Controller receives and routes request",
        "User Service executes business logic",
        "User Repository queries database for user records",
        "Database returns user data",
        "Response returns processed user data to client",
      ],
      mermaidEdges: [
        'Client["Client"] -->|"HTTP request"| UserCtrl["User Controller"]',
        'UserCtrl -->|"routes"| UserSvc["User Service"]',
        'UserSvc -->|"queries"| UserRepo["User Repository"]',
        'UserRepo -->|"SQL"| DB[("Database")]',
        'DB -->|"records"| UserRepo',
        'UserRepo -->|"data"| UserSvc',
        'UserSvc -->|"response"| UserCtrl',
        'UserCtrl -->|"HTTP response"| Client',
      ],
    })
  }

  if (hasMl) {
    flows.push({
      name: "ML Prediction Flow",
      steps: [
        "Input data is collected or submitted for prediction",
        "Feature engineering transforms raw data into features",
        "Preprocessed features are passed to ML model",
        "Trained model generates prediction score",
        "Prediction result is returned with confidence metrics",
      ],
      mermaidEdges: [
        'Input["Input Data"] -->|"features"| Features["Feature Engineering"]',
        'Features -->|"transformed"| Model["ML Model"]',
        'Model -->|"score"| Result["Prediction Result"]',
      ],
    })
  }

  if (arch.entryPoints && arch.entryPoints.length > 0) {
    flows.push({
      name: "General Request Flow",
      steps: [
        ...arch.entryPoints.slice(0, 3).map(ep => `Client request reaches ${ep}`),
        "Request is validated and routed to appropriate controller",
        "Controller delegates to service for business logic",
        "Service interacts with data layer as needed",
        "Response is processed and returned to client",
      ],
      mermaidEdges: [
        "Client[\"Client\"] -->|\"request\"| Entry[(\"" + arch.entryPoints[0].replace(/[^a-zA-Z0-9]/g, " ") + "\")]",
        'Entry -->|"routes"| Ctrl["Controller"]',
        'Ctrl -->|"delegates"| Svc["Service"]',
        'Svc -->|"queries"| DB[("Data Layer")]',
        'DB -->|"result"| Svc',
        'Svc -->|"response"| Ctrl',
        'Ctrl -->|"HTTP"| Client',
      ],
    })
  }

  if (flows.length === 0) {
    flows.push({
      name: "Standard Request Flow",
      steps: [
        "Client request enters the application",
        "Router matches request to appropriate handler",
        "Handler validates input and processes request",
        "Business logic executes with data layer access",
        "Response is assembled and returned to client",
      ],
      mermaidEdges: [
        'Client["Client"] -->|"HTTP"| Router["Router"]',
        'Router -->|"match"| Handler["Handler"]',
        'Handler -->|"process"| Logic["Business Logic"]',
        'Logic -->|"data"| DB[("Data Layer")]',
        'DB -->|"result"| Logic',
        'Logic -->|"response"| Handler',
        'Handler -->|"HTTP"| Client',
      ],
    })
  }

  for (const flow of flows) {
    lines.push(`## ${flow.name}`)
    lines.push("")
    lines.push("```mermaid")
    lines.push("flowchart LR")
    for (const edge of flow.mermaidEdges) {
      lines.push(`  ${edge}`)
    }
    lines.push("```")
    lines.push("")

    lines.push("### Steps")
    lines.push("")
    for (let i = 0; i < flow.steps.length; i++) {
      lines.push(`${i + 1}. ${flow.steps[i]}`)
    }
    lines.push("")
  }

  if (arch.entryPoints && arch.entryPoints.length > 0) {
    lines.push("## Entry Points", "")
    for (const ep of arch.entryPoints) {
      lines.push(`- \`${ep}\``)
    }
    lines.push("")
  }

  if (arch.databaseConnections.length > 0) {
    lines.push("## Database Interactions", "")
    lines.push(`Data is persisted using **${arch.databaseConnections.join(", ")}**. ` +
      "Modules interact with the database through repositories or direct queries.")
    lines.push("")
  }

  return lines.join("\n")
}

function generateSetup(arch: ArchitectureAnalysis, files: FileInfo[], repoName: string): string {
  const hasDocker = files.some(f => /docker/i.test(f.name) || f.name === "Dockerfile")
  const hasPackage = files.some(f => /package\.json|requirements\.txt|go\.mod|Cargo\.toml|Gemfile/i.test(f.name))
  const hasEnv = files.some(f => /\.env|env\.example|\.env\.sample/i.test(f.name))
  const hasCompose = files.some(f => /docker-compose/i.test(f.name))
  const hasMakefile = files.some(f => /makefile|justfile/i.test(f.name))
  const frameworks = Object.keys(arch.frameworks || {})

  const lines: string[] = [
    "# Setup Documentation",
    "",
    "## Prerequisites",
    "",
    "Before setting up this project, ensure you have:",
    "",
  ]

  if (frameworks.length > 0) {
    for (const fw of frameworks) {
      const version = arch.frameworks[fw]
      lines.push(`- **${fw}** ${version || "(latest)"}`)
    }
  }

  lines.push(
    "",
    "## Installation",
    "",
  )

  if (hasPackage) {
    if (files.some(f => f.name === "package.json")) {
      lines.push("### Node.js / npm", "", "```bash", "npm install", "```", "")
    }
    if (files.some(f => f.name === "requirements.txt")) {
      lines.push("### Python / pip", "", "```bash", "pip install -r requirements.txt", "```", "")
    }
    if (files.some(f => /go\.mod/i.test(f.name))) {
      lines.push("### Go", "", "```bash", "go mod download", "```", "")
    }
  }

  if (hasDocker) {
    lines.push("### Docker", "", "```bash", hasCompose ? "docker-compose up -d" : "docker build -t app .\ndocker run app", "```", "")
  }

  if (hasEnv) {
    lines.push("## Environment Configuration", "")
    lines.push("Copy the environment template and configure your settings:", "")
    lines.push("```bash", "cp .env.example .env", "```", "")
    lines.push("Edit `.env` with your local configuration values.")
    lines.push("")
  }

  lines.push("## Running the Application", "")
  if (hasMakefile) {
    lines.push("```bash", "make dev", "```", "")
  } else if (frameworks.some(f => /nest/i.test(f))) {
    lines.push("```bash", "npm run start:dev", "```", "")
  } else if (frameworks.some(f => /fastapi|flask|django/i.test(f))) {
    lines.push("```bash", "uvicorn app.main:app --reload", "```", "")
  } else {
    lines.push("```bash", "# Start the development server", "npm run dev", "```", "")
  }

  return lines.join("\n")
}

function generateDeployment(arch: ArchitectureAnalysis, files: FileInfo[]): string {
  const hasDocker = files.some(f => /docker/i.test(f.name))
  const hasCi = files.some(f => /\.github|\.gitlab-ci|jenkins|circle/i.test(f.path))
  const hasK8s = files.some(f => /k8s|kubernetes|helm/i.test(f.path))

  const lines: string[] = [
    "# Deployment Documentation",
    "",
    "## Overview",
    "",
    `This repository is a ${arch.type.toLowerCase()} project with ${arch.modules.length} module(s) and ${arch.metrics.totalFiles} file(s).`,
    "",
  ]

  if (hasDocker) {
    lines.push(
      "## Docker Deployment",
      "",
      "### Build Image",
      "",
      "```bash",
      "docker build -t app:latest .",
      "```",
      "",
      "### Run Container",
      "",
      "```bash",
      "docker run -d -p 3000:3000 --name app app:latest",
      "```",
      "",
    )
  }

  if (hasK8s) {
    lines.push(
      "## Kubernetes Deployment",
      "",
      "```bash",
      "kubectl apply -f k8s/",
      "```",
      "",
    )
  }

  lines.push(
    "## Environment Variables",
    "",
    "| Variable | Description | Required |",
    "| --- | --- | --- |",
    "| `PORT` | Application port | Yes |",
    "| `DATABASE_URL` | Database connection string | Yes |",
    "| `JWT_SECRET` | Authentication secret | Yes |",
    "| `REDIS_URL` | Redis connection (optional) | No |",
    "| `LOG_LEVEL` | Logging level | No |",
    "",
  )

  lines.push(
    "## Health Checks",
    "",
    "| Endpoint | Description |",
    "| --- | --- |",
    "| `/health` | Basic health check |",
    "| `/ready` | Readiness probe |",
    "| `/metrics` | Application metrics |",
    "",
  )

  if (hasCi) {
    lines.push("## CI/CD Pipeline", "", "Continuous integration is configured for this project. The pipeline handles:")
    lines.push("")
    lines.push("- Code linting and formatting")
    lines.push("- Unit and integration tests")
    lines.push("- Security scanning")
    lines.push("- Build and publish")
    lines.push("- Deployment to target environment")
    lines.push("")
  }

  return lines.join("\n")
}

function generateAIGuide(arch: ArchitectureAnalysis, files: FileInfo[], contents: Record<string, string>, repoName: string, tree: RepositoryTreeNode[]): string {
  const details = arch.moduleDetails ? Object.values(arch.moduleDetails) : []
  const allRisks = details.flatMap(d => (d.risks || []).filter(r => r.severity === "Critical" || r.severity === "High"))
  const allStrengths = details.flatMap(d => (d.strengths || []))
  const allRecommendations = details.flatMap(d => (d.recommendations || []))
  const business = detectBusinessDomain(arch, files, repoName)
  const importantFiles = detectImportantFiles(files, contents)
  const confidence = getConfidenceScore("ai_guide", arch, files, contents)

  const lines: string[] = [
    "# AI Repository Guide",
    "",
    "> **Documentation Confidence**: ${confidence}% — AI-generated insights based on static code analysis",
    "",
    "---",
    "",
    "## Explain Like I'm New (5-Minute Overview)",
    "",
    `${repoName} is a **${business.domain}** application. ` +
    `It contains **${files.length} files** organized into **${arch.modules.length} module(s)** ` +
    `with **${arch.entryPoints.length} entry point(s)**. ` +
    `The codebase follows a **${arch.type}** architecture pattern.`,
    "",
    business.domain !== "General Application" ? [
      "The system helps:",
      ...business.users.map(u => `- **${u}**`),
      "",
      "By enabling:",
      ...business.goals.map(g => `- ${g}`),
      "",
    ].join("\n") : "",
    "To start exploring:",
    arch.entryPoints.length > 0 ? `1. Start at **\`${arch.entryPoints[0]}\`** — the main entry point` : "",
    arch.modules.length > 0 ? `2. Understand **${arch.modules[0].name}** — the primary module` : "",
    "3. Trace the request flow: Entry → Controller → Service → Data",
    "",
    "## Key Components",
    "",
  ]

  if (details.length > 0) {
    lines.push("| Component | Type | Purpose | Complexity | Dependencies |")
    lines.push("| --- | --- | --- | --- | --- |")
    for (const det of details.slice(0, 8)) {
      const deps = det.dependsOn?.map(d => d.name).join(", ") || "None"
      lines.push(`| ${det.name} | ${det.type} | ${det.purpose || "Core component"} | ${det.complexity} | ${deps} |`)
    }
    lines.push("")
  }

  if (allStrengths.length > 0 || arch.insights.filter(i => i.type === "strength").length > 0) {
    lines.push("## Strengths", "")
    const strengths = [...new Set(allStrengths)]
    const insightStrengths = arch.insights.filter(i => i.type === "strength").map(i => i.title)
    const combined = [...strengths, ...insightStrengths].slice(0, 6)
    if (combined.length > 0) {
      for (const s of combined) {
        lines.push(`- ✅ ${s}`)
      }
    } else {
      lines.push("- Clean architecture separation of concerns")
      lines.push("- Well-defined module boundaries")
    }
    lines.push("")
  }

  if (allRisks.length > 0) {
    lines.push("## Risks & Bottlenecks", "")
    for (const risk of allRisks.slice(0, 5)) {
      lines.push(`- ⚠️ **${risk.severity}**: ${risk.description}`)
    }
    lines.push("")
  }

  if (arch.insights.length > 0) {
    const nonStrengthInsights = arch.insights.filter(i => i.type !== "strength")
    if (nonStrengthInsights.length > 0) {
      lines.push("## Architectual Insights", "")
      for (const insight of nonStrengthInsights) {
        const icon = insight.type === "weakness" ? "⚠️" : insight.type === "risk" ? "🚨" : "💡"
        lines.push(`### ${icon} ${insight.title}`, "", insight.description, "")
      }
    }
  }

  if (allRecommendations.length > 0) {
    lines.push("## Recommendations", "")
    const unique = [...new Set(allRecommendations)].slice(0, 5)
    for (const r of unique) {
      lines.push(`- 💡 ${r}`)
    }
    lines.push("")
  }

  if (arch.insights.some(i => i.type === "recommendation")) {
    const recs = arch.insights.filter(i => i.type === "recommendation")
    lines.push("## Improvements", "")
    for (const r of recs) {
      lines.push(`- 💡 ${r.title}: ${r.description}`)
    }
    lines.push("")
  }

  if (importantFiles.length > 0) {
    lines.push("## Important Files", "")
    lines.push("| File | Purpose | Complexity | Importance |")
    lines.push("| --- | --- | --- | --- |")
    for (const f of importantFiles) {
      lines.push(`| \`${f.name}\` | ${f.purpose} | ${f.complexity} | ${f.importance} |`)
    }
    lines.push("")
  }

  lines.push("## Developer Onboarding Guide", "")
  lines.push("### Where to Start", "")
  if (arch.entryPoints.length > 0) {
    lines.push(`1. **Read the entry point**: \`${arch.entryPoints[0]}\` — this is where the application starts`)
  } else {
    lines.push("1. **Find the entry point**: Look for `main.*`, `index.*`, or `app.*` files")
  }
  lines.push("2. **Understand the architecture**: Review the Architecture section for layers and modules")
  if (details.length > 0) {
    const lowRisk = details.filter(d => d.riskLevel === "Low" || d.riskLevel === "Medium").sort((a, b) => a.totalLoc - b.totalLoc)
    if (lowRisk.length > 0) {
      lines.push(`3. **Start with**: \`${lowRisk[0].name}\` — lowest complexity module (${lowRisk[0].complexity} complexity, ${lowRisk[0].riskLevel} risk)`)
    }
  }
  lines.push("4. **Trace a request flow**: Follow Entry Point → Controller → Service → Database")
  lines.push("5. **Run the tests**: Verify your setup by running the test suite")
  lines.push("")

  lines.push("### Common Workflows", "")
  const hasAuth = contents ? Object.values(contents).some(c => /auth|login|register/i.test(c)) : false
  const hasCrud = contents ? Object.values(contents).some(c => /find|create|update|delete|save|repository/i.test(c)) : false
  if (hasAuth) lines.push("- **Authentication**: Login, register, and token management workflow")
  if (hasCrud) lines.push("- **CRUD Operations**: Standard create, read, update, delete patterns")
  lines.push("- **Build & Deploy**: Compile, test, and deploy the application")
  lines.push("")

  lines.push("## Module Overview", "")
  lines.push("| Module | Type | Files | Risk | Importance |")
  lines.push("| --- | --- | --- | --- | --- |")
  for (const mod of arch.modules) {
    const det = details.find(d => d.id === `module-${mod.name}` || d.name.toLowerCase() === mod.name.toLowerCase())
    lines.push(`| ${mod.name} | ${mod.type} | ${mod.files} | ${det?.riskLevel || "—"} | ${det?.importance || "—"} |`)
  }
  lines.push("")

  if (arch.insights.length > 0) {
    lines.push("## Architecture Insights", "")
    for (const insight of arch.insights) {
      const icon = insight.type === "strength" ? "✅" : insight.type === "weakness" ? "⚠️" : insight.type === "risk" ? "🚨" : "💡"
      lines.push(`### ${icon} ${insight.title}`, "", insight.description, "")
    }
  }

  return lines.join("\n")
}

export function generateDocumentation(
  repoName: string,
  arch: ArchitectureAnalysis,
  tree: RepositoryTreeNode[],
  contents: Record<string, string>,
): {
  overview: string
  architecture: string
  api: string
  services: string
  database: string
  dependencies: string
  dataflow: string
  setup: string
  deployment: string
  ai_guide: string
} {
  const files = flattenTree(tree)
  const metrics = getMetricsSummary(arch)

  return {
    overview: generateOverview(repoName, arch, files, contents, tree),
    architecture: generateArchitecture(arch, files, contents),
    api: generateApi(files, contents, arch),
    services: generateServices(arch, files, contents),
    database: generateDatabase(arch, files, contents),
    dependencies: generateDependencies(arch, files),
    dataflow: generateDataflow(files, contents, arch),
    setup: generateSetup(arch, files, repoName),
    deployment: generateDeployment(arch, files),
    ai_guide: generateAIGuide(arch, files, contents, repoName, tree),
  }
}
