import { NextResponse } from "next/server"
import { repositories, fileTrees, analyses } from "../../../data"
import { generateBuildPlan } from "../../generate-build-plan"

export async function GET(
  _request: Request,
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
  if (!tree) {
    return NextResponse.json({ error: "File tree not found" }, { status: 404 })
  }

  if (!analysis.architecture || typeof analysis.architecture === "string") {
    return NextResponse.json({ error: "Architecture analysis required" }, { status: 400 })
  }

  try {
    const plan = generateBuildPlan(repo.name, analysis.architecture as any, tree)
    return NextResponse.json(plan)
  } catch (e) {
    console.error("Failed to generate build plan:", e)
    return NextResponse.json({ error: "Failed to generate build plan" }, { status: 500 })
  }
}
