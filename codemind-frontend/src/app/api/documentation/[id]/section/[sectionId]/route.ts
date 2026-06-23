import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents, analyses } from "../../../../data"
import { generateDocumentation } from "../../../generate-documentation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { id, sectionId } = await params

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
        // Fallback minimal architecture
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

      const content = docs[sectionId]
      if (!content) return NextResponse.json({ error: "Section not found" }, { status: 404 })
      return NextResponse.json({ content })
    } catch (e) {
      return NextResponse.json({ error: "Failed to generate section" }, { status: 500 })
    }
  }

  const content = (analysis.documentation as unknown as Record<string, string>)[sectionId]
  if (!content) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 })
  }
  return NextResponse.json({ content })
}
