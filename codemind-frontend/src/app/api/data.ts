import fs from "fs"
import path from "path"
import type { Repository, AnalysisResult, DashboardStats, RepositoryTreeNode, OnboardingPlan } from "@/types"

const CACHE_DIR = path.join(process.cwd(), ".data-cache")
const CACHE_FILE = path.join(CACHE_DIR, "api-data.json")

interface DataCache {
  repositories: Repository[]
  fileTrees: Record<string, RepositoryTreeNode[]>
  fileContents: Record<string, Record<string, string>>
  analyses: Record<string, AnalysisResult>
  onboardingPlans: Record<string, OnboardingPlan>
}

function loadCache(): DataCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    const raw = fs.readFileSync(CACHE_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveCache(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
    const data: DataCache = {
      repositories,
      fileTrees,
      fileContents,
      analyses,
      onboardingPlans,
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8")
  } catch (e) {
    console.error("Failed to persist data cache:", e)
  }
}

const cached = loadCache()

function genDocFromAnalysis(analysis: AnalysisResult): Record<string, string> {
  const { repository: repo, architecture, dependencies: deps, dataFlow } = analysis
  const name = repo.name || "repository"
  const url = repo.url || ""
  const lang = repo.language || "Unknown"
  const modules = architecture?.modules || []
  const moduleList = modules.map(m => `- **${m.name}**`).join("\n")
  const ins = architecture?.insights || []
  const metrics = architecture?.metrics
  const edges = architecture?.edges || []
  const archNodes = architecture?.nodes || []
  const depsGraph = deps?.graph

  const archMermaid = edges.length > 0
    ? `\`\`\`mermaid\ngraph TD\n${edges.map(e => `  ${archNodes.find(n => n.id === e.source)?.label?.replace(/\s+/g, "_") || e.source} --> ${archNodes.find(n => n.id === e.target)?.label?.replace(/\s+/g, "_") || e.target}`).join("\n")}\n\`\`\``
    : "No architecture diagram available."

  const flowMermaid = dataFlow?.flowDiagram
    ? `\`\`\`mermaid\n${dataFlow.flowDiagram}\n\`\`\``
    : dataFlow?.flow?.length
    ? `\`\`\`mermaid\nflowchart LR\n  A[${name}] --> B[${lang}]\n\`\`\``
    : ""

  const seqMermaid = dataFlow?.sequenceDiagram
    ? `\`\`\`mermaid\n${dataFlow.sequenceDiagram}\n\`\`\``
    : ""

  const depMermaid = depsGraph?.edges?.length
    ? `\`\`\`mermaid\ngraph LR\n${depsGraph.edges.map(e => {
        const s = depsGraph.nodes.find(n => n.id === e.source)?.label?.replace(/[^a-zA-Z0-9]/g, "_") || e.source
        const t = depsGraph.nodes.find(n => n.id === e.target)?.label?.replace(/[^a-zA-Z0-9]/g, "_") || e.target
        return `  ${s} --> ${t}`
      }).join("\n")}\n\`\`\``
    : ""

  return {
    overview: `# Repository Overview\n\n**${name}**\n${url ? `\n${url}` : ""}\n\n## Repository Statistics\n\n| Metric | Value |\n|--------|-------|\n| Language | ${lang} |\n| Total Files | ${metrics?.totalFiles || repo.totalFiles} |\n| Total Lines | ${(metrics?.totalLines || repo.totalLines).toLocaleString()} |\n| Total Classes | ${metrics?.totalClasses || repo.totalClasses} |\n| Total Functions | ${metrics?.totalFunctions || repo.totalFunctions} |\n| Architecture | ${architecture?.type || "Unknown"} |\n\n## Technology Stack\n- **Language:** ${lang}\n- **Architecture Pattern:** ${architecture?.type || "Not detected"}\n${architecture?.frameworks ? Object.keys(architecture.frameworks).map(f => `- **${f}**`).join("\n") : ""}\n\n## Main Components\n${moduleList || "- No modules detected"}\n\n## Summary\n${architecture?.summary || "Repository documentation generated from analysis."}`,

    architecture: `# Architecture Documentation\n\n## Architecture Pattern\n**${architecture?.type || "Not detected"}** — Confidence: ${architecture?.typeScore || 0}% (${architecture?.typeConfidence || "N/A"})\n\n## Layers\n${(architecture?.layers || []).map(l => `- **${l.name}** — ${l.description || ""}`).join("\n") || "- No layers detected"}\n\n## Modules\n\n${moduleList || "- No modules detected"}\n\n## Architecture Diagram\n\n${archMermaid}\n\n## Metrics\n\n| Metric | Value |\n|--------|-------|\n| Maintainability Score | ${architecture?.maintainabilityScore || "N/A"} |\n| Complexity Level | ${architecture?.complexity?.level || "N/A"} |\n| Complexity Score | ${architecture?.complexity?.score || "N/A"} |\n| Circular Dependencies | ${architecture?.circularDependencies || 0} |\n\n## Insights\n${ins.map(i => `- **${i.title}** (${i.type}): ${i.description || ""}`).join("\n") || "- No insights available"}`,

    api: `# API Documentation\n\n## API Routes\n\n${(dataFlow?.routes || []).length > 0
      ? dataFlow!.routes!.map(r => `### ${r.method} \`${r.path}\`\n- **File:** \`${r.file}\``).join("\n\n")
      : "No API routes detected.\n\n## Notes\n- API endpoints are automatically detected during analysis\n- Routes, schemas, and authentication details will appear here once available"}\n\n## External Integrations\n${(architecture?.externalAPIs || []).length > 0
      ? architecture!.externalAPIs!.map(a => `- **${a}**`).join("\n")
      : "- No external API integrations detected"}`,

    services: `# Service Documentation\n\n## Services & Modules\n\n${modules.length > 0
      ? modules.map(m => `### ${m.name}\n- **Type:** ${m.type || "Module"}\n- **Files:** ${m.files || "N/A"}`).join("\n\n")
      : "- No services detected"}\n\n## Database Connections\n${(architecture?.databaseConnections || []).length > 0
      ? architecture!.databaseConnections!.map(d => `- **${d}**`).join("\n")
      : "- No database connections configured"}\n\n## Module Dependencies\n${(architecture?.edges || []).filter(e => e.relation === "DEPENDS_ON").map(e => {
        const src = archNodes.find(n => n.id === e.source)?.label || e.source
        const tgt = archNodes.find(n => n.id === e.target)?.label || e.target
        return `- **${src}** depends on **${tgt}**`
      }).join("\n") || "- No module dependencies mapped"}`,

    database: `# Database Documentation\n\n## Database Connections\n- ${(architecture?.databaseConnections || []).join("\n- ") || "No database connections detected"}\n\n## Schema Overview\n${(architecture?.databaseConnections || []).length > 0
      ? "Run a full analysis to extract table schemas, relationships, indexes, and migrations."
      : "No database schema files detected in this repository."}\n\n## Data Layer\n${(depsGraph?.nodes || []).filter(n => /database|model|entity|schema|repository|dal/i.test(n.label || n.id)).map(n => `- **${n.label || n.id}** (${n.type})`).join("\n") || "- No data layer components identified"}`,

    dependencies: `# Dependency Documentation\n\n## Module Dependency Graph\n\n${depMermaid || archMermaid}\n\n## Internal Dependencies\n${edges.length > 0
      ? edges.map(e => {
          const src = archNodes.find(n => n.id === e.source)?.label || e.source
          const tgt = archNodes.find(n => n.id === e.target)?.label || e.target
          return `- **${src}** → **${tgt}** (${e.relation})`
        }).join("\n")
      : "- No internal dependencies mapped"}\n\n## External Dependencies\n${(deps?.externalDependencies || []).length > 0
      ? deps!.externalDependencies!.map(d => `- \`${d}\``).join("\n")
      : "- Run full analysis to detect external packages"}\n\n## Dependency Summary\n- **Files with imports:** ${deps?.summary?.filesWithImports || 0}\n- **Total import statements:** ${deps?.summary?.totalImportStatements || 0}\n- **Unique external dependencies:** ${deps?.summary?.uniqueExternalDependencies || 0}\n- **Circular dependencies:** ${(deps?.circularDependencies || []).length || (architecture?.circularDependencies || 0)}\n\n## Hotspots\n${(deps?.hotspots || []).length > 0
      ? deps!.hotspots!.map(h => `- **${h.module}** — referenced by ${h.referencedBy} files`).join("\n")
      : "- No hotspots detected"}`,

    dataflow: `# Data Flow Documentation\n\n## Flow Diagram\n\n${flowMermaid}\n\n## Sequence Diagram\n\n${seqMermaid}\n\n## Request Lifecycle\n${(dataFlow?.flow || []).length > 0
      ? dataFlow!.flow!.map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "1. Request enters the application\n2. Processing occurs\n3. Response is returned"}\n\n## API Routes\n${(dataFlow?.routes || []).length > 0
      ? dataFlow!.routes!.map(r => `- **${r.method}** \`${r.path}\` → \`${r.file}\``).join("\n")
      : "- No routes mapped"}`,

    setup: `# Setup Documentation\n\n## Prerequisites\n- **${lang}** runtime environment\n- Package manager for ${lang}\n\n## Installation\n\`\`\`bash\ngit clone ${url || "<repository-url>"}\ncd ${name}\n\`\`\`\n\n## Configuration\nCreate environment configuration:\n\`\`\`\n# Configure based on your environment\n\`\`\`\n\n## Running the Application\nRefer to the repository's documentation or package scripts for run commands.`,

    deployment: `# Deployment Documentation\n\n## Deployment Options\n- **Standard:** Clone and run the application\n- **Docker:** Build and run with Docker if a Dockerfile is present\n- **CI/CD:** Configure pipeline via GitHub Actions or similar\n\n## Environment Variables\n\`\`\`\n# Required environment variables for deployment\n# Configure based on your deployment target\n\`\`\`\n\n## Production Checklist\n- [ ] Configure production database\n- [ ] Set up logging and monitoring\n- [ ] Configure environment variables\n- [ ] Enable HTTPS\n- [ ] Set up backup strategy`,

    ai_guide: `# AI Repository Guide\n\n## Summary\n**${name}** is a ${lang} repository ${architecture?.summary ? `— ${architecture.summary}` : ""}\n\n## How to Get Started\n1. **Clone** the repository\n2. **Install** dependencies\n3. **Configure** environment variables\n4. **Run** the application\n\n## Architecture Overview\n${architecture?.type || "Layered"} architecture\n- **Modules:** ${modules.length}\n- **Total Files:** ${metrics?.totalFiles || repo.totalFiles}\n- **Total Lines:** ${(metrics?.totalLines || repo.totalLines).toLocaleString()}\n\n## Key Components\n${moduleList || "- No modules identified"}\n\n## Strengths\n${ins.filter(i => i.type === "strength").map(i => `- ${i.title}: ${i.description || ""}`).join("\n") || "- No strengths identified"}\n\n## Risks\n${ins.filter(i => i.type === "risk").map(i => `- ${i.title}: ${i.description || ""}`).join("\n") || "- No risks identified"}\n\n## Recommendations\n${ins.filter(i => i.type === "recommendation").map(i => `- ${i.title}: ${i.description || ""}`).join("\n") || "- Run full analysis for recommendations"}`,
  }
}

function ensureDocFields(doc: Record<string, string> | undefined, analysis?: AnalysisResult): Record<string, string> {
  if (!doc) doc = {}
  const sectionKeys = ["overview", "architecture", "api", "services", "database", "dependencies", "dataflow", "setup", "deployment", "ai_guide"]
  for (const key of sectionKeys) {
    if (!doc[key] || doc[key].length < 20) {
      doc[key] = analysis ? genDocFromAnalysis(analysis)[key] : `# ${key.charAt(0).toUpperCase() + key.slice(1)}\n\nDocumentation not available.`
    }
  }
  return doc
}

if (cached?.analyses) {
  for (const id of Object.keys(cached.analyses)) {
    const analysis = cached.analyses[id]
    // If architecture was stored as a plain string (legacy), avoid surfacing that
    // as the architecture object. Ensure documentation sections are populated
    // by generating from analysis where possible.
    try {
      if (analysis && analysis.architecture && typeof analysis.architecture === "string") {
        // Clear legacy architecture string to prevent it being rendered as the structured object
        analysis.architecture = {
          type: "Unknown",
          typeScore: 50,
          typeConfidence: "Low",
          modules: [],
          entryPoints: [],
          frameworks: {},
          layers: [],
          databaseConnections: [],
          externalAPIs: [],
          complexity: { level: "Unknown", score: 0 },
          maintainabilityScore: 0,
          nodes: [],
          edges: [],
          metrics: {
            totalFiles: 0, totalLines: 0, totalClasses: 0, totalFunctions: 0,
            services: 0, controllers: 0, apis: 0, databaseTables: 0,
            externalIntegrations: 0, testFiles: 0, configFiles: 0, docFiles: 0, avgFileSize: 0,
          },
          insights: [],
          summary: typeof analysis.architecture === "string" ? analysis.architecture : "",
          criticalDependencies: 0,
          circularDependencies: 0,
          healthScore: 0,
          criticalModulesCount: 0,
          highRiskAreasCount: 0,
          couplingScore: "Low",
          scalabilityScore: "Low",
          technicalDebtScore: "Low",
          confidence: "Low",
        }
      }
    } catch {}
    analysis.documentation = ensureDocFields(analysis.documentation as unknown as Record<string, string>, analysis) as any
  }
}

export let repositories: Repository[] = cached?.repositories ?? [
  {
    id: "repo-1",
    name: "e-commerce-api",
    url: "https://github.com/example/e-commerce-api",
    language: "TypeScript",
    framework: "NestJS",
    totalFiles: 42,
    totalLines: 12450,
    totalClasses: 18,
    totalFunctions: 124,
    status: "complete",
    createdAt: "2026-05-15T08:30:00Z",
    updatedAt: "2026-06-15T14:22:00Z",
  },
  {
    id: "repo-2",
    name: "codemind-backend",
    url: "https://github.com/example/codemind-backend",
    language: "Python",
    framework: "FastAPI",
    totalFiles: 28,
    totalLines: 6720,
    totalClasses: 12,
    totalFunctions: 84,
    status: "complete",
    createdAt: "2026-06-01T10:15:00Z",
    updatedAt: "2026-06-16T09:45:00Z",
  }
]

export const fileTrees: Record<string, RepositoryTreeNode[]> = cached?.fileTrees ?? {
  "repo-1": [
    {
      name: "src",
      type: "directory",
      path: "src",
      children: [
        {
          name: "auth",
          type: "directory",
          path: "src/auth",
          children: [
            { name: "auth.controller.ts", type: "file", path: "src/auth/auth.controller.ts" },
            { name: "auth.service.ts", type: "file", path: "src/auth/auth.service.ts" },
            { name: "jwt.strategy.ts", type: "file", path: "src/auth/jwt.strategy.ts" },
          ]
        },
        {
          name: "user",
          type: "directory",
          path: "src/user",
          children: [
            { name: "user.controller.ts", type: "file", path: "src/user/user.controller.ts" },
            { name: "user.service.ts", type: "file", path: "src/user/user.service.ts" },
            { name: "user.entity.ts", type: "file", path: "src/user/user.entity.ts" },
          ]
        },
        {
          name: "payment",
          type: "directory",
          path: "src/payment",
          children: [
            { name: "payment.controller.ts", type: "file", path: "src/payment/payment.controller.ts" },
            { name: "payment.service.ts", type: "file", path: "src/payment/payment.service.ts" },
            { name: "payment.entity.ts", type: "file", path: "src/payment/payment.entity.ts" },
          ]
        },
        { name: "app.module.ts", type: "file", path: "src/app.module.ts" },
        { name: "main.ts", type: "file", path: "src/main.ts" },
      ]
    },
    { name: "package.json", type: "file", path: "package.json" },
    { name: "tsconfig.json", type: "file", path: "tsconfig.json" },
  ],
  "repo-2": [
    {
      name: "app",
      type: "directory",
      path: "app",
      children: [
        {
          name: "routers",
          type: "directory",
          path: "app/routers",
          children: [
            { name: "auth.py", type: "file", path: "app/routers/auth.py" },
            { name: "users.py", type: "file", path: "app/routers/users.py" },
            { name: "items.py", type: "file", path: "app/routers/items.py" },
          ]
        },
        { name: "main.py", type: "file", path: "app/main.py" },
        { name: "database.py", type: "file", path: "app/database.py" },
        { name: "models.py", type: "file", path: "app/models.py" },
        { name: "schemas.py", type: "file", path: "app/schemas.py" },
      ]
    },
    { name: "requirements.txt", type: "file", path: "requirements.txt" },
    { name: "Dockerfile", type: "file", path: "Dockerfile" },
  ]
}

export const fileContents: Record<string, Record<string, string>> = cached?.fileContents ?? {
  "repo-1": {
    "src/main.ts": `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}
bootstrap();`,
    "src/app.module.ts": `import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [AuthModule, UserModule, PaymentModule],
})
export class AppModule {}`,
    "src/auth/auth.controller.ts": `import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}`,
    "src/auth/auth.service.ts": `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async login(credentials: any) {
    const user = await this.userService.findByEmail(credentials.email);
    if (!user || user.password !== credentials.password) {
      throw new UnauthorizedException();
    }
    const payload = { username: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}`,
    "src/user/user.service.ts": `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }
}`,
    "src/payment/payment.controller.ts": `import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('charge')
  async charge(@Body() paymentDto: any) {
    return this.paymentService.createCharge(paymentDto);
  }
}`
  },
  "repo-2": {
    "app/main.py": `from fastapi import FastAPI
from app.routers import auth, users, items
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CodeMind AI FastAPI Backend")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI Backend API"}`,
    "app/database.py": `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`
  }
}

export const analyses = (cached?.analyses ?? {
  "repo-1": {
    repository: repositories[0],
    architecture: {
      type: "Layered (Clean Architecture)",
      typeScore: 88,
      typeConfidence: "High",
      modules: [
        { name: "Auth", type: "module", files: 6 },
        { name: "Users", type: "module", files: 4 },
        { name: "Payments", type: "module", files: 5 }
      ],
      entryPoints: ["src/main.ts"],
      frameworks: { NestJS: "^10.0.0", TypeORM: "^10.0.0" },
      layers: [
        { name: "Presentation (Controllers)", description: "UI/API layer handling HTTP requests" },
        { name: "Application (Services)", description: "Business Logic layer" },
        { name: "Domain (Entities)", description: "Core model definitions" }
      ],
      databaseConnections: ["PostgreSQL (TypeORM)"],
      externalAPIs: ["Stripe Payment Gateway"],
      complexity: { level: "Medium", score: 45 },
      maintainabilityScore: 78,
      nodes: [
        { id: "layer-1", label: "Presentation", type: "layer", fileCount: 6, complexity: "Low" },
        { id: "layer-2", label: "Application", type: "layer", fileCount: 8, complexity: "Medium" },
        { id: "layer-3", label: "Domain", type: "layer", fileCount: 4, complexity: "Low" },
        { id: "module-1", label: "AuthModule", type: "module", fileCount: 6, complexity: "Medium" },
        { id: "module-2", label: "UserModule", type: "module", fileCount: 4, complexity: "Low" },
        { id: "module-3", label: "PaymentModule", type: "module", fileCount: 5, complexity: "Medium" },
        { id: "svc-1", label: "AuthService", type: "service", fileCount: 1, complexity: "Medium" },
        { id: "svc-2", label: "UserService", type: "service", fileCount: 1, complexity: "Low" },
        { id: "svc-3", label: "PaymentService", type: "service", fileCount: 1, complexity: "Medium" }
      ],
      edges: [
        { source: "module-1", target: "layer-1", relation: "PART_OF" },
        { source: "module-2", target: "layer-1", relation: "PART_OF" },
        { source: "module-3", target: "layer-1", relation: "PART_OF" },
        { source: "svc-1", target: "module-1", relation: "PART_OF" },
        { source: "svc-2", target: "module-2", relation: "PART_OF" },
        { source: "svc-3", target: "module-3", relation: "PART_OF" },
        { source: "svc-1", target: "svc-2", relation: "CALLS" },
        { source: "svc-3", target: "svc-2", relation: "CALLS" }
      ],
      metrics: {
        totalFiles: 18, totalLines: 3400, totalClasses: 24, totalFunctions: 82,
        services: 3, controllers: 3, apis: 12, databaseTables: 6,
        externalIntegrations: 2, testFiles: 4, configFiles: 3, docFiles: 2, avgFileSize: 189
      },
      insights: [
        { type: "strength", title: "Clear Layered Structure", description: "Well-defined separation between presentation, application, and domain layers." },
        { type: "weakness", title: "Circular Dependencies", description: "AuthService and AuthController have a circular reference that may cause issues." },
        { type: "risk", title: "Low Test Coverage", description: "Only 4 test files detected, below recommended threshold for production services." },
        { type: "recommendation", title: "Add Integration Tests", description: "Consider adding end-to-end tests for the critical auth and payment flows." }
      ],
      summary: "NestJS application with Clean Architecture, 3 modules, PostgreSQL database, and Stripe integration.",
      criticalDependencies: 3,
      circularDependencies: 2
    },
    dependencies: {
      graph: {
        nodes: [
          { id: "1", label: "AppModule", type: "module" },
          { id: "2", label: "AuthController", type: "file" },
          { id: "3", label: "UserController", type: "file" },
          { id: "4", label: "PaymentController", type: "file" },
          { id: "5", label: "AuthService", type: "file" },
          { id: "6", label: "UserService", type: "file" },
          { id: "7", label: "PaymentService", type: "file" },
          { id: "8", label: "UserRepository", type: "file" },
          { id: "9", label: "PaymentRepository", type: "file" }
        ],
        edges: [
          { source: "1", target: "2", relation: "imports" },
          { source: "1", target: "3", relation: "imports" },
          { source: "1", target: "4", relation: "imports" },
          { source: "2", target: "5", relation: "injects" },
          { source: "3", target: "6", relation: "injects" },
          { source: "4", target: "7", relation: "injects" },
          { source: "5", target: "6", relation: "injects" },
          { source: "5", target: "2", relation: "injects" }, // Circular auth controller-service loop for cycle highlighting
          { source: "6", target: "8", relation: "uses" },
          { source: "7", target: "9", relation: "uses" },
          { source: "8", target: "6", relation: "references" } // Circular dependency UserService -> UserRepository -> UserService
        ]
      },
      hotspots: [
        { module: "UserRepository", referencedBy: 14 },
        { module: "AuthService", referencedBy: 9 },
        { module: "UserService", referencedBy: 8 }
      ],
      circularDependencies: [
        ["AuthService", "AuthController", "AuthService"],
        ["UserService", "UserRepository", "UserService"]
      ],
      externalDependencies: ["@nestjs/common", "@nestjs/core", "@nestjs/jwt", "typeorm", "rxjs"],
      summary: {
        filesWithImports: 24,
        totalImportStatements: 82,
        uniqueExternalDependencies: 12
      }
    },
    dataFlow: {
      routes: [
        { method: "POST", path: "/auth/login", file: "src/auth/auth.controller.ts" },
        { method: "POST", path: "/payments/charge", file: "src/payment/payment.controller.ts" },
        { method: "GET", path: "/users/profile", file: "src/user/user.controller.ts" }
      ],
      flow: [
        "Client sends HTTP POST login credentials",
        "API Gateway validates HTTPS and CORS headers",
        "AuthController handles route matching and validates login payload",
        "AuthService checks login details via UserService",
        "UserRepository queries database, returns user profile data",
        "AuthService signs JWT, Controller returns HTTP 200 JSON payload"
      ],
      sequenceDiagram: `sequenceDiagram
  participant C as Client
  participant G as API Gateway
  participant CT as AuthController
  participant S as AuthService
  participant R as UserRepository
  participant D as Database

  C->>+G: POST /auth/login
  G->>+CT: Forward request
  CT->>+S: login(credentials)
  S->>+R: findOne(email)
  R->>+D: SELECT * FROM users
  D-->>-R: User record
  R-->>-S: User record
  S-->>-CT: Signed JWT token
  CT-->>-G: HTTP 200 OK Response
  G-->>-C: { token: "..." }`,
      flowDiagram: `flowchart TD
  A([HTTP Client]) --> B[NestJS Router]
  B --> C{JwtAuthGuard}
  C -->|Passed| D[PaymentController]
  C -->|Failed| E[401 Unauthorized]
  D --> F[PaymentService]
  F --> G[Stripe API Client]
  G --> H[Update DB Entity]
  H --> I[(PostgreSQL)]`,
      architectureDiagram: `graph LR
  subgraph UI ["Client Application"]
    WebUI[Next.js Client]
  end
  subgraph App ["Application Core"]
    Auth[Auth Module]
    Users[Users Module]
    Pay[Payments Module]
  end
  subgraph Data ["Data Access & External"]
    DB[(PostgreSQL)]
    Stripe[Stripe Service]
  end
  WebUI <-->|JSON/HTTPS| App
  Auth --> Users
  Pay --> Users
  Users --> DB
  Pay --> Stripe`
    },
    documentation: {
      overview: `# Repository Overview

**E-Commerce API**

A NestJS-based e-commerce backend with authentication, payment processing, and user management.

- **Language:** TypeScript
- **Framework:** NestJS
- **Architecture:** Layered (3-tier)

## Stats

- Total Files: 24
- Total Lines: ~3,500
- Entry Points: \`src/main.ts\``,
      architecture: `# System Architecture Details
## Layered Structure
The system utilizes a 3-tier Layered Architecture mapping:
- **Presentation Layer**: Exposes controller APIs under NestJS modules.
- **Application Layer**: Contains business logic processes (AuthService, PaymentService).
- **Data Access Layer**: Abstracted using repositories and TypeORM Entities.

## Design Patterns Used
- **Dependency Injection**: Promoted using NestJS framework decorators (\`@Injectable\`).
- **Data Mapper Pattern**: Managed through database repositories.`,
      api: `# API Endpoints Reference
## Auth module
### POST /auth/login
Authenticates credentials and issues JWT access tokens.
- **Body**: \`{ email: string, password: string }\`
- **Response**: \`{ access_token: string }\`

## Payment Module
### POST /payments/charge
Executes standard payment transactions.
- **Headers**: \`Authorization: Bearer <JWT>\`
- **Body**: \`{ amount: number, currency: string, source: string }\`
- **Response**: \`{ id: string, status: string }\``,
      services: `# Application Services documentation
### AuthService
Handles user credential authentication logic and JWT security token signatures.

### PaymentService
Integrates with external payment processors to execute charges and persist transactional invoice entities.`,
      database: `# Database Schema documentation
The persistence layer is modeled with SQL tables mapped via TypeORM.

## Entities
### User Entity
- \`id\` (UUID, Primary Key)
- \`email\` (VARCHAR, Unique)
- \`password\` (VARCHAR, Hashed)
- \`createdAt\` (TIMESTAMP)

### Payment Entity
- \`id\` (UUID, Primary Key)
- \`amount\` (DECIMAL)
- \`status\` (VARCHAR)
- \`userId\` (UUID, Foreign Key)`,
      dependencies: `# Dependencies

## External Packages
- \`@nestjs/core\` - NestJS framework
- \`@nestjs/typeorm\` - TypeORM integration
- \`typeorm\` - ORM for database access
- \`passport\` - Authentication middleware
- \`stripe\` - Payment processing

## Internal Dependencies
- AuthController → AuthService → UserRepository → User Entity
- PaymentController → PaymentService → PaymentRepository → Payment Entity`,
      dataflow: `# Data Flow Documentation

## Authentication Flow
\`\`\`mermaid
sequenceDiagram
    User->>AuthController: POST /auth/login
    AuthController->>AuthService: validateCredentials()
    AuthService->>UserRepository: findByEmail()
    UserRepository-->>AuthService: User
    AuthService->>AuthService: comparePassword()
    AuthService-->>AuthController: JWT Token
    AuthController-->>User: { access_token }
\`\`\`

## Payment Flow
1. User sends payment request
2. Auth middleware validates JWT
3. PaymentController receives request
4. PaymentService processes with Stripe
5. PaymentRepository persists transaction`,
      setup: `# Setup Documentation

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Stripe API key

## Installation

bash
git clone <repo>
cd e-commerce-api
npm install

## Configuration
Create a \`.env\` file:
\`\`\`
DATABASE_URL=postgresql://localhost:5432/ecommerce
JWT_SECRET=your-secret
STRIPE_KEY=sk_test_...
\`\`\`

## Running

bash
npm run start:dev`,
      deployment: `# Deployment Documentation

## Docker

dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]

## Docker Compose

yaml
version: '3'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: ecommerce

## CI/CD
- GitHub Actions workflow at \`.github/workflows/ci.yml\`
- Automated test run on PR
- Docker build and push on merge to main`,
      ai_guide: `# AI Repository Guide

## Summary
**E-Commerce API** is a NestJS-based backend for an e-commerce platform. It handles user authentication, product management, and payment processing through Stripe integration.

## How It Works
1. **Entry Point**: \`src/main.ts\` bootstraps the NestJS application
2. **Request Flow**: Request → Guard → Controller → Service → Repository → Database
3. **Authentication**: JWT-based with Passport strategies
4. **Payments**: Stripe API integration for payment processing

## Key Components
- **AuthModule** - User authentication and authorization
- **PaymentModule** - Payment processing with Stripe
- **UserModule** - User profile management

## Developer Onboarding
1. Set up PostgreSQL locally
2. Configure environment variables
3. Run \`npm run start:dev\`
4. Visit \`http://localhost:3000/api/docs\` for Swagger

## AI Recommendations
- Add request rate limiting
- Implement request logging middleware
- Add integration tests for payment flow
- Consider caching for frequently accessed data`
    },
    security: [
      {
        severity: "Critical",
        category: "Authentication Bypass",
        description: "Standard password strings are compared in plain-text instead of hashing passwords.",
        file: "src/auth/auth.service.ts",
        line: 14,
        snippet: "if (!user || user.password !== credentials.password) {"
      }
    ],
    quality: [
      {
        type: "Code Duplication",
        file: "src/user/user.service.ts",
        line: 10,
        description: "Redundant query builder logic duplicates code found in Core UserRepository."
      }
    ]
  },
  "repo-2": {
    repository: repositories[1],
    architecture: {
      type: "Monolith (MVC)",
      typeScore: 74,
      typeConfidence: "Medium",
      modules: [
        { name: "Auth", type: "module", files: 2 },
        { name: "Users", type: "module", files: 2 },
        { name: "Database", type: "module", files: 1 }
      ],
      entryPoints: ["app/main.py"],
      frameworks: { FastAPI: "^0.100.0", SQLAlchemy: "^2.0.0" },
      layers: [
        { name: "Endpoints (APIs)", description: "HTTP Routing layer" },
        { name: "Data Models", description: "Database schema definitions" }
      ],
      databaseConnections: ["PostgreSQL (SQLAlchemy)"],
      externalAPIs: [],
      complexity: { level: "Low", score: 25 },
      maintainabilityScore: 82,
      nodes: [
        { id: "layer-1", label: "API Layer", type: "layer", fileCount: 3, complexity: "Low" },
        { id: "layer-2", label: "Data Layer", type: "layer", fileCount: 2, complexity: "Low" },
        { id: "module-1", label: "Auth Module", type: "module", fileCount: 2, complexity: "Low" },
        { id: "module-2", label: "Users Module", type: "module", fileCount: 2, complexity: "Low" },
        { id: "entry-1", label: "main.py", type: "entry", fileCount: 1, complexity: "Low" }
      ],
      edges: [
        { source: "module-1", target: "layer-1", relation: "PART_OF" },
        { source: "module-2", target: "layer-1", relation: "PART_OF" },
        { source: "entry-1", target: "layer-1", relation: "PART_OF" },
        { source: "module-1", target: "layer-2", relation: "DEPENDS_ON" },
        { source: "module-2", target: "layer-2", relation: "DEPENDS_ON" }
      ],
      metrics: {
        totalFiles: 8, totalLines: 1200, totalClasses: 4, totalFunctions: 18,
        services: 0, controllers: 2, apis: 3, databaseTables: 4,
        externalIntegrations: 0, testFiles: 1, configFiles: 2, docFiles: 1, avgFileSize: 150
      },
      insights: [
        { type: "strength", title: "Simple Structure", description: "Small, straightforward monolith with clear separation of concerns." },
        { type: "recommendation", title: "Add Tests", description: "Only 1 test file found. Increasing test coverage would improve maintainability." }
      ],
      summary: "FastAPI monolith with SQLAlchemy, 2 modules, and PostgreSQL database.",
      criticalDependencies: 1,
      circularDependencies: 0
    },
    dependencies: {
      graph: {
        nodes: [
          { id: "1", label: "main.py", type: "file" },
          { id: "2", label: "auth.py", type: "file" },
          { id: "3", label: "users.py", type: "file" },
          { id: "4", label: "database.py", type: "file" }
        ],
        edges: [
          { source: "1", target: "2", relation: "includes" },
          { source: "1", target: "3", relation: "includes" },
          { source: "2", target: "4", relation: "imports" },
          { source: "3", target: "4", relation: "imports" }
        ]
      },
      hotspots: [
        { module: "database.py", referencedBy: 4 },
        { module: "auth.py", referencedBy: 2 }
      ],
      circularDependencies: [],
      externalDependencies: ["fastapi", "sqlalchemy", "uvicorn", "pydantic"],
      summary: {
        filesWithImports: 8,
        totalImportStatements: 14,
        uniqueExternalDependencies: 4
      }
    },
    dataFlow: {
      routes: [
        { method: "GET", path: "/", file: "app/main.py" },
        { method: "POST", path: "/token", file: "app/routers/auth.py" }
      ],
      flow: [
        "Request enters FastAPI router instance",
        "DB context session dependency is injected",
        "Handler reads record and commits transaction response"
      ]
    },
    documentation: {
      overview: "# Repository Overview\nPython monolith application.",
      architecture: "# Python Monolith Overview\nDesigned with SQLAlchemy standard engines.",
      api: "# OpenAPI spec available at /docs",
      services: "# Database and Router mapping controls services.",
      database: "# Relational PostgreSQL database backend mapping.",
      dependencies: "# Dependencies\nSQLAlchemy, FastAPI, Pydantic.",
      dataflow: "# Data Flow\nRequest → Router → Service → Database.",
      setup: "# Setup\nInstall with pip install -r requirements.txt",
      deployment: "# Deployment\nNo deployment configuration detected.",
      ai_guide: "# AI Guide\nPython monolith with SQLAlchemy ORM."
    },
    security: [],
    quality: []
  }
}) as Record<string, AnalysisResult>

export const onboardingPlans: Record<string, OnboardingPlan> = cached?.onboardingPlans ?? {}

export function getDashboardStats(): DashboardStats {
  const completeRepos = repositories.filter(r => r.status === "complete")
  const totals = completeRepos.reduce(
    (acc, r) => {
      acc.files += r.totalFiles
      acc.lines += r.totalLines
      acc.classes += r.totalClasses
      acc.functions += r.totalFunctions
      return acc
    },
    { files: 0, lines: 0, classes: 0, functions: 0 }
  )

  const circularCount = completeRepos.reduce((acc, r) => {
    const analysis = analyses[r.id]
    return acc + (analysis?.dependencies?.circularDependencies?.length || 0)
  }, 0)

  return {
    totalRepositories: repositories.length,
    totalFiles: totals.files,
    totalClasses: totals.classes,
    totalFunctions: totals.functions,
    architectureStyle: "Microservices & Layered",
    riskLevel: "Medium",
    circularDependencies: circularCount,
  }
}

export function addRepository(repo: Repository) {
  repositories = [...repositories, repo]
  saveCache()
}

export function deleteRepository(id: string): boolean {
  const index = repositories.findIndex((r) => r.id === id)
  if (index === -1) return false

  repositories = repositories.filter((r) => r.id !== id)

  delete fileTrees[id]
  delete fileContents[id]
  delete analyses[id]
  delete onboardingPlans[id]

  saveCache()
  return true
}

export { saveCache }
