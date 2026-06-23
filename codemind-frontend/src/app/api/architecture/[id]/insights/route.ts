import { NextResponse } from "next/server"
import { repositories, fileTrees, fileContents } from "../../../data"
import { analyzeArchitecture } from "../../architecture-analyzer"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""

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
  const contents = fileContents[id] || {}

  if (!tree) {
    return NextResponse.json({ error: "Repository not yet analyzed" }, { status: 400 })
  }

  try {
    const analysis = await analyzeArchitecture(tree, contents, repo.name)

    // Try AI-generated insights via OpenRouter
    let aiInsights = ""
    if (OPENROUTER_API_KEY) {
      try {
        const prompt = `Analyze this repository architecture and provide insights.

Repository: ${repo.name}
Language: ${repo.language}
Architecture Type: ${analysis.type}
Total Files: ${analysis.metrics.totalFiles}
Total Lines: ${analysis.metrics.totalLines}
Modules: ${analysis.modules.map(m => `${m.name} (${m.type})`).join(", ")}
Entry Points: ${analysis.entryPoints.join(", ")}
Frameworks: ${Object.keys(analysis.frameworks).join(", ")}

Provide a concise analysis covering:
1. Architecture pattern and quality
2. Main strengths
3. Key weaknesses or risks
4. Specific recommendations for improvement

Format as JSON with keys: strengths (array), weaknesses (array), risks (array), recommendations (array)`

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat-v3",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          aiInsights = data.choices?.[0]?.message?.content || ""
        }
      } catch (e) {
        console.error("OpenRouter insights failed:", e)
      }
    }

    // Parse AI insights or use generated ones
    let aiStrengths: string[] = []
    let aiWeaknesses: string[] = []
    let aiRisks: string[] = []
    let aiRecommendations: string[] = []

    if (aiInsights) {
      try {
        const parsed = JSON.parse(aiInsights)
        aiStrengths = parsed.strengths || []
        aiWeaknesses = parsed.weaknesses || []
        aiRisks = parsed.risks || []
        aiRecommendations = parsed.recommendations || []
      } catch {
        // If AI response isn't valid JSON, use generated insights
        aiStrengths = analysis.insights.filter(i => i.type === "strength").map(i => i.description)
        aiWeaknesses = analysis.insights.filter(i => i.type === "weakness").map(i => i.description)
        aiRisks = analysis.insights.filter(i => i.type === "risk").map(i => i.description)
        aiRecommendations = analysis.insights.filter(i => i.type === "recommendation").map(i => i.description)
      }
    } else {
      aiStrengths = analysis.insights.filter(i => i.type === "strength").map(i => i.description)
      aiWeaknesses = analysis.insights.filter(i => i.type === "weakness").map(i => i.description)
      aiRisks = analysis.insights.filter(i => i.type === "risk").map(i => i.description)
      aiRecommendations = analysis.insights.filter(i => i.type === "recommendation").map(i => i.description)
    }

    return NextResponse.json({
      strengths: aiStrengths,
      weaknesses: aiWeaknesses,
      risks: aiRisks,
      recommendations: aiRecommendations,
      summary: analysis.summary,
      architectureType: analysis.type,
      complexity: analysis.complexity.level,
      maintainability: analysis.maintainabilityScore,
    })
  } catch (error) {
    console.error("Architecture insights failed:", error)
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 })
  }
}