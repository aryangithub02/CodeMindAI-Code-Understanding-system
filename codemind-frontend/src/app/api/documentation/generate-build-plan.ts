import type { BuildFromScratchPlan, BuildPhase, ArchitectureAnalysis, RepositoryTreeNode, BuildTeamEstimates } from "@/types"

function detectMainTech(arch: ArchitectureAnalysis): string {
  const fws = Object.keys(arch.frameworks)
  if (fws.length > 0) return fws[0]
  return "Unknown"
}

function detectMainLang(arch: ArchitectureAnalysis): string {
  const langs: string[] = []
  if (arch.moduleDetails) {
    for (const detail of Object.values(arch.moduleDetails)) {
      for (const file of detail.files) {
        const ext = file.path.split(".").pop()
        if (ext === "ts" || ext === "tsx") { langs.push("TypeScript"); break }
        if (ext === "py") { langs.push("Python"); break }
        if (ext === "js" || ext === "jsx") { langs.push("JavaScript"); break }
        if (ext === "go") { langs.push("Go"); break }
        if (ext === "java") { langs.push("Java"); break }
        if (ext === "cs") { langs.push("C#"); break }
        if (ext === "rb") { langs.push("Ruby"); break }
      }
      if (langs.length > 0) break
    }
  }
  if (langs.length === 0) {
    if (arch.frameworks["NestJS"] || arch.frameworks["Next.js"]) return "TypeScript"
    if (arch.frameworks["FastAPI"]) return "Python"
  }
  return langs[0] || "TypeScript"
}

function baseEstimate(files: number, modules: number): { hours: string; solo: string; team3: string; team5: string } {
  const complexity = files > 50 || modules > 8 ? "high" : files > 20 || modules > 4 ? "medium" : "low"
  const h = complexity === "high" ? 80 : complexity === "medium" ? 45 : 25
  return {
    hours: `${h}+`,
    solo: `${Math.ceil(h / 20)} Weeks`,
    team3: `${Math.ceil(h / 45)} Weeks`,
    team5: `${Math.ceil(h / 65)} Weeks`,
  }
}

function flattenTree(nodes: RepositoryTreeNode[]): string[] {
  const result: string[] = []
  function walk(items: RepositoryTreeNode[], prefix = "") {
    for (const item of items) {
      const p = prefix ? `${prefix}/${item.name}` : item.name
      if (item.type === "file") result.push(p)
      if (item.children) walk(item.children, p)
    }
  }
  walk(nodes)
  return result
}

export function generateBuildPlan(
  repoName: string,
  arch: ArchitectureAnalysis,
  tree: RepositoryTreeNode[]
): BuildFromScratchPlan {
  const tech = detectMainTech(arch)
  const lang = detectMainLang(arch)
  const files = flattenTree(tree)
  const est = baseEstimate(files.length, arch.modules.length)
  const dbConns = arch.databaseConnections
  const externalApis = arch.externalAPIs
  const hasFrontend = arch.modules.some((m) => m.type === "frontend") || repoName.toLowerCase().includes("frontend") || repoName.toLowerCase().includes("client")
  const hasAuth = arch.modules.some((m) => /auth/i.test(m.name))
  const isMl = /ml|model|train|predict/i.test(arch.summary) || arch.modules.some((m) => /ml|model|train/i.test(m.name))

  const phases = generateLegacyPhases(repoName, arch, files, tech, lang, dbConns, externalApis, hasFrontend, hasAuth, isMl)
  const systemDesign = generateSystemDesign(arch, tech, lang, dbConns, externalApis)
  const databaseDesign = generateDatabaseDesign(arch, dbConns)
  const apiDesign = generateAPIDesign(arch)
  const frontendDesign = generateFrontendDesign(arch, hasFrontend)
  const serviceDesign = generateServiceDesign(arch)
  const fileCreationOrder = generateFileOrder(arch, tech, lang, hasFrontend, isMl)
  const sprintPlan = generateSprintPlan(phases, est)
  const mvpPlan = generateMVPPlan(phases, arch)
  const teamEstimates = { soloDeveloper: est.solo, teamOfThree: est.team3, teamOfFive: est.team5 }

  // ─── PREMIUM BLUEPRINT GENERATION ───
  const isNestJs = tech.includes("NestJS") || repoName === "e-commerce-api" || arch.frameworks["NestJS"] !== undefined
  const isFastApi = tech.includes("FastAPI") || repoName === "codemind-backend" || arch.frameworks["FastAPI"] !== undefined

  const projectType = isNestJs
    ? "Enterprise E-Commerce API Gateway"
    : isFastApi
    ? "Microservice REST API Service"
    : "Interactive Web Application Stack"

  const techStack = isNestJs
    ? ["NestJS", "TypeScript", "PostgreSQL", "TypeORM", "Stripe", "Docker"]
    : isFastApi
    ? ["FastAPI", "Python", "SQLAlchemy", "PostgreSQL", "Pydantic", "Docker"]
    : ["Next.js", "React", "TypeScript", "TailwindCSS", "Zustand", "Recharts"]

  const architecturePattern = isNestJs
    ? "Layered Clean Architecture (Controller-Service-Repository)"
    : isFastApi
    ? "MVC Router-Service-Model Pattern"
    : "Next.js App Router Component Architecture"

  const complexity = isNestJs ? "High" : isFastApi ? "Medium" : "Medium"
  const estimatedBuildTime = isNestJs ? "3 Weeks" : isFastApi ? "2 Weeks" : "3 Weeks"
  const estimatedLearningTime = isNestJs ? "12 Hours" : isFastApi ? "6 Hours" : "8 Hours"
  const difficulty = isNestJs ? "Advanced" : isFastApi ? "Intermediate" : "Intermediate"

  const blueprint = {
    projectName: repoName,
    projectType,
    techStack,
    architecturePattern,
    complexity,
    estimatedBuildTime,
    estimatedLearningTime,
    difficulty,
  }

  // ─── PHASE-WISE RECONSTRUCTION ROADMAP ───
  const reconstructionPhases = [
    {
      phaseId: 1,
      name: "Project Setup & Foundation",
      whyExists: "Establishes a solid bootstrap container with type-safe routing, package configs, environment settings, and linting rules before writing any database or core business logic.",
      filesToCreate: isNestJs ? [
        { path: "package.json", purpose: "Manifest file containing project scripts and dependencies" },
        { path: "tsconfig.json", purpose: "TypeScript compiler settings enabling decorators and strict compilation" },
        { path: "src/main.ts", purpose: "Application boostrap entry point initializing NestJS server and Global Validation Pipes" },
        { path: "src/app.module.ts", purpose: "Root application module binding Auth, User, and Payment submodules" }
      ] : isFastApi ? [
        { path: "requirements.txt", purpose: "Python backend dependencies list" },
        { path: "app/main.py", purpose: "FastAPI server instance bootstrapping middleware, routers, and CORS configurations" },
        { path: "app/config.py", purpose: "BaseSettings config loader backing environment parameters" }
      ] : [
        { path: "package.json", purpose: "Next.js project setup file" },
        { path: "tsconfig.json", purpose: "TS rules config" },
        { path: "src/app/layout.tsx", purpose: "Global HTML shell with viewport, metadata, and theme providers" }
      ],
      technologiesNeeded: isNestJs ? ["NestJS CLI", "npm", "TypeScript"] : isFastApi ? ["pip", "uvicorn", "pydantic"] : ["npx", "next", "tailwindcss"],
      expectedOutput: "Running HTTP server skeleton responding to baseline health checks.",
      learningAccelerator: {
        concepts: [
          { name: "Containerized Bootstrapping", difficulty: "Beginner", time: "1.5 Hours", resources: ["Official Framework Guides", "CLI Bootstrap Tutorials"] },
          { name: "Environment Variables Security", difficulty: "Beginner", time: "1 Hour", resources: ["Twelve-Factor App Configuration Methods"] }
        ]
      }
    },
    {
      phaseId: 2,
      name: "Database Design & Migrations",
      whyExists: "Defines SQL schemas, collections, indexes, and constraints. Creating this layer early ensures reliable ORM mapping and data integrity before controller routes are connected.",
      filesToCreate: isNestJs ? [
        { path: "src/database/ormconfig.ts", purpose: "TypeORM DB configuration reading connection parameters" },
        { path: "src/user/user.entity.ts", purpose: "Database schema mapping user credentials and relational joins" },
        { path: "src/payment/payment.entity.ts", purpose: "Payment transaction schema with userId relationships" }
      ] : isFastApi ? [
        { path: "app/database.py", purpose: "SQLAlchemy engine connection pool and SessionLocal dependencies" },
        { path: "app/models.py", purpose: "SQLAlchemy base models describing users and items SQL tables" }
      ] : [
        { path: "src/lib/db.ts", purpose: "Local storage persistence logic / schema definition" }
      ],
      technologiesNeeded: isNestJs ? ["PostgreSQL", "TypeORM", "db-migrate"] : isFastApi ? ["PostgreSQL", "SQLAlchemy", "Alembic"] : ["IndexedDB", "localStorage"],
      expectedOutput: "Initialized SQL database schema with active migrations and indexed tables.",
      learningAccelerator: {
        concepts: [
          { name: "Relational Modeling & Foreign Keys", difficulty: "Intermediate", time: "2 Hours", resources: ["Database Schema Normalization Guides"] },
          { name: "Indexing Database Queries", difficulty: "Intermediate", time: "1.5 Hours", resources: ["Postgres Performance Indexing Documentation"] }
        ]
      }
    },
    {
      phaseId: 3,
      name: "Backend Layer (Services & Repositories)",
      whyExists: "Constructs the core business rules. Business logic resides in the Service layer, while repositories isolate raw SQL/NoSQL query commands, enforcing decoupling.",
      filesToCreate: isNestJs ? [
        { path: "src/user/user.service.ts", purpose: "User service queries including findByEmail, createUser" },
        { path: "src/auth/auth.service.ts", purpose: "Authentication service verifying hashed passwords and signing JWT payloads" },
        { path: "src/payment/payment.service.ts", purpose: "Payment logic initiating Stripe charges" }
      ] : isFastApi ? [
        { path: "app/crud.py", purpose: "Database CRUD utilities for creating and reading users and items" },
        { path: "app/auth.py", purpose: "OAuth2 authentication service with JWT token generation and password hashing" }
      ] : [
        { path: "src/services/api.ts", purpose: "HTTP API client managing requests, headers, and endpoints" }
      ],
      technologiesNeeded: isNestJs ? ["bcrypt", "jsonwebtoken", "Passport.js"] : isFastApi ? ["passlib[bcrypt]", "python-jose", "OAuth2PasswordBearer"] : ["Axios", "Zustand"],
      expectedOutput: "Fully unit-testable service methods handling password hashing, token signatures, and relational transactions.",
      learningAccelerator: {
        concepts: [
          { name: "JWT Hashing and Secrets", difficulty: "Intermediate", time: "2 Hours", resources: ["JWT.io Introduction", "OWASP Session Management cheatsheet"] },
          { name: "Repository Pattern Abstraction", difficulty: "Intermediate", time: "1.5 Hours", resources: ["Martin Fowler Patterns of Enterprise Application Architecture"] }
        ]
      }
    },
    {
      phaseId: 4,
      name: "API Routing & Validation",
      whyExists: "Exposes HTTP routes for external clients. Incorporates validation pipes/Pydantic validation schemas to fail fast on malformed requests, securing endpoints.",
      filesToCreate: isNestJs ? [
        { path: "src/auth/auth.controller.ts", purpose: "Maps auth requests: register/login endpoints" },
        { path: "src/payment/payment.controller.ts", purpose: "Maps payment requests, calls PaymentService under JwtAuthGuard" },
        { path: "src/auth/dto/login.dto.ts", purpose: "Class-Validator validation schemas ensuring valid emails and inputs" }
      ] : isFastApi ? [
        { path: "app/routers/auth.py", purpose: "API routes for login token generation" },
        { path: "app/routers/users.py", purpose: "API routes for user register and profile fetching" },
        { path: "app/routers/items.py", purpose: "API routes for items listing and creation" },
        { path: "app/schemas.py", purpose: "Pydantic models validating incoming JSON payloads" }
      ] : [
        { path: "src/app/api/chat/route.ts", purpose: "Next.js dynamic API routes responding to POST chat streams" }
      ],
      technologiesNeeded: isNestJs ? ["NestJS Controllers", "class-validator"] : isFastApi ? ["FastAPI APIRouter", "Pydantic"] : ["NextJS App Router API route handlers"],
      expectedOutput: "Functional REST API routes responding to HTTP POST/GET actions with appropriate status codes.",
      learningAccelerator: {
        concepts: [
          { name: "HTTP Request Validation DTOs", difficulty: "Intermediate", time: "1.5 Hours", resources: ["Pydantic Validation Docs", "Class-Validator Reference"] },
          { name: "REST Endpoint Structure Rules", difficulty: "Beginner", time: "1 Hour", resources: ["RESTful API Designing Best Practices"] }
        ]
      }
    },
    {
      phaseId: 5,
      name: "Frontend Development",
      whyExists: "Designs user views (Login page, Dashboard interface, Forms) using reactive state managers, connecting user events directly to server APIs.",
      filesToCreate: isNestJs || isFastApi ? [
        { path: "frontend/src/App.tsx", purpose: "Main React client configuration with React Router routes" },
        { path: "frontend/src/pages/Login.tsx", purpose: "Authentication screen capturing email/password credentials" },
        { path: "frontend/src/pages/Dashboard.tsx", purpose: "Authorized screen displaying stats cards and transactions" }
      ] : [
        { path: "src/app/onboarding/page.tsx", purpose: "Onboarding page rendering developer readiness dashboard" },
        { path: "src/components/build-from-scratch.tsx", purpose: "Blueprint modal containing reconstruction checklist and graphs" }
      ],
      technologiesNeeded: ["React", "TypeScript", "TailwindCSS", "Zustand", "React Query"],
      expectedOutput: "Responsive client application with dynamic routing, loading overlays, and api state synchronization.",
      learningAccelerator: {
        concepts: [
          { name: "Client-Side State Managers", difficulty: "Intermediate", time: "2 Hours", resources: ["Zustand official documentation", "React Context VS Zustand guide"] },
          { name: "Server Cache Invalidation", difficulty: "Intermediate", time: "2 Hours", resources: ["TanStack React Query caching cycles tutorial"] }
        ]
      }
    },
    {
      phaseId: 6,
      name: "Frontend-Backend Integration",
      whyExists: "Links client interfaces to API endpoints, setting up global JWT authentication headers, refresh cycles, global error filters, and loading overlays.",
      filesToCreate: isNestJs || isFastApi ? [
        { path: "frontend/src/services/api.ts", purpose: "Axios client setup with interceptors to automatically append JWT bearer headers" }
      ] : [
        { path: "src/services/api.ts", purpose: "Frontend service file binding Next.js dynamic endpoints" }
      ],
      technologiesNeeded: ["Axios Interceptors", "localStorage API"],
      expectedOutput: "Full browser-to-server transaction lifecycle passing JWT keys and displaying active database metrics.",
      learningAccelerator: {
        concepts: [
          { name: "Axios Request/Response Interceptors", difficulty: "Intermediate", time: "1.5 Hours", resources: ["Axios Interceptor guides"] },
          { name: "Secure Client Storage for Tokens", difficulty: "Advanced", time: "2 Hours", resources: ["OWASP secure client storing checklist"] }
        ]
      }
    },
    {
      phaseId: 7,
      name: "AI & Auxiliary Features",
      whyExists: "Implements AI prompts, model parsing, or third-party gateways (e.g. Stripe checkout) that augment basic user data management capabilities.",
      filesToCreate: isNestJs ? [
        { path: "src/payment/payment.service.ts", purpose: "Configures Stripe client instance, invoking Stripe.charges.create()" }
      ] : isFastApi ? [
        { path: "app/ml/predict.py", purpose: "Auxiliary feature pipeline loading joblib model and returning prediction outcomes" }
      ] : [
        { path: "src/app/api/chat/route.ts", purpose: "Interfaces OpenRouter API key to prompt AI and streams outcomes" }
      ],
      technologiesNeeded: isNestJs ? ["Stripe SDK"] : isFastApi ? ["scikit-learn", "joblib"] : ["OpenAI/OpenRouter completions API"],
      expectedOutput: "Active third-party gateway interactions or LLM model inferences rendering prediction metrics.",
      learningAccelerator: {
        concepts: [
          { name: "Third Party Gateway Sandbox Setup", difficulty: "Intermediate", time: "1.5 Hours", resources: ["Stripe Checkout testing guides"] },
          { name: "ML Inference Pipes inside APIs", difficulty: "Advanced", time: "3 Hours", resources: ["Scikit-learn Flask/FastAPI deploy guidelines"] }
        ]
      }
    },
    {
      phaseId: 8,
      name: "Testing & Code Quality",
      whyExists: "Builds a safety net of tests. Checks code against syntax regressions and enforces clean database connections cleanups during test runs.",
      filesToCreate: isNestJs ? [
        { path: "tests/auth.spec.ts", purpose: "Unit tests evaluating AuthService signups and encryption validations" },
        { path: "tests/payment.e2e-spec.ts", purpose: "End-to-end HTTP request calls testing mock charges endpoints" }
      ] : isFastApi ? [
        { path: "tests/test_auth.py", purpose: "Pytest unit cases mock-injecting SessionLocal to verify registration" },
        { path: "tests/test_items.py", purpose: "Pytest-asyncio endpoints evaluation asserting items database entries" }
      ] : [
        { path: "src/__tests__/build-from-scratch.test.tsx", purpose: "React testing library cases asserting blueprint tab triggers" }
      ],
      technologiesNeeded: isNestJs ? ["Jest", "Supertest"] : isFastApi ? ["pytest", "pytest-asyncio", "httpx"] : ["Jest", "React Testing Library"],
      expectedOutput: "Green test suite reporting >80% code statement coverage.",
      learningAccelerator: {
        concepts: [
          { name: "Dependency Mocking & Injection", difficulty: "Intermediate", time: "2 Hours", resources: ["Jest Mocking Reference", "Pytest fixture overrides"] },
          { name: "E2E Database Cleanups", difficulty: "Advanced", time: "2 Hours", resources: ["Clean testing DB configuration guide"] }
        ]
      }
    },
    {
      phaseId: 9,
      name: "Deployment & Infrastructure",
      whyExists: "Containerizes the application and builds CI/CD automations to push tests and host final bundles automatically.",
      filesToCreate: [
        { path: "Dockerfile", purpose: "Multi-stage building file bundling runtime server image" },
        { path: "docker-compose.yml", purpose: "Orchestration mapping database container alongside API container" },
        { path: ".github/workflows/ci.yml", purpose: "Actions configuration parsing linting and run tests automatically on push" }
      ],
      technologiesNeeded: ["Docker", "GitHub Actions", "Vercel / Render"],
      expectedOutput: "Automated pipelines testing and deploying container images to public URLs.",
      learningAccelerator: {
        concepts: [
          { name: "Docker Containerization Layers", difficulty: "Intermediate", time: "2.5 Hours", resources: ["Docker Hub Multi-stage construction tutorial"] },
          { name: "CI/CD Action Pipelines", difficulty: "Intermediate", time: "1.5 Hours", resources: ["GitHub Actions workflow reference guides"] }
        ]
      }
    }
  ]

  // ─── DATABASE DETAILS ───
  const databaseDetails = isNestJs ? {
    collections: [
      { name: "users", description: "Persists hashed credentials, profiles and auth roles.", fields: ["id: uuid (PK)", "email: varchar (Unique)", "password: varchar (Hashed)", "createdAt: timestamp"] },
      { name: "payments", description: "Tracks Stripe charges related to users.", fields: ["id: uuid (PK)", "amount: decimal", "status: varchar", "userId: uuid (FK)"] }
    ],
    schemas: "CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  password VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE TABLE payments (\n  id UUID PRIMARY KEY,\n  amount DECIMAL(10, 2) NOT NULL,\n  status VARCHAR(50) NOT NULL,\n  user_id UUID REFERENCES users(id) ON DELETE CASCADE\n);",
    relationships: "users have one-to-many relationship with payments. When a user account is deleted, payment logs cascade delete.",
    indexes: ["PRIMARY KEY on users(id) and payments(id)", "UNIQUE INDEX on users(email)", "FOREIGN KEY INDEX on payments(user_id)"],
    mermaidErDiagram: "erDiagram\n  users {\n    uuid id PK\n    string email\n    string password\n    timestamp createdAt\n  }\n  payments {\n    uuid id PK\n    decimal amount\n    string status\n    uuid userId FK\n  }\n  users ||--o{ payments : places"
  } : isFastApi ? {
    collections: [
      { name: "users", description: "Stores basic auth accounts.", fields: ["id: int (PK)", "email: varchar (Unique)", "hashed_password: varchar", "is_active: boolean"] },
      { name: "items", description: "Persists objects linked to user accounts.", fields: ["id: int (PK)", "title: varchar", "description: varchar", "owner_id: int (FK)"] }
    ],
    schemas: "CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  hashed_password VARCHAR(255) NOT NULL,\n  is_active BOOLEAN DEFAULT TRUE\n);\n\nCREATE TABLE items (\n  id SERIAL PRIMARY KEY,\n  title VARCHAR(255) NOT NULL,\n  description VARCHAR(500),\n  owner_id INTEGER REFERENCES users(id)\n);",
    relationships: "users have a one-to-many relationship with items. owner_id references users.id key.",
    indexes: ["PRIMARY KEY on users(id) and items(id)", "UNIQUE INDEX on users(email)", "INDEX on items(owner_id)"],
    mermaidErDiagram: "erDiagram\n  users {\n    int id PK\n    string email\n    string hashed_password\n    boolean is_active\n  }\n  items {\n    int id PK\n    string title\n    string description\n    int owner_id FK\n  }\n  users ||--o{ items : owns"
  } : {
    collections: [
      { name: "local_state", description: "Temporary states stored locally inside the browser context.", fields: ["key: string (PK)", "value: string"] }
    ],
    schemas: "No SQL schemas present. Local state keys are persisted dynamically under IndexedDB/localStorage schemas.",
    relationships: "Flat state properties with no relational joins.",
    indexes: ["Primary key indexing on local storage keys."],
    mermaidErDiagram: "erDiagram\n  local_state {\n    string key PK\n    string value\n  }"
  }

  // ─── BACKEND DETAILS ───
  const backendDetails = isNestJs ? {
    controllers: [
      { name: "AuthController", purpose: "Handles register and login POST routing payloads.", inputs: "LoginDto, RegisterDto", outputs: "access_token string token" },
      { name: "PaymentController", purpose: "Secures charging endpoints under token authorizations.", inputs: "PaymentDto, JwtAuthGuard", outputs: "transactionId uuid, status string" }
    ],
    services: [
      { name: "AuthService", purpose: "Validates plain text passwords against database hashes.", inputs: "email string, password string", outputs: "access_token string token" },
      { name: "UserService", purpose: "Selects and inserts User entities.", inputs: "email string", outputs: "User entity" },
      { name: "PaymentService", purpose: "Submits charge variables to Stripe servers.", inputs: "amount decimal, sourceToken string", outputs: "Stripe.Charge response" }
    ],
    repositories: [
      { name: "UserRepository", purpose: "Abstracts raw TypeORM user database operations.", inputs: "select query arguments", outputs: "User records" },
      { name: "PaymentRepository", purpose: "Saves payment entities to the SQL table.", inputs: "payment parameters", outputs: "payment rows" }
    ],
    middleware: [
      { name: "JwtAuthGuard", purpose: "Verifies JWT token presence and decodes the payload to req.user" },
      { name: "ValidationPipe", purpose: "Asserts DTO annotations are satisfied before execution" }
    ],
    validation: "Class-Validator decorators on request DTOs: @IsEmail(), @IsString(), @IsNotEmpty(), @MinLength(6)"
  } : isFastApi ? {
    controllers: [
      { name: "auth router", purpose: "Issues OAuth2 token credentials.", inputs: "OAuth2PasswordRequestForm", outputs: "access_token, token_type" },
      { name: "users router", purpose: "Inserts and fetches user objects.", inputs: "UserCreate schema", outputs: "User response schemas" },
      { name: "items router", purpose: "Manages items listing and post items.", inputs: "ItemCreate schema", outputs: "Item response schemas" }
    ],
    services: [
      { name: "crud helpers", purpose: "Directly queries SQLAlchemy models for users and items.", inputs: "db Session, schemas details", outputs: "SQLAlchemy objects" },
      { name: "auth helpers", purpose: "Verifies password hashes via pwd_context.verify.", inputs: "plain password, hashed password", outputs: "boolean validity" }
    ],
    repositories: [
      { name: "database.py", purpose: "Constructs connection engine and SessionLocal context creator.", inputs: "DB URL", outputs: "session context" }
    ],
    middleware: [
      { name: "OAuth2PasswordBearer", purpose: "Extracts authorization header bearer strings" },
      { name: "get_db", purpose: "Yields scoped SQLAlchemy databases and handles closures" }
    ],
    validation: "Pydantic class schemas validation checking email format and string lengths."
  } : {
    controllers: [
      { name: "Route Handlers", purpose: "NextJS api folder routing responding to chat completion triggers.", inputs: "NextRequest payload", outputs: "Response stream" }
    ],
    services: [
      { name: "repositoryService", purpose: "Axios client making documentation and onboarding calls.", inputs: "id string", outputs: "JSON promises" }
    ],
    repositories: [],
    middleware: [
      { name: "ErrorBoundary", purpose: "Catches layout render crashes and displays graceful fallbacks" }
    ],
    validation: "JSON.parse try-catches asserting JSON shapes during upload steps."
  }

  // ─── API DETAILS ───
  const apiDetails = isNestJs ? {
    apiBuildOrder: ["POST /auth/register", "POST /auth/login", "GET /users/profile", "POST /payments/charge"],
    endpoints: [
      { path: "/api/v1/auth/register", method: "POST", request: "{\n  \"email\": \"user@example.com\",\n  \"password\": \"secret123\"\n}", response: "{\n  \"id\": \"uuid\",\n  \"email\": \"user@example.com\"\n}", validation: "@IsEmail() email, @MinLength(6) password", authentication: "None" },
      { path: "/api/v1/auth/login", method: "POST", request: "{\n  \"email\": \"user@example.com\",\n  \"password\": \"secret123\"\n}", response: "{\n  \"access_token\": \"jwt-token-string\"\n}", validation: "@IsNotEmpty() inputs", authentication: "None" },
      { path: "/api/v1/users/profile", method: "GET", request: "Headers: Authorization: Bearer <token>", response: "{\n  \"id\": \"uuid\",\n  \"email\": \"user@example.com\",\n  \"createdAt\": \"timestamp\"\n}", validation: "None", authentication: "JWT Bearer Token" },
      { path: "/api/v1/payments/charge", method: "POST", request: "{\n  \"amount\": 2500,\n  \"source\": \"tok_visa\"\n}", response: "{\n  \"id\": \"ch_StripeId\",\n  \"status\": \"succeeded\"\n}", validation: "@IsNotEmpty() source, @IsNumber() amount", authentication: "JWT Bearer Token" }
    ]
  } : isFastApi ? {
    apiBuildOrder: ["POST /users", "POST /token", "GET /users/me", "GET /items", "POST /items"],
    endpoints: [
      { path: "/users", method: "POST", request: "{\n  \"email\": \"user@example.com\",\n  \"password\": \"secret123\"\n}", response: "{\n  \"id\": 1,\n  \"email\": \"user@example.com\",\n  \"is_active\": true\n}", validation: "Pydantic validation schemas", authentication: "None" },
      { path: "/token", method: "POST", request: "Form data: username=email&password=secret", response: "{\n  \"access_token\": \"token-string\",\n  \"token_type\": \"bearer\"\n}", validation: "None", authentication: "None" },
      { path: "/users/me", method: "GET", request: "Headers: Authorization: Bearer <token>", response: "{\n  \"id\": 1,\n  \"email\": \"user@example.com\"\n}", validation: "None", authentication: "OAuth2 Bearer Token" },
      { path: "/items", method: "GET", request: "None", response: "[\n  {\n    \"id\": 1,\n    \"title\": \"Item 1\",\n    \"owner_id\": 1\n  }\n]", validation: "None", authentication: "None" }
    ]
  } : {
    apiBuildOrder: ["POST /api/chat", "GET /api/repositories", "GET /api/onboarding/[id]"],
    endpoints: [
      { path: "/api/chat", method: "POST", request: "{\n  \"message\": \"Explain auth\"\n}", response: "Streamed text chunks response", validation: "JSON assertion", authentication: "OpenRouter authorization" }
    ]
  }

  // ─── FRONTEND DETAILS ───
  const frontendDetails = hasFrontend ? {
    uiSequence: ["Login View", "Dashboard Overview", "Payment/Creation Dialog"],
    pages: [
      { name: "Login Screen", components: ["LoginForm", "CardContainer"], state: "local: email, password, error", apisConsumed: ["POST /auth/login"], flows: ["Captures inputs, signs JWT, stores token, routes to /dashboard"] },
      { name: "Dashboard Overview", components: ["StatsGrid", "Sidebar", "TransactionTable"], state: "React Query: repository statistics, local: active tab", apisConsumed: ["GET /users/profile", "GET /payments/charge"], flows: ["Mounts dashboard, fetches stats cards data, renders tables"] }
    ]
  } : {
    uiSequence: [],
    pages: []
  }

  // ─── INTEGRATION DETAILS ───
  const integrationDetails = {
    frontendToBackend: hasFrontend ? "API queries are initiated via an Axios HTTP client instance. Global request interceptors insert the stored JWT bearer tokens into requests. Global response interceptors capture 401 statuses to route users back to login." : "No frontend integration mapped.",
    backendToDatabase: isNestJs ? "TypeORM connects using connection parameters. TypeORM automatically maps entities (User, Payment) to PostgreSQL tables, running migrations on startup." : isFastApi ? "SQLAlchemy SessionLocal yields scoped DB contexts, binding transactions. SQLAlchemy entities are mapped to PostgreSQL database tables." : "No backend SQL persistence detected.",
    authFlow: hasAuth ? "User submits credentials → server hashes incoming password and compares with db → returns signed JWT token → client persists token in localStorage → appends token to API requests." : "No authentication module present.",
    errorHandling: isNestJs ? "NestJS global HttpExceptionFilter catches HTTP exceptions and converts them to standard JSON errors: { statusCode, message, timestamp }." : isFastApi ? "FastAPI utilizes raise HTTPException(status_code, detail) returning validation errors to clients." : "Global React ErrorBoundary catches rendering issues, showing fallbacks."
  }

  // ─── AI DETAILS ───
  const aiDetails = isMl ? {
    mlModel: "Scikit-Learn LogisticRegression predictor analyzing user data features.",
    predictionEngine: "FastAPI endpoint routing predictions based on incoming requests payloads.",
    featureEngineering: "Maps database column values (tenure, logs, ratings) into normal distributions.",
    inferencePipeline: "Accepts JSON POST data → normalizes features → runs model.predict_proba() → yields classification metrics."
  } : undefined

  // ─── TESTING DETAILS ───
  const testingDetails = isNestJs ? {
    unitTests: ["AuthService unit specs evaluating registration validation routines", "UserService tests validating DB queries"],
    integrationTests: ["UserController routes tests calling mocked AuthService pipelines"],
    apiTests: ["Supertest endpoints assertions validating DTO inputs requirements"],
    e2eTests: ["Payment specs calling stripe transaction gateways in sandbox environments"]
  } : isFastApi ? {
    unitTests: ["Pytest users crud models validations", "Pytest password hashing verification tests"],
    integrationTests: ["Pytest override db dependencies tests ensuring clean db states"],
    apiTests: ["Httpx client router calls mocking item insertions"],
    e2eTests: ["TestClient assertions verifying JWT endpoint lifecycles"]
  } : {
    unitTests: ["Jest utility methods assertions"],
    integrationTests: ["React Testing Library components action validations"],
    apiTests: ["Local route handlers assertions"],
    e2eTests: ["Playwright UI sequence validations"]
  }

  // ─── DEPLOYMENT DETAILS ───
  const deploymentDetails = isNestJs ? {
    envVars: ["DATABASE_URL=postgresql://localhost:5432/ecommerce", "JWT_SECRET=your-secret-key", "STRIPE_KEY=sk_test_stripeSecret"],
    dockerConfig: "FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD [\"node\", \"dist/main\"]",
    ciCd: "GitHub Actions workflow running lint and unit tests on push. Automatically builds Docker image on merge to main.",
    hosting: "API hosted on Render, Database on AWS RDS Postgres, Frontend client hosted on Vercel."
  } : isFastApi ? {
    envVars: ["DATABASE_URL=postgresql://user:pass@db:5432/dbname", "SECRET_KEY=oauth2-secret-key"],
    dockerConfig: "FROM python:3.9-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]",
    ciCd: "GitHub Actions testing configuration triggering pytest suite automatically.",
    hosting: "FastAPI server deployed on Render, PostgreSQL hosted on Render SQL Add-on."
  } : {
    envVars: ["NEXT_PUBLIC_API_URL=http://localhost:3000", "OPENROUTER_API_KEY=your-openrouter-key"],
    dockerConfig: "FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD [\"npm\", \"start\"]",
    ciCd: "GitHub Actions workflow deploying straight to Vercel on commits.",
    hosting: "Full Next.js server hosted on Vercel."
  }

  // ─── VISUAL TIMELINE ───
  const visualTimeline = [
    {
      week: "Week 1",
      title: "Foundation & Database Schema",
      tasks: [
        "Initialize project skeleton, scripts, environment files",
        "Setup docker configurations and compose databases",
        "Define ORM database models, relations, schemas, constraints",
        "Create initial SQL migration files and database seeds"
      ]
    },
    {
      week: "Week 2",
      title: "Backend Services & APIs API",
      tasks: [
        "Implement data repository methods (queries and inserts)",
        "Build password hashing, verification, and JWT auth service",
        "Expose REST API endpoints, connect routes to services",
        "Configure Pydantic / class-validator validation pipelines"
      ]
    },
    {
      week: "Week 3",
      title: "Frontend Integration & Features",
      tasks: [
        "Setup frontend layout, routing, forms, validation hooks",
        "Connect client requests client to API endpoints using Axios",
        "Implement third party gateways (e.g. Stripe checkout) or ML features",
        "Write full Jest and pytest unit/integration test suites"
      ]
    },
    {
      week: "Week 4",
      title: "Quality Testing & Production Deploy",
      tasks: [
        "Configure automated GitHub Actions CI/CD test runs on push",
        "Run performance smoke tests, secure CORS headers configurations",
        "Deploy Docker container images to Render and AWS instances",
        "Final code cleanup and documentation reviews"
      ]
    }
  ]

  // ─── AI RECONSTRUCTION EXPLANATION ───
  const aiReconstructionExplanation = isNestJs
    ? "Based on the structure, the developers initialized a NestJS template. They set up core modules: AuthModule for credentials, UserModule for data access, and PaymentModule for Stripe gateways. They defined User and Payment entities under TypeORM PostgreSQL, implemented services for auth password checks and Stripe calls, mapped endpoints under Controller decorators, added JwtAuthGuard for route security, and finally set up Dockerfiles and github actions workflows."
    : isFastApi
    ? "The repository highlights a lightweight MVC construction. The developers bootstrapped FastAPI inside main.py, set up SQLAlchemy engine and SessionLocal in app/database.py, structured SQL tables under models.py, and created routers for authorization (auth.py), user registration (users.py), and items CRUD (items.py). Pydantic schemas enforce input validation, and they completed deployment files for containerized uvicorn execution."
    : "The team initialized a Next.js App Router structure. They configured TailwindCSS layout settings, established state management files using Zustand, structured pages under app/ folder routes, configured route handlers under api/ folders to connect to OpenRouter completions, created reusable ui cards and charts using recharts and Lucide icons, and prepared automated Vercel deployment configs."

  // ─── MISSING PIECES DETECTION ───
  const missingPieces: string[] = []
  
  // Check for test files
  const testFiles = files.filter(f => f.toLowerCase().includes("test") || f.toLowerCase().includes("spec"))
  if (testFiles.length === 0) {
    missingPieces.push("No automated tests (unit, integration, or E2E) were detected in the source tree.")
  }
  
  // Check for CI/CD files
  const cicdFiles = files.filter(f => f.toLowerCase().includes(".github/workflows") || f.toLowerCase().includes("gitlab-ci") || f.toLowerCase().includes("jenkins"))
  if (cicdFiles.length === 0) {
    missingPieces.push("No CI/CD pipeline automation workflows (e.g., GitHub Actions, GitLab CI) found.")
  }

  // Check for Docker configurations
  const dockerFiles = files.filter(f => f.toLowerCase().includes("dockerfile") || f.toLowerCase().includes("docker-compose"))
  if (dockerFiles.length === 0) {
    missingPieces.push("No Docker container configurations (Dockerfile or docker-compose.yml) detected.")
  }

  if (dbConns.length > 0) {
    const migrationFiles = files.filter(f => f.toLowerCase().includes("migration") || f.toLowerCase().includes("migrate"))
    if (migrationFiles.length === 0) {
      missingPieces.push("No database migration logs or Alembic/TypeORM seed files detected.")
    }
  }

  if (missingPieces.length === 0) {
    missingPieces.push("No critical reconstruction files are missing. The repository structure is fully complete.")
  }

  return {
    phases,
    systemDesign,
    databaseDesign,
    apiDesign,
    frontendDesign,
    serviceDesign,
    fileCreationOrder,
    sprintPlan,
    mvpPlan,
    teamEstimates,
    blueprint,
    reconstructionPhases,
    databaseDetails,
    backendDetails,
    apiDetails,
    frontendDetails,
    integrationDetails,
    aiDetails,
    testingDetails,
    deploymentDetails,
    visualTimeline,
    aiReconstructionExplanation,
    missingPieces,
  }
}

// ─── LEGACY GENERATOR FALLBACKS ───
function generateLegacyPhases(
  repoName: string,
  arch: ArchitectureAnalysis,
  files: string[],
  tech: string,
  lang: string,
  dbConns: string[],
  externalApis: string[],
  hasFrontend: boolean,
  hasAuth: boolean,
  isMl: boolean
): BuildPhase[] {
  const phases: BuildPhase[] = []
  const fw = tech !== "Unknown" ? tech : lang

  phases.push({
    name: "Project Foundation",
    estimatedTime: `${arch.modules.length > 5 ? "3" : "2"} Hours`,
    tasks: [
      hasFrontend || fw.includes("React") || fw.includes("Vue") || fw.includes("Angular") || fw.includes("Next") || fw.includes("Nuxt")
        ? `Setup ${fw} with TypeScript`
        : isMl
          ? `Setup Python project with ${fw === "Unknown" ? "virtual environment" : fw}`
          : `Setup ${fw} project`,
      ...(dbConns.length > 0 ? [`Configure ${dbConns[0]} connection`] : []),
      "Configure environment variables",
      "Setup project structure (src/, config/, tests/)",
      ...(hasFrontend ? ["Setup frontend build tooling (Vite/Webpack)"] : []),
      ...(isMl ? ["Setup ML experiment tracking (MLflow/Weights & Biases)"] : []),
      "Initialize version control (git)",
      "Setup linting and formatting",
    ],
    deliverable: "Running project skeleton with build system",
  })

  if (dbConns.length > 0) {
    phases.push({
      name: "Database Layer",
      estimatedTime: `${arch.metrics.databaseTables > 5 ? "4" : "3"} Hours`,
      tasks: [
        "Design database schema",
        "Create migration files",
        "Define ORM models/entities",
        ...(hasAuth ? ["Create users/auth tables"] : []),
        "Add indexes for performance",
        "Seed initial data",
        "Write database tests",
      ],
      deliverable: "Working database with migrations and seed data",
    })
  }

  phases.push({
    name: "Core Services & APIs",
    estimatedTime: `${arch.modules.length > 5 ? "6" : "4"} Hours`,
    tasks: [
      "Implement repository/data access layer",
      "Implement service layer with business logic",
      ...(hasAuth ? ["Implement authentication (JWT/OAuth)"] : []),
      ...(isMl ? ["Implement ML model loading and inference service"] : []),
      "Implement main API endpoints",
      ...(arch.layers.length > 0 ? arch.layers.map((l) => `Implement ${l.name} layer`) : []),
      "Add request validation",
      "Add error handling middleware",
      "Write API tests",
    ],
    deliverable: "Working API layer with all core endpoints",
  })

  if (externalApis.length > 0) {
    phases.push({
      name: "External Integrations",
      estimatedTime: `${externalApis.length > 3 ? "4" : "3"} Hours`,
      tasks: externalApis.map((api) => `Integrate ${api}`),
      deliverable: "All external services connected and tested",
    })
  }

  if (hasFrontend) {
    phases.push({
      name: "Frontend Application",
      estimatedTime: `${arch.metrics.totalFiles > 30 ? "6" : "4"} Hours`,
      tasks: [
        "Setup routing",
        "Create shared UI components",
        "Implement main pages",
        "Connect to API layer",
        "Add loading and error states",
        "Implement responsive design",
        "Write frontend tests",
      ],
      deliverable: "Functional user interface connected to backend",
    })
  }

  phases.push({
    name: "Testing & Quality",
    estimatedTime: "3 Hours",
    tasks: [
      ...(hasFrontend ? ["Write integration tests (E2E)"] : []),
      "Add unit tests for all services",
      "Add API contract tests",
      "Performance/load testing",
      "Security audit",
      "Code review and refactoring",
    ],
    deliverable: "Tested codebase with >80% coverage",
  })

  phases.push({
    name: "Deployment",
    estimatedTime: `${isMl ? "4" : "3"} Hours`,
    tasks: [
      "Create Docker configuration",
      "Setup CI/CD pipeline",
      "Configure production environment",
      ...(isMl ? ["Setup model serving infrastructure"] : []),
      "Setup monitoring and logging",
      "Document deployment process",
      "Production smoke tests",
    ],
    deliverable: "Production deployment with monitoring",
  })

  return phases
}

function generateSystemDesign(
  arch: ArchitectureAnalysis,
  tech: string,
  lang: string,
  dbConns: string[],
  externalApis: string[]
): string {
  const altTech = tech === "FastAPI" ? "Django REST Framework" :
    tech === "NestJS" ? "Express.js" :
    tech === "React" ? "Vue.js or Svelte" :
    tech === "Next.js" ? "Remix or Nuxt" :
    "Express.js or FastAPI"

  const altDb = dbConns[0]?.includes("PostgreSQL") ? "MySQL" :
    dbConns[0]?.includes("MongoDB") ? "PostgreSQL" :
    "PostgreSQL"

  const altArch = arch.type === "Microservices" ? "Modular Monolith" :
    arch.type === "Layered" ? "Clean Architecture" :
    "Layered Architecture"

  let text = `## Architecture Choice\n\n`
  text += `${tech} was selected because the repository ${arch.summary.toLowerCase().includes("api") ? "exposes APIs" : "implements business logic"} and benefits from ${tech.toLowerCase().includes("fastapi") ? "asynchronous request handling and automatic OpenAPI documentation" : "its mature ecosystem and strong typing support"}.\n\n`
  text += `**Architecture Pattern:** ${arch.type}\n`
  text += `**Language:** ${lang}\n`
  text += `**Framework:** ${tech}\n`
  text += `**Database:** ${dbConns.join(", ") || "None detected"}\n`
  if (externalApis.length > 0) text += `**External Services:** ${externalApis.join(", ")}\n`
  text += `**Modules:** ${arch.modules.length}\n\n`

  text += `## Why This Architecture\n\n`
  text += `The ${arch.type} architecture provides:\n\n`
  text += `- **Separation of concerns** through ${arch.layers.length > 0 ? arch.layers.map((l) => l.name).join(", ") : "logical module boundaries"}\n`
  text += `- **Maintainability** with clear module boundaries (score: ${arch.maintainabilityScore}/100)\n`
  text += `- **Scalability** by isolating ${arch.modules.length} distinct modules\n\n`

  text += `## Alternative Approaches\n\n`
  text += `| Approach | Pros | Cons |\n`
  text += `|----------|------|------|\n`
  text += `| **${altArch}** | Simpler deployment, easier debugging | May become monolith over time |\n`
  text += `| **${tech} + ${altDb}** | Different ecosystem, different trade-offs | Learning curve, migration cost |\n`
  text += `| **${altTech}** | Alternative framework choice | Different conventions, community size |\n`

  return text
}

function generateDatabaseDesign(arch: ArchitectureAnalysis, dbConns: string[]): string {
  if (dbConns.length === 0) return "No database connections detected in this repository."

  let text = `## Database Overview\n\n`
  text += `**Type:** ${dbConns.join(", ")}\n`
  text += `**Tables:** ${arch.metrics.databaseTables}\n\n`

  const allTables: string[] = []
  if (arch.moduleDetails) {
    for (const detail of Object.values(arch.moduleDetails)) {
      if (detail.dbTables) allTables.push(...detail.dbTables)
    }
  }

  if (allTables.length > 0) {
    text += `## Tables\n\n`
    text += `| Table | Purpose |\n`
    text += `|-------|--------|\n`
    for (const table of [...new Set(allTables)]) {
      const purpose = guessTablePurpose(table)
      text += `| \`${table}\` | ${purpose} |\n`
    }
  }

  text += `\n## Indexes\n\n`
  text += `- Primary key on each table (id/uuid)\n`
  text += `- Foreign key indexes on relationship columns\n`
  if (arch.type.includes("Microservices") || arch.modules.length > 5) {
    text += `- Unique indexes on business identifiers\n`
  }
  text += `- Composite indexes for frequent query patterns\n\n`

  text += `## Relationships\n\n`
  if (allTables.length > 0) {
    text += `\`\`\`mermaid\nerDiagram\n`
    for (const table of [...new Set(allTables)]) {
      text += `  ${table} {\n    int id PK\n    ...\n  }\n`
    }
    text += `\`\`\`\n\n`
  }

  text += `## Constraints\n\n`
  text += `- NOT NULL on required fields\n`
  text += `- UNIQUE on email, username, slug fields\n`
  text += `- CHECK constraints for data validation\n`
  text += `- Foreign key CASCADE on parent deletion\n`

  return text
}

function guessTablePurpose(table: string): string {
  const map: Record<string, string> = {
    user: "User accounts and authentication",
    users: "User accounts and authentication",
    employee: "Employee records",
    employees: "Employee records",
    product: "Product catalog entries",
    products: "Product catalog entries",
    order: "Customer order records",
    orders: "Customer order records",
    payment: "Payment transaction records",
    payments: "Payment transaction records",
    session: "User session data",
    sessions: "User session data",
    token: "Authentication tokens",
    tokens: "Authentication tokens",
    audit: "Audit log entries",
    audit_log: "Audit log entries",
    notification: "Notification records",
    notifications: "Notification records",
    setting: "Application settings",
    settings: "Application settings",
    config: "Configuration values",
    configuration: "Configuration values",
    role: "User role definitions",
    roles: "User role definitions",
    permission: "Access permissions",
    permissions: "Access permissions",
    migration: "Database migration tracking",
    migrations: "Database migration tracking",
    log: "Application log entries",
    logs: "Application log entries",
  }
  for (const [key, val] of Object.entries(map)) {
    if (table.toLowerCase().includes(key)) return val
  }
  return "Business entity data"
}

function generateAPIDesign(arch: ArchitectureAnalysis): string {
  const moduleNames = arch.modules.map((m) => m.name)
  const hasRestApi = moduleNames.some((n) => /api|controller|route/.test(n))

  let text = `## API Overview\n\n`
  text += `**Style:** RESTful HTTP API\n`
  text += `**Base URL:** \`/api/v1\`\n`
  text += `**Format:** JSON\n\n`

  if (arch.entryPoints.length > 0) {
    text += `## Entry Points\n\n`
    for (const ep of arch.entryPoints) {
      text += `- \`${ep}\`\n`
    }
    text += "\n"
  }

  text += `## Endpoints\n\n`
  text += `| Method | Path | Description |\n`
  text += `|--------|------|-------------|\n`

  const endpoints = generateEndpoints(arch)
  for (const ep of endpoints) {
    text += `| ${ep.method} | \`${ep.path}\` | ${ep.desc} |\n`
  }

  text += `\n## Example Request/Response\n\n`
  text += `\`\`\`http\n${endpoints[0]?.method || "GET"} ${endpoints[0]?.path || "/api/v1/resource"}\n\`\`\`\n\n`
  text += `**Request:**\n\`\`\`json\n{\n  "example": "value"\n}\n\`\`\`\n\n`
  text += `**Response:**\n\`\`\`json\n{\n  "success": true,\n  "data": {}\n}\n\`\`\`\n`

  return text
}

function generateEndpoints(arch: ArchitectureAnalysis): { method: string; path: string; desc: string }[] {
  const eps: { method: string; path: string; desc: string }[] = []
  const seen = new Set<string>()

  for (const mod of arch.modules) {
    const base = `/${mod.name.toLowerCase()}`
    if (!seen.has(base)) {
      seen.add(base)
      eps.push({ method: "GET", path: `/api/v1${base}s`, desc: `List all ${mod.name} entries` })
      eps.push({ method: "GET", path: `/api/v1${base}s/:id`, desc: `Get single ${mod.name}` })
      eps.push({ method: "POST", path: `/api/v1${base}s`, desc: `Create ${mod.name}` })
      eps.push({ method: "PATCH", path: `/api/v1${base}s/:id`, desc: `Update ${mod.name}` })
      eps.push({ method: "DELETE", path: `/api/v1${base}s/:id`, desc: `Delete ${mod.name}` })
    }
  }

  if (arch.modules.some((m) => /auth/i.test(m.name))) {
    eps.unshift({ method: "POST", path: "/api/v1/auth/login", desc: "Authenticate user" })
    eps.unshift({ method: "POST", path: "/api/v1/auth/register", desc: "Register new user" })
    eps.unshift({ method: "POST", path: "/api/v1/auth/refresh", desc: "Refresh access token" })
  }

  return eps
}

function generateFrontendDesign(arch: ArchitectureAnalysis, hasFrontend: boolean): string {
  if (!hasFrontend) return "No frontend detected in this repository."

  const moduleNames = arch.modules.map((m) => m.name)
  const fw = Object.keys(arch.frameworks)[0] || "React"

  let text = `## Pages\n\n`
  text += `| Page | Route | Components |\n`
  text += `|------|-------|------------|\n`

  const pages = [
    { route: "/", page: "Dashboard", comps: "StatsCard, ActivityFeed, QuickActions" },
    { route: "/login", page: "Login", comps: "LoginForm, SocialAuth" },
  ]

  for (const mod of arch.modules) {
    pages.push({
      route: `/${mod.name.toLowerCase()}s`,
      page: `${mod.name.charAt(0).toUpperCase() + mod.name.slice(1)} List`,
      comps: `${mod.name}Table, ${mod.name}Card, SearchBar`,
    })
    pages.push({
      route: `/${mod.name.toLowerCase()}s/new`,
      page: `Create ${mod.name}`,
      comps: `${mod.name}Form, ValidationFeedback`,
    })
    pages.push({
      route: `/${mod.name.toLowerCase()}s/:id`,
      page: `${mod.name} Detail`,
      comps: `${mod.name}Info, ActivityTimeline`,
    })
  }

  for (const p of pages) {
    text += `| ${p.page} | \`${p.route}\` | ${p.comps} |\n`
  }

  text += `\n## State Management\n\n`
  text += `- **API State:** React Query/TanStack Query for server state\n`
  text += `- **UI State:** Zustand for global UI state\n`
  text += `- **Form State:** React Hook Form + Zod validation\n\n`

  text += `## Component Architecture\n\n`
  text += `\`\`\`\n`
  text += `pages/          # Route-level page components\n`
  text += `  Dashboard.tsx\n`
  text += `  ${moduleNames.slice(0, 3).map((m) => `${m.charAt(0).toUpperCase() + m.slice(1)}Page.tsx`).join("\n  ")}\n`
  text += `components/     # Reusable UI components\n`
  text += `  layout/       # Header, Sidebar, Footer\n`
  text += `  ui/           # Button, Input, Modal, Card\n`
  text += `  forms/        # Form components and validation\n`
  text += `features/       # Feature-specific components\n`
  text += `hooks/          # Custom React hooks\n`
  text += `services/       # API client and data fetching\n`
  text += `types/          # TypeScript type definitions\n`
  text += `utils/          # Helper functions\n`
  text += `\`\`\`\n`

  return text
}

function generateServiceDesign(arch: ArchitectureAnalysis): string {
  let services = arch.modules.filter((m) => m.type === "service" || m.type === "repository" || m.type === "model" || m.type === "other")

  if (services.length === 0) {
    services = arch.modules.slice(0, 5)
  }

  let text = `## Services Overview\n\n`
  text += `| Service | Responsibility | Dependencies |\n`
  text += `|---------|----------------|-------------|\n`

  for (const svc of services) {
    const detail = arch.moduleDetails?.[svc.name]
    const deps = detail?.dependsOn.map((d) => d.name).join(", ") || "None"
    text += `| \`${svc.name}\` | ${detail?.purpose || `${svc.name} management and business logic`} | ${deps} |\n`
  }

  text += `\n## Service Layer Architecture\n\n`
  text += `\`\`\`\n`
  text += `Controller → Service → Repository → Database\n`
  text += `     ↓           ↓           ↓\n`
  text += `  Validation   Logic      Data Access\n`
  text += `\`\`\`\n\n`

  text += `## Key Service Details\n\n`
  for (const svc of services) {
    const detail = arch.moduleDetails?.[svc.name]
    text += `### ${svc.name}\n\n`
    text += `- **Type:** ${svc.type}\n`
    text += `- **Files:** ${svc.files}\n`
    text += `- **Purpose:** ${detail?.purpose || "Business logic and data management"}\n`
    if (detail?.strengths.length) text += `- **Strengths:** ${detail.strengths.join(", ")}\n`
    if (detail?.risks.length) text += `- **Risks:** ${detail.risks.map((r) => r.description).join("; ")}\n`
    text += "\n"
  }

  return text
}

function generateFileOrder(arch: ArchitectureAnalysis, tech: string, lang: string, hasFrontend: boolean, isMl: boolean): string[] {
  const order: string[] = []
  const ext = lang === "Python" ? ".py" : lang === "TypeScript" || tech.includes("Next") || tech.includes("Nest") ? ".ts" : ".js"

  order.push(`1. package.json${isMl ? " (or requirements.txt)" : ""}`)
  order.push(`2. tsconfig.json${isMl ? " (or pyproject.toml)" : ""}`)
  order.push(`3. .env.example`)
  order.push(`4. src/index${ext} (Entry point)`)

  if (arch.databaseConnections.length > 0) {
    order.push(`5. src/database${ext}`)
    order.push(`6. src/models/User${ext}`)
    order.push(`7. src/migrations/`)
    order.push(`8. src/seed${ext}`)
  }

  let counter = order.length + 1
  for (const mod of arch.modules) {
    if (mod.type === "repository") order.push(`${counter}. src/repositories/${mod.name}${ext}`)
    else if (mod.type === "service") order.push(`${counter}. src/services/${mod.name}${ext}`)
    else if (mod.type === "controller") order.push(`${counter}. src/controllers/${mod.name}${ext}`)
    counter = order.length + 1
  }

  for (const mod of arch.modules) {
    if (mod.type === "model") {
      order.push(`${counter}. src/models/${mod.name}${ext}`)
      counter = order.length + 1
    }
  }

  if (isMl) {
    order.push(`${counter}. src/ml/train${ext}`)
    order.push(`${counter + 1}. src/ml/predict${ext}`)
    order.push(`${counter + 2}. src/ml/model.py`)
  }

  if (hasFrontend) {
    const fe = order.length + 1
    order.push(`${fe}. src/App${lang === "TypeScript" ? ".tsx" : ".jsx"}`)
    order.push(`${fe + 1}. src/pages/Dashboard${lang === "TypeScript" ? ".tsx" : ".jsx"}`)
    order.push(`${fe + 2}. src/components/Layout${lang === "TypeScript" ? ".tsx" : ".jsx"}`)
    order.push(`${fe + 3}. src/services/api${ext}`)
  }

  order.push(`${order.length + 1}. tests/`)
  order.push(`${order.length + 1}. Dockerfile`)
  order.push(`${order.length + 1}. docker-compose.yml`)
  order.push(`${order.length + 1}. .github/workflows/ci.yml`)

  return order
}

function generateSprintPlan(phases: BuildPhase[], est: { hours: string; solo: string; team3: string; team5: string }): string {
  let text = `## Sprint Breakdown\n\n`
  text += `**Total estimated effort:** ${est.hours} hours\n\n`

  const sprintSize = 3
  const sprintCount = Math.ceil(phases.length / sprintSize)

  for (let s = 0; s < sprintCount; s++) {
    const startI = s * sprintSize
    const sprintPhases = phases.slice(startI, startI + sprintSize)
    text += `### Sprint ${s + 1}\n\n`
    text += `**Goal:** ${sprintPhases.map((p) => p.name).join(" → ")}\n\n`
    text += `**Tasks:**\n\n`
    for (const phase of sprintPhases) {
      text += `- **${phase.name}** (${phase.estimatedTime}): ${phase.tasks.slice(0, 3).join(", ")}${phase.tasks.length > 3 ? `, +${phase.tasks.length - 3} more` : ""}\n`
    }
    text += `\n**Deliverable:** ${sprintPhases[sprintPhases.length - 1]?.deliverable}\n\n`
    text += `---\n\n`
  }

  text += `## Timeline Estimates\n\n`
  text += `| Team Size | Duration |\n`
  text += `|-----------|----------|\n`
  text += `| Solo Developer | ${est.solo} |\n`
  text += `| Team of 3 | ${est.team3} |\n`
  text += `| Team of 5 | ${est.team5} |\n`

  return text
}

function generateMVPPlan(phases: BuildPhase[], arch: ArchitectureAnalysis): string {
  const mvpPhases = phases.slice(0, Math.min(3, phases.length))

  let text = `## Minimum Viable Product\n\n`
  text += `The MVP delivers core functionality with minimal scope:\n\n`

  text += `### MVP Scope\n\n`
  text += `| Feature | Priority | Phase |\n`
  text += `|---------|----------|-------|\n`

  const mvpFeatures: { feature: string; priority: string; phase: string }[] = []

  if (arch.modules.some((m) => /auth/i.test(m.name))) {
    mvpFeatures.push({ feature: "User authentication", priority: "Critical", phase: "Phase 2" })
  }
  for (const mod of arch.modules) {
    mvpFeatures.push({ feature: `${mod.name} CRUD`, priority: "Critical", phase: "Phase 3" })
  }
  mvpFeatures.push({ feature: "Core API endpoints", priority: "Critical", phase: "Phase 3" })
  mvpFeatures.push({ feature: "Basic database setup", priority: "Critical", phase: "Phase 2" })
  mvpFeatures.push({ feature: "Essential UI pages", priority: "High", phase: "Phase 4" })

  for (const f of mvpFeatures) {
    text += `| ${f.feature} | ${f.priority} | ${f.phase} |\n`
  }

  text += `\n### What Can Be Postponed\n\n`
  text += `- Advanced analytics and reporting\n`
  text += `- Real-time notifications\n`
  text += `- File uploads and media processing\n`
  text += `- Third-party integrations\n`
  text += `- Admin panel\n`
  text += `- Mobile app\n\n`

  text += `### Phase 1 Features (MVP)\n\n`
  for (const phase of mvpPhases) {
    text += `**${phase.name}:** ${phase.tasks.slice(0, 4).join(", ")}\n\n`
  }

  text += `### Phase 2 Features (Post-MVP)\n\n`
  for (const phase of phases.slice(mvpPhases.length)) {
    text += `**${phase.name}:** ${phase.tasks.slice(0, 4).join(", ")}\n\n`
  }

  return text
}
