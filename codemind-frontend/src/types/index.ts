export interface Repository {
  id: string
  name: string
  url?: string
  language: string
  framework?: string
  totalFiles: number
  totalLines: number
  totalClasses: number
  totalFunctions: number
  status: AnalysisStatus
  createdAt: string
  updatedAt: string
}

export type AnalysisStatus =
  | "queued"
  | "cloning"
  | "scanning"
  | "parsing"
  | "embedding"
  | "graph_building"
  | "complete"
  | "error"

export interface AnalysisResult {
  repository: Repository
  architecture: ArchitectureAnalysis
  dependencies: DependencyAnalysis
  dataFlow: DataFlowAnalysis
  documentation: DocumentationResult
  security: SecurityFinding[]
  quality: QualityFinding[]
}

export interface DependencyAnalysis {
  graph: DependencyGraph
  hotspots: Hotspot[]
  circularDependencies: string[][]
  externalDependencies: string[]
  summary: DependencySummary
}

export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphNode {
  id: string
  label: string
  type: "file" | "class" | "function" | "module"
  filePath?: string
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface Hotspot {
  module: string
  referencedBy: number
}

export interface DependencySummary {
  filesWithImports: number
  totalImportStatements: number
  uniqueExternalDependencies: number
}

export interface DataFlowNode {
  id: string
  label: string
  type: "user" | "frontend" | "controller" | "service" | "repository" | "database" | "external" | "queue" | "event" | "gateway" | "cache" | "transformer"
  requestCount: number
  riskLevel: "Low" | "Medium" | "High" | "Critical"
  description?: string
  filePath?: string
  language?: string
  purpose?: string
  businessRole?: string
  inputs?: string[]
  outputs?: string[]
  dataTransformations?: string[]
  dependencies?: string[]
  dependents?: string[]
  aiExplanation?: string
}

export interface DataFlowEdge {
  source: string
  target: string
  relation: string
  dataType?: string
  volume?: number
  latency?: string
  isAnimated: boolean
  riskLevel?: "Low" | "Medium" | "High" | "Critical"
  frequency?: number
}

export interface FlowBreakdownStep {
  step: number
  title: string
  request?: string
  file: string
  purpose: string
  operations?: string[]
}

export interface FileParticipation {
  file: string
  role: string
  calls: string[]
  dependencies: string[]
}

export interface TransformationTrack {
  stage: string
  value: string
  operation?: string
}

export interface DatabaseFlowAnalysis {
  tablesAccessed: string[]
  collectionsAccessed: string[]
  readOperations: number
  writeOperations: number
  indexesUsed: string[]
  queryComplexity: "Low" | "Medium" | "High"
}

export interface ExternalAPIDetail {
  name: string
  purpose: string
  calls: string
  avgResponse: string
  failureImpact: "Low" | "Medium" | "High" | "Critical"
}

export interface SecurityFlowAnalysis {
  authentication: string
  authorization: string
  inputValidation: string
  sensitiveDataExposure: string
  riskLevel: "Low" | "Medium" | "High" | "Critical"
  reason?: string
}

export interface FailureImpactAnalysis {
  nodeName: string
  impact: string
  affectedFlows: number
  affectedFiles: number
  businessImpact: "Low" | "Medium" | "High" | "Critical"
}

export interface FlowBottleneckDetail {
  issue: string
  recommendation: string
  severity: "Low" | "Medium" | "High" | "Critical"
}

export interface PerformanceBreakdown {
  latency: string
  database: number // percentage
  businessLogic: number // percentage
  network: number // percentage
  cpuCost?: string
  memoryCost?: string
}

export interface DeveloperOnboardingFlow {
  filesToRead: string[]
  executionOrder: string[]
  conceptsRequired: string[]
  estimatedLearningTime: string
}

export interface DataFlowJourney {
  id: string
  label: string
  description: string
  nodeIds: string[]
  edgeIds: string[]
  color: string
  purpose?: string
  entryPoint?: string
  route?: string
  controllers?: string[]
  services?: string[]
  repositories?: string[]
  databaseOperations?: string[]
  externalAPIs?: string[]
  transformations?: string[]
  output?: string
  dependencies?: string[]
  riskLevel?: "Low" | "Medium" | "High" | "Critical"
  performanceScore?: number
  securityScore?: number
  businessCriticality?: "Low" | "Medium" | "High" | "Critical"
  averageResponse?: string
  filesInvolved?: number
  functionsInvolved?: number
  databaseQueries?: number
  flowType?: string
  complexity?: "Low" | "Medium" | "High"
  businessImpact?: string
  requestJourney?: string[]
  breakdown?: FlowBreakdownStep[]
  fileParticipation?: FileParticipation[]
  aiExplanation?: {
    detailed: string
    business: string
    technical: string
    beginner: string
  }
  dataTransformation?: TransformationTrack[]
  databaseFlow?: DatabaseFlowAnalysis
  externalAPIDetails?: ExternalAPIDetail[]
  securityFlow?: SecurityFlowAnalysis
  failureImpact?: FailureImpactAnalysis
  bottlenecksList?: FlowBottleneckDetail[]
  performanceBreakdown?: PerformanceBreakdown
  onboarding?: DeveloperOnboardingFlow
}

export interface DataFlowAnalysisResult {
  nodes: DataFlowNode[]
  edges: DataFlowEdge[]
  flows: DataFlowJourney[]
  summary: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  recommendations: string[]
}

export interface FlowMetrics {
  totalFlows: number
  requestFlows: number
  databaseFlows: number
  externalAPIs: number
  bottlenecks: number
  riskScore: "Low" | "Medium" | "High" | "Critical"
}

export interface FlowBottleneck {
  nodeId: string
  label: string
  usedByCount: number
  type: string
  severity: "Low" | "Medium" | "High" | "Critical"
  suggestion: string
}

export interface FlowImpact {
  nodeId: string
  label: string
  type: string
  affectedServices: string[]
  affectedApis: string[]
  affectedDatabases: string[]
  affectedFiles: string[]
  impactLevel: "Low" | "Medium" | "High" | "Critical"
}

export interface DataFlowAnalysis {
  routes: Route[]
  flow: string[]
  sequenceDiagram?: string
  flowDiagram?: string
  architectureDiagram?: string
  mermaidDiagram?: string
  metrics?: FlowMetrics
  bottlenecks?: FlowBottleneck[]
  analysis?: DataFlowAnalysisResult
}

export interface Route {
  method: string
  path: string
  file: string
}

export interface DocumentationResult {
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
}

export interface DocumentationSection {
  id: string
  label: string
  description: string
  icon: string
  category: string
  complexity: "Low" | "Medium" | "High" | "Critical"
}

export interface DocumentationExportOptions {
  format: "pdf" | "markdown" | "html" | "json" | "docx" | "mermaid"
  sections: string[]
}

export interface AIDocumentationContent {
  summary: string
  architecture: string
  onboarding: string
  generated_at: string
}

export interface SecurityFinding {
  severity: "Critical" | "High" | "Medium" | "Low"
  category: string
  description: string
  file: string
  line: number
  snippet: string
}

export interface QualityFinding {
  type: string
  file: string
  line: number
  description: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: ChatSource[]
}

export interface ChatSource {
  file: string
  line: number
  snippet: string
}

export type TaskStatus = "completed" | "in_progress" | "not_started"

// ─── Enhanced Onboarding Types ───────────────────────────────────────────

export interface OnboardingTask {
  id: string
  label: string
  description: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  estimatedMinutes: number
  importance: "Critical" | "High" | "Medium" | "Low"
  type: "read" | "understand" | "trace" | "explore" | "practice"
}

export interface OnboardingFile {
  path: string
  purpose: string
  importance: "Critical" | "High" | "Medium" | "Low"
  complexity: "Low" | "Medium" | "High"
  estimatedMinutes: number
  score: number
}

export interface OnboardingPhase {
  name: string
  description: string
  estimatedTime: string
  tasks: OnboardingTask[]
  files: OnboardingFile[]
  flows: string[]
}

export interface ImportantComponent {
  name: string
  type: string
  importance: string
  description: string
  usedByCount: number
  files: string[]
}

export interface ImportantFlow {
  name: string
  description: string
  steps: string[]
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface ReadinessScore {
  overall: number
  filesRead: number
  modulesExplored: number
  flowsReviewed: number
  architectureStudied: number
}

export interface OnboardingPlan {
  summary?: {
    purpose: string
    architecture: string
    techStack: string[]
    complexity: string
    estimatedLearningTime: string
    mainComponents: string[]
    totalFiles: number
    totalLines: number
  }
  phases?: OnboardingPhase[]
  importantComponents?: {
    services: ImportantComponent[]
    apis: ImportantComponent[]
    files: OnboardingFile[]
    databases: string[]
  }
  importantFlows?: ImportantFlow[]
  architecturePath?: { step: string; description: string }[]
  quiz?: QuizQuestion[]
  readiness?: ReadinessScore
  days?: OnboardingDay[]
}

// Legacy types kept for backward compatibility during migration
export interface OnboardingDay {
  day: number
  title: string
  goals: string[]
  activities: OnboardingActivity[]
  tasks?: { id: string; label: string; status: TaskStatus }[]
  files?: string[]
  flows?: string[]
}

export interface OnboardingActivity {
  description: string
  items: string[]
}

export interface DashboardStats {
  totalRepositories: number
  totalFiles: number
  totalClasses: number
  totalFunctions: number
  architectureStyle: string
  riskLevel: "Low" | "Medium" | "High"
  circularDependencies: number
}

export interface RepositoryTreeNode {
  name: string
  type: "file" | "directory"
  path: string
  children?: RepositoryTreeNode[]
}

export interface ArchitectureNode {
  id: string
  label: string
  type: "frontend" | "api" | "service" | "repository" | "model" | "database" | "external" | "entry" | "framework" | "layer" | "module" | "controller" | "other"
  fileCount: number
  complexity: "Low" | "Medium" | "High" | "Critical"
  dependencyCount?: number
  riskLevel?: "Low" | "Medium" | "High" | "Critical"
  description?: string
  isEntryPoint?: boolean
  dbTables?: number
  purpose?: string
  importance?: "Critical" | "High" | "Medium" | "Low"
  healthScore?: number
  layer?: string
}

export interface ArchitectureEdge {
  source: string
  target: string
  relation: string
  weight?: number
}

export interface ArchitectureMetrics {
  totalFiles: number
  totalLines: number
  totalClasses: number
  totalFunctions: number
  services: number
  controllers: number
  apis: number
  databaseTables: number
  externalIntegrations: number
  testFiles: number
  configFiles: number
  docFiles: number
  avgFileSize: number
}

export interface ArchitectureInsight {
  type: "strength" | "weakness" | "risk" | "recommendation"
  title: string
  description: string
}

export interface ModuleFileDetail {
  path: string
  name: string
  loc: number
  complexity: "Low" | "Medium" | "High" | "Critical"
  purpose: string
}

export interface ModuleRisk {
  type: "circular_dependency" | "god_class" | "tight_coupling" | "large_file" | "security" | "complexity"
  severity: "Low" | "Medium" | "High" | "Critical"
  description: string
}

export interface ModuleDetail {
  id: string
  name: string
  type: string
  purpose: string
  businessRole: string
  importance: "Critical" | "High" | "Medium" | "Low"
  files: ModuleFileDetail[]
  totalLoc: number
  dependsOn: { name: string; type: string }[]
  usedBy: { name: string; type: string }[]
  entryPoints: string[]
  requestFlow: string[]
  dbTables: string[]
  dbReads: number
  dbWrites: number
  risks: ModuleRisk[]
  strengths: string[]
  recommendations: string[]
  aiExplanation: string
  maintainabilityScore: number
  technicalDebt: string
  fileCount: number
  dependencyCount: number
  complexity: "Low" | "Medium" | "High" | "Critical"
  riskLevel: "Low" | "Medium" | "High" | "Critical"
  isEntryPoint?: boolean
  ownerLayer?: string
  consumers?: string[]
  impactAnalysis?: {
    affectedApis: number
    affectedServices: number
    affectedTables: number
    affectedFiles: number
    impactGraph: string[]
  }
}

export interface ArchitectureAnalysis {
  type: string
  typeScore: number
  typeConfidence: "High" | "Medium" | "Low"
  modules: { name: string; type: string; files: number }[]
  moduleDetails?: Record<string, ModuleDetail>
  entryPoints: string[]
  frameworks: Record<string, string>
  layers: { name: string; description: string }[]
  databaseConnections: string[]
  externalAPIs: string[]
  complexity: { level: string; score: number }
  maintainabilityScore: number
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  metrics: ArchitectureMetrics
  insights: ArchitectureInsight[]
  summary: string
  criticalDependencies: number
  circularDependencies: number
  healthScore: number
  criticalModulesCount: number
  highRiskAreasCount: number
  couplingScore: string
  scalabilityScore: string
  technicalDebtScore: string
  confidence: string
}

export interface ArchitectureInsightResponse {
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  recommendations: string[]
  summary: string
  architectureType: string
  complexity: string
  maintainability: number
}

export interface ArchitectureGraphResponse {
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
}

// ─── Dependency Graph Intelligence Types ────────────────────────────────

export type DepNodeType = "module" | "service" | "controller" | "repository" | "database" | "external" | "file"

export type DepEdgeType =
  | "IMPORTS"
  | "CALLS"
  | "USES"
  | "READS"
  | "WRITES"
  | "DEPENDS_ON"
  | "EVENTS"
  | "EXTENDS"
  | "IMPLEMENTS"

export interface DepNode {
  id: string
  label: string
  type: DepNodeType
  fileCount: number
  complexity: "Low" | "Medium" | "High" | "Critical"
  riskLevel: "Low" | "Medium" | "High" | "Critical"
  dependencyCount: number
  dependantCount: number
  betweenness: number
  couplingScore: number
  isCircular: boolean
  description?: string
  filePath?: string
  language?: string
}

export interface DepEdge {
  id: string
  source: string
  target: string
  relation: DepEdgeType
  weight: number
  isCircular: boolean
  label?: string
}

export interface DepMetrics {
  totalNodes: number
  totalEdges: number
  criticalDependencies: number
  circularDependencies: number
  couplingScore: number
  maintainabilityScore: number
  avgDependencyCount: number
  maxDependencyCount: number
  bottleneckCount: number
}

export interface DepHotspot {
  nodeId: string
  label: string
  type: DepNodeType
  dependencyCount: number
  dependantCount: number
  riskLevel: string
  isBottleneck: boolean
}

export interface DepCircularGroup {
  nodes: string[]
  severity: "Low" | "Medium" | "High" | "Critical"
}

export interface ImpactResult {
  nodeId: string
  label: string
  affectedApis: string[]
  affectedServices: string[]
  affectedTables: string[]
  affectedFiles: string[]
  impactScore: number
  impactLevel: "Low" | "Medium" | "High" | "Critical"
  propagationPath: string[]
}

export interface DependencyIntelligence {
  graph: { nodes: DepNode[]; edges: DepEdge[] }
  metrics: DepMetrics
  hotspots: DepHotspot[]
  circularGroups: DepCircularGroup[]
  externalDependencies: string[]
}

// ─── Build From Scratch Types ────────────────────────────────────────────

export interface BuildPhase {
  name: string
  estimatedTime: string
  tasks: string[]
  deliverable: string
}

export interface BuildTeamEstimates {
  soloDeveloper: string
  teamOfThree: string
  teamOfFive: string
}

export interface BuildFromScratchPlan {
  phases: BuildPhase[]
  systemDesign: string
  databaseDesign: string
  apiDesign: string
  frontendDesign: string
  serviceDesign: string
  fileCreationOrder: string[]
  sprintPlan: string
  mvpPlan: string
  teamEstimates: BuildTeamEstimates
  blueprint: {
    projectName: string
    projectType: string
    techStack: string[]
    architecturePattern: string
    complexity: string
    estimatedBuildTime: string
    estimatedLearningTime: string
    difficulty: string
  }
  reconstructionPhases: {
    phaseId: number
    name: string
    whyExists: string
    filesToCreate: { path: string; purpose: string }[]
    technologiesNeeded: string[]
    expectedOutput: string
    learningAccelerator?: {
      concepts: { name: string; difficulty: string; time: string; resources: string[] }[]
    }
  }[]
  databaseDetails?: {
    collections: { name: string; description: string; fields: string[] }[]
    schemas: string
    relationships: string
    indexes: string[]
    mermaidErDiagram: string
  }
  backendDetails?: {
    controllers: { name: string; purpose: string; inputs: string; outputs: string }[]
    services: { name: string; purpose: string; inputs: string; outputs: string }[]
    repositories: { name: string; purpose: string; inputs: string; outputs: string }[]
    middleware: { name: string; purpose: string }[]
    validation: string
  }
  apiDetails?: {
    apiBuildOrder: string[]
    endpoints: { path: string; method: string; request: string; response: string; validation: string; authentication: string }[]
  }
  frontendDetails?: {
    uiSequence: string[]
    pages: { name: string; components: string[]; state: string; apisConsumed: string[]; flows: string[] }[]
  }
  integrationDetails?: {
    frontendToBackend: string
    backendToDatabase: string
    authFlow: string
    errorHandling: string
  }
  aiDetails?: {
    mlModel: string
    predictionEngine: string
    featureEngineering: string
    inferencePipeline: string
  }
  testingDetails?: {
    unitTests: string[]
    integrationTests: string[]
    apiTests: string[]
    e2eTests: string[]
  }
  deploymentDetails?: {
    envVars: string[]
    dockerConfig: string
    ciCd: string
    hosting: string
  }
  visualTimeline: {
    week: string
    title: string
    tasks: string[]
  }[]
  aiReconstructionExplanation: string
  missingPieces: string[]
}

export interface Settings {
  theme: "dark" | "light" | "system"
  apiKey: string
  openRouterKey: string
  repositoryDefaults: {
    maxDepth: number
    excludeDirs: string[]
  }
}
