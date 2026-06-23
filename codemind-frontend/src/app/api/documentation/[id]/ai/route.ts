import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents, analyses } from "../../../data"
import { generateDocumentation } from "../../generate-documentation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const repo = repositories.find((r) => r.id === id)
  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const analysis = analyses[id]
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
  }

  const tree = fileTrees[id]
  const contents = fileContents[id] || {}

  if (tree) {
    try {
      const arch = analysis.architecture
      let docs: Record<string, string>
      if (arch && typeof arch === "object") {
        docs = generateDocumentation(repo.name, arch as any, tree, contents)
      } else if (analysis.documentation) {
        docs = analysis.documentation as unknown as Record<string, string>
      } else {
        const minimalArch: any = {
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
          metrics: { totalFiles: tree.length, totalLines: 0, totalClasses: 0, totalFunctions: 0 },
          insights: [],
          summary: repo.name,
          criticalDependencies: 0,
          circularDependencies: 0,
        }
        docs = generateDocumentation(repo.name, minimalArch, tree, contents)
      }

      return NextResponse.json({
        summary: docs.overview || "",
        architecture: docs.architecture || "",
        onboarding: docs.ai_guide || "",
        generated_at: new Date().toISOString(),
      })
    } catch (e) {
      return NextResponse.json({ error: "Failed to generate AI documentation" }, { status: 500 })
    }
  }

  return NextResponse.json({
    summary: analysis.documentation?.overview || "",
    architecture: analysis.documentation?.architecture || "",
    onboarding: analysis.documentation?.ai_guide || "",
    generated_at: new Date().toISOString(),
  })
}
