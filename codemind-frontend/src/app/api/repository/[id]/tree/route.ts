import { NextResponse } from "next/server"
import { fileTrees } from "../../../data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tree = fileTrees[id] || []
  return NextResponse.json(tree)
}
