import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents } from "../../../data"
import { analyzeArchitecture } from "../../architecture-analyzer"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const repo = repositories.find((r) => r.id === id)
  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 })
  }

  const tree = fileTrees[id]
  const contents = fileContents[id] || {}

  if (!tree) {
    return NextResponse.json({ error: "Repository not yet analyzed" }, { status: 400 })
  }

  try {
    const analysis = await analyzeArchitecture(tree, contents, repo.name)
    return NextResponse.json({
      nodes: analysis.nodes,
      edges: analysis.edges,
    })
  } catch (error) {
    console.error("Architecture graph failed:", error)
    return NextResponse.json({ error: "Failed to generate graph" }, { status: 500 })
  }
}