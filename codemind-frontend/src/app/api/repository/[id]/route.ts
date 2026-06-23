import { NextResponse } from "next/server"
import { repositories, deleteRepository } from "../../data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const repo = repositories.find((r) => r.id === id)
  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 })
  }
  return NextResponse.json(repo)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = deleteRepository(id)
  if (!deleted) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
