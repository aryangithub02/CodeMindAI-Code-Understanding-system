import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents, analyses } from "../../data"
import { generateDocumentation } from "../generate-documentation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const repo = repositories.find((r) => r.id === id)
  if (!repo) {
    return NextResponse.json({ error: "Documentation not found" }, { status: 404 })
  }

  const analysis = analyses[id]
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
  }

  const tree = fileTrees[id]
  const contents = fileContents[id] || {}

  if (!tree) {
    return NextResponse.json({ error: "File tree not found" }, { status: 404 })
  }

  // Some cached analyses store `architecture` as a markdown string (older format).
  // In that case avoid calling the structured generator which expects an object
  // and instead return the precomputed documentation block if available.
  try {
    const arch = analysis.architecture
    if (arch && typeof arch === "object") {
      const docs = generateDocumentation(repo.name, arch as any, tree, contents)
      return NextResponse.json(docs)
    }

    // Fallback: return documentation field if present
    if (analysis.documentation) {
      return NextResponse.json(analysis.documentation)
    }

    // As last resort produce minimal overview using the generator with a safe minimal architecture
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
    const docs = generateDocumentation(repo.name, minimalArch, tree, contents)
    return NextResponse.json(docs)
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate documentation" }, { status: 500 })
  }
}
