import { NextResponse } from "next/server"
import { fileContents } from "../../../data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  if (!path) {
    return NextResponse.json({ error: "Path query param is required" }, { status: 400 })
  }

  const repoContents = fileContents[id] || {}
  const content = repoContents[path] || `// Content for ${path} not loaded on mock server.`

  return NextResponse.json({ content })
}
