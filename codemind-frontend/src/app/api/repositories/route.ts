import { NextResponse } from "next/server"
import { repositories, addRepository } from "../data"

export async function GET() {
  return NextResponse.json(repositories)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const newRepo = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    addRepository(newRepo)
    return NextResponse.json(newRepo)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create repository" }, { status: 400 })
  }
}
