export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Repositories", href: "/repositories", icon: "FolderGit2" },
  { label: "Architecture", href: "/architecture", icon: "Building2" },
  { label: "Data Flow", href: "/data-flow", icon: "Activity" },
  { label: "Documentation", href: "/docs", icon: "BookOpen" },
  { label: "AI Chat", href: "/chat", icon: "MessageSquare" },
  { label: "Onboarding", href: "/onboarding", icon: "GraduationCap" },
  { label: "Settings", href: "/settings", icon: "Settings" },
]

export const ANALYSIS_STAGES = [
  "queued",
  "cloning",
  "scanning",
  "parsing",
  "embedding",
  "graph_building",
  "complete",
] as const


