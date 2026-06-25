import { NextResponse } from "next/server"
import { after } from "next/server"
import { repositories, fileTrees, fileContents, analyses, onboardingPlans, saveCache } from "../data"

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const repoId = `repo-${Math.random().toString(36).slice(2, 9)}`
    const repoName = file.name.replace(/\.[^/.]+$/, "") // Strip extension

    const newRepo = {
      id: repoId,
      name: repoName,
      language: "TypeScript",
      framework: "Next.js",
      totalFiles: 12,
      totalLines: 1540,
      totalClasses: 3,
      totalFunctions: 24,
      status: "queued" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    repositories.push(newRepo)
    saveCache()

    // Process immediately to avoid Vercel killing background tasks
    const repo = repositories.find(r => r.id === repoId)
    if (repo) {
      repo.status = "complete"
      repo.updatedAt = new Date().toISOString()

      // Add generated details for this repo when complete
          fileTrees[repoId] = [
            { name: "src", type: "directory", path: "src", children: [
              { name: "index.ts", type: "file", path: "src/index.ts" },
              { name: "utils.ts", type: "file", path: "src/utils.ts" }
            ]},
            { name: "package.json", type: "file", path: "package.json" }
          ]
          fileContents[repoId] = {
            "src/index.ts": `console.log("Hello from uploaded repo!");`,
            "src/utils.ts": `export const add = (a: number, b: number) => a + b;`,
            "package.json": `{"name": "${repoName}", "version": "1.0.0"}`
          }
          analyses[repoId] = {
            repository: repo,
            architecture: {
              type: "Layered",
              typeScore: 85,
              typeConfidence: "High",
              modules: [{ name: "src", type: "module", files: 2 }],
              entryPoints: ["src/index.ts"],
              frameworks: {},
              layers: [{ name: "Source", description: "Core source code" }],
              databaseConnections: [],
              externalAPIs: [],
              complexity: { level: "Low", score: 15 },
              maintainabilityScore: 90,
              nodes: [
                { id: "src", label: "Source Files", type: "module", fileCount: 2, complexity: "Low" },
                { id: "entry", label: "index.ts", type: "entry", fileCount: 1, complexity: "Low" }
              ],
              edges: [{ source: "entry", target: "src", relation: "PART_OF" }],
              metrics: { totalFiles: 2, totalLines: 10, totalClasses: 0, totalFunctions: 1, services: 0, controllers: 0, apis: 0, databaseTables: 0, externalIntegrations: 0, testFiles: 0, configFiles: 1, docFiles: 0, avgFileSize: 5 },
              insights: [{ type: "strength", title: "Simple Structure", description: "Small repository with clear utility functions." }],
              summary: "Simple TypeScript utility repository.",
              criticalDependencies: 0,
              circularDependencies: 0,
              healthScore: 90,
              criticalModulesCount: 0,
              highRiskAreasCount: 0,
              couplingScore: "Low",
              scalabilityScore: "Low",
              technicalDebtScore: "Low",
              confidence: "High"
            },
            dependencies: {
              graph: {
                nodes: [
                  { id: "1", label: "index.ts", type: "file" },
                  { id: "2", label: "utils.ts", type: "file" }
                ],
                edges: [
                  { source: "1", target: "2", relation: "imports" }
                ]
              },
              hotspots: [
                { module: "utils.ts", referencedBy: 1 }
              ],
              circularDependencies: [],
              externalDependencies: [],
              summary: {
                filesWithImports: 1,
                totalImportStatements: 1,
                uniqueExternalDependencies: 0
              }
            },
            dataFlow: {
              routes: [],
              flow: ["index.ts invokes utils.ts add function"],
              sequenceDiagram: `sequenceDiagram\n  participant Index as index.ts\n  participant Utils as utils.ts\n  Index->>+Utils: add(a, b)\n  Utils-->>-Index: result`,
              flowDiagram: `flowchart LR\n  Index[index.ts] --> Utils[utils.ts]`,
              architectureDiagram: `graph TD\n  Index[index.ts] --> Utils[utils.ts]`
            },
            documentation: {
              overview: `# Repository Overview\n\n**${repoName}**\n\n## Technology Stack\n- **Language:** ${repo.language}\n- **Framework:** ${repo.framework || "Unknown"}\n- **Total Files:** ${repo.totalFiles}\n- **Total Lines:** ${repo.totalLines.toLocaleString()}\n\n## Repository Statistics\n\n| Metric | Value |\n|--------|-------|\n| Total Files | ${repo.totalFiles} |\n| Total Lines | ${repo.totalLines.toLocaleString()} |\n| Language | ${repo.language} |\n| Status | ${repo.status} |`,
              architecture: `# Architecture Documentation\n\n## Architecture Pattern\n**Layered** — Default pattern\n\n## Modules\n- **src** (2 files)\n\n## Entry Points\n- \`src/index.ts\`\n\n## Architecture Diagram\n\n\`\`\`mermaid\ngraph TD\n  Entry[src/index.ts] --> Utils[src/utils.ts]\n\`\`\``,
              api: `# API Documentation\n\n## API Routes\n- No HTTP API routes detected\n\n## Notes\n- This is a utility library, not a web server\n- Functions are exported for use by other modules`,
              services: `# Service Documentation\n\n## Services\n- **Main Module** — \`src/index.ts\`: Application entry point\n- **Utilities** — \`src/utils.ts\`: Utility functions\n\n## Dependencies\n- \`index.ts\` imports from \`utils.ts\``,
              database: `# Database Documentation\n\n- No database connection configured\n- This is a utility/library repository without persistent storage`,
              dependencies: `# Dependency Documentation\n\n## Internal Dependencies\n- **index.ts** → **utils.ts** (imports)\n\n## External Dependencies\n- No external dependencies detected\n\n## Dependency Graph\n\n\`\`\`mermaid\ngraph LR\n  index_ts[index.ts] --> utils_ts[utils.ts]\n\`\`\``,
              dataflow: `# Data Flow Documentation\n\n## Flow Diagram\n\n\`\`\`mermaid\nflowchart LR\n  Index[index.ts] --> Utils[utils.ts]\n\`\`\`\n\n## Data Flow\n- \`index.ts\` invokes utility functions from \`utils.ts\`\n- No external data flow detected`,
              setup: `# Setup Documentation\n\n## Prerequisites\n- **${repo.language}** runtime\n- Node.js / appropriate package manager\n\n## Installation\n\n\`\`\`bash\ngit clone <repository-url>\ncd ${repoName}\nnpm install\n\`\`\`\n\n## Running\n\n\`\`\`bash\nnpm start\n\`\`\``,
              deployment: `# Deployment Documentation\n\n- No deployment configuration detected\n- Standard deployment via cloning and running the application`,
              ai_guide: `# AI Repository Guide\n\n## Summary\n**${repoName}** is a ${repo.language} repository with ${repo.totalFiles} files.\n\n## How to Get Started\n1. Clone the repository\n2. Install dependencies\n3. Run the application\n\n## Key Components\n- \`src/index.ts\` — Entry point\n- \`src/utils.ts\` — Utility functions\n\n## Architecture\nSimple utility repository with basic module structure.`
            },
            security: [],
            quality: []
          }
          onboardingPlans[repoId] = {
            days: [
              {
                day: 1,
                title: "Getting started",
                goals: ["Explore the project files"],
                activities: [
                  { description: "Code review", items: ["Open src/index.ts and inspect entry points."] }
                ],
                tasks: [
                  { id: "t1", label: "Read index.ts", status: "not_started" }
                ],
                files: ["src/index.ts"],
                flows: ["Main execution flow"]
              }
            ]
          }
          saveCache()
    }

    return NextResponse.json(newRepo)
  } catch (error) {
    return NextResponse.json({ error: "Failed to upload repository file" }, { status: 500 })
  }
}
