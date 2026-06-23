import { NextResponse } from "next/server"
import { analyses } from "../../../data"

const DOC_SECTIONS = [
  { id: "overview", label: "Repository Overview", description: "Project summary, tech stack, statistics", icon: "BookOpen", category: "Overview", complexity: "Low" },
  { id: "architecture", label: "Architecture Docs", description: "Patterns, layers, modules, diagrams", icon: "Cpu", category: "Architecture", complexity: "High" },
  { id: "api", label: "API Documentation", description: "Endpoints, schemas, auth, errors", icon: "Globe", category: "API", complexity: "Medium" },
  { id: "services", label: "Service Documentation", description: "Core services and their responsibilities", icon: "FileText", category: "Services", complexity: "Medium" },
  { id: "database", label: "Database Docs", description: "Tables, relationships, indexes, queries", icon: "Database", category: "Database", complexity: "Medium" },
  { id: "dependencies", label: "Dependency Docs", description: "Module graph, hotspots, circular deps", icon: "Share2", category: "Dependencies", complexity: "High" },
  { id: "dataflow", label: "Data Flow Docs", description: "Request lifecycle, sequence diagrams", icon: "Activity", category: "Flows", complexity: "High" },
  { id: "setup", label: "Setup Documentation", description: "Installation, configuration, prerequisites", icon: "Wrench", category: "Deployment", complexity: "Low" },
  { id: "deployment", label: "Deployment Docs", description: "Docker, CI/CD, production guide", icon: "Rocket", category: "Deployment", complexity: "Medium" },
  { id: "ai_guide", label: "AI Repository Guide", description: "AI analysis, recommendations, onboarding", icon: "Bot", category: "AI", complexity: "Low" },
]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const analysis = analyses[id]
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(DOC_SECTIONS)
}
