import { NextResponse } from "next/server"
import { analyses, fileTrees, fileContents } from "../../../data"
import { extractDataFlow } from "../../extract-dataflow"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const analysis = analyses[id]
  if (!analysis) {
    return NextResponse.json({ error: "Dataflow analysis not found" }, { status: 404 })
  }

  const tree = fileTrees[id] || []
  const contents = fileContents[id] || {}
  const extracted = extractDataFlow(tree, contents, analysis.repository.name)

  const journeys = extracted.flows

  return NextResponse.json({ journeys })
}
