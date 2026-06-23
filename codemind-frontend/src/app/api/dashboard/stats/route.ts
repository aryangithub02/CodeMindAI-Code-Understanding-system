import { NextResponse } from "next/server"
import { getDashboardStats } from "../../data"

export async function GET() {
  const stats = getDashboardStats()
  return NextResponse.json(stats)
}
export const dynamic = "force-dynamic"
