import { NextResponse } from "next/server"
import { analyses, fileTrees } from "../../data"
import { generateOnboardingPlan } from "../generate-onboarding"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const analysis = analyses[id]
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
  }

  const tree = fileTrees[id]
  const plan = generateOnboardingPlan(tree, analysis)
  return NextResponse.json(plan)
}
