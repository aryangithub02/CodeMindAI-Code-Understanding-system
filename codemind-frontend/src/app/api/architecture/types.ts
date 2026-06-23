import type { RepositoryTreeNode } from "@/types"

export type { RepositoryTreeNode }

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