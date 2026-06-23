import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents, analyses } from "../../../../data"
import { generateDocumentation } from "../../../generate-documentation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  const { id, format } = await params

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

  let docs: Record<string, string>
  try {
    if (tree && analysis.architecture && typeof analysis.architecture === "object") {
      docs = generateDocumentation(repo.name, analysis.architecture as any, tree, contents)
    } else if (analysis.documentation) {
      docs = analysis.documentation as unknown as Record<string, string>
    } else if (tree) {
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
    } else {
      docs = {}
    }
  } catch (e) {
    return NextResponse.json({ error: "Failed to prepare export" }, { status: 500 })
  }

  const markdown = Object.entries(docs)
    .map(([key, val]) => `# ${key}\n\n${val}`)
    .join("\n\n---\n\n")

  switch (format) {
    case "markdown":
    case "mermaid":
      return new NextResponse(markdown, {
        headers: { "Content-Type": "text/markdown", "Content-Disposition": `attachment; filename="${id}-docs.md"` },
      })
    case "json":
      return NextResponse.json(docs)
    case "html": {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Documentation</title><body class="dark"><main>${markdown.replace(/\n/g, "<br>")}</main></body></html>`
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html", "Content-Disposition": `attachment; filename="${id}-docs.html"` },
      })
    }
    default:
      return new NextResponse(markdown, {
        headers: { "Content-Type": "text/markdown", "Content-Disposition": `attachment; filename="${id}-docs.md"` },
      })
  }
}
