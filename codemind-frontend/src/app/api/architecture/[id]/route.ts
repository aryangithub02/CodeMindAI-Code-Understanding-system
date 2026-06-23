import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents } from "../../data"
import { analyzeArchitecture } from "../architecture-analyzer"
import type { ArchitectureAnalysis } from "../types"

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
  if (!tree) {
    return NextResponse.json({ error: "Repository tree not found. Analysis may still be in progress." }, { status: 404 })
  }

  const contents = fileContents[id] || {}

  try {
    const analysis = await analyzeArchitecture(tree, contents, repo.name)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Architecture analysis failed:", error)
    return NextResponse.json({ error: "Architecture analysis failed" }, { status: 500 })
  }
}