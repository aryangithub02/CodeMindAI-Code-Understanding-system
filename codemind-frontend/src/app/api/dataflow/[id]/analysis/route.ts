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

  const nodeCount = extracted.nodes.length
  const edgeCount = extracted.edges.length
  const svcCount = extracted.nodes.filter(n => n.type === "service").length
  const extCount = extracted.nodes.filter(n => n.type === "external").length
  const hasDb = extracted.nodes.some(n => n.type === "database")
  const hasAuth = extracted.nodes.some(n => /auth|login|token/i.test(n.label))

  const analysisResult: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    risks: string[]
    recommendations: string[]
  } = {
    summary: `${analysis.repository.name} follows a layered request-processing architecture with ${nodeCount} data flow nodes and ${edgeCount} data flow connections. `
      + `Requests flow through ${svcCount} service layer(s)${hasDb ? " before reaching persistent storage" : ""}.`
      + (hasAuth ? " Authentication gates most protected routes." : ""),
    strengths: [
      `${svcCount > 1 ? "Well-separated service layer with clear boundaries" : "Service layer encapsulates business logic"}`,
      hasDb ? "Data persistence layer isolated behind repository abstractions" : "Clear request processing pipeline",
      extCount > 0 ? `Integrates with ${extCount} external service(s)` : "Self-contained architecture with minimal external coupling",
      "Animated flow visualization shows real-time request movement",
    ],
    weaknesses: [
      nodeCount < 4 ? "Limited flow diversity — fewer distinct processing stages" : "Some flows may share intermediate processing nodes",
      extCount === 0 ? "No external API integrations detected — may limit functionality" : "External API calls introduce network latency",
      "Data transformation steps are implicit rather than explicitly documented",
    ],
    risks: [
      hasAuth ? "Authentication service is a single point of failure for all protected routes" : "No authentication layer detected — all routes are public",
      hasDb ? "Database is a bottleneck for all read/write operations" : "No persistent storage detected — data may be lost on restart",
      ...(extCount > 0 ? [`${extCount} external service(s) create dependency risks — an outage could cascade`] : []),
      "Flow visualization relies on static analysis — async/event-driven flows may be underdetected",
    ],
    recommendations: [
      hasDb ? "Add read replicas and caching layer (Redis) to reduce database bottleneck" : "Consider adding persistent storage for production data",
      "Introduce distributed tracing (OpenTelemetry) for production flow monitoring",
      extCount > 0 ? `Add circuit breakers for ${extCount} external service call(s) to prevent cascade failures` : "Implement health checks and retry logic for external dependencies",
      "Add message queue (Kafka/RabbitMQ) for async flow processing to improve resilience",
      "Document data transformation contracts between layers for better maintainability",
    ],
  }

  return NextResponse.json(analysisResult)
}
