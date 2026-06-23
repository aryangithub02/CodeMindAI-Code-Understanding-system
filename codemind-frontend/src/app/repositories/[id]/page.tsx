"use client"

import { useState, useMemo, useRef, useCallback, memo, Suspense } from "react"
import dynamic from "next/dynamic"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileCode, Folder, ChevronRight, Search, Info, GitBranch, Layers, FunctionSquare, Code, BookOpen } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { repositoryService } from "@/services/api"
import { CodeViewer } from "@/components/code-viewer"
import { ErrorBoundary } from "@/components/error-boundary"
import type { Repository, RepositoryTreeNode } from "@/types"

const ReactFlow = dynamic(() => import("@xyflow/react").then(m => m.ReactFlow), { ssr: false })
const ReactFlowProvider = dynamic(() => import("@xyflow/react").then(m => m.ReactFlowProvider), { ssr: false })

const flattenTree = (nodes: RepositoryTreeNode[]): { node: RepositoryTreeNode; depth: number }[] => {
  const result: { node: RepositoryTreeNode; depth: number }[] = []
  const traverse = (items: RepositoryTreeNode[], depth: number) => {
    for (const item of items) {
      result.push({ node: item, depth })
      if (item.children && item.children.length > 0) {
        traverse(item.children, depth + 1)
      }
    }
  }
  traverse(nodes, 0)
  return result
}

const FileTreeNode = memo(function FileTreeNode({ node, depth, onSelect, isExpanded, onToggle, style }: { node: RepositoryTreeNode; depth: number; onSelect?: (path: string) => void; isExpanded: boolean; onToggle: () => void; style?: React.CSSProperties }) {
  return (
    <div style={style} role="treeitem" aria-expanded={node.type === "directory" ? isExpanded : undefined} aria-label={`${node.type}: ${node.name}`}>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
          "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.type === "directory") onToggle()
          else onSelect?.(node.path)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (node.type === "directory") onToggle()
            else onSelect?.(node.path)
          }
        }}
        tabIndex={0}
        role="button"
      >
        {node.type === "directory" ? (
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-90")} aria-hidden="true" />
        ) : (
          <span className="w-3.5" />
        )}
        {node.type === "directory" ? (
          <Folder className="w-4 h-4 text-blue-400" aria-hidden="true" />
        ) : (
          <FileCode className="w-4 h-4 text-slate-500" aria-hidden="true" />
        )}
        <span>{node.name}</span>
      </div>
    </div>
  )
})


export default function RepositoryExplorerPage() {
  const params = useParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const { data: repo, isError: repoError } = useQuery<Repository>({
    queryKey: ["repository", params.id],
    queryFn: () => repositoryService.getById(params.id as string),
    retry: false,
  })

  const { data: tree = [], isLoading: treeLoading } = useQuery({
    queryKey: ["file-tree", params.id],
    queryFn: () => repositoryService.getFileTree(params.id as string),
    enabled: !!params.id && !!repo,
  })

  const { data: analysis } = useQuery({
    queryKey: ["analysis", params.id],
    queryFn: () => repositoryService.getAnalysis(params.id as string),
    enabled: !!params.id && !!repo,
  })

  const { data: fileContent } = useQuery({
    queryKey: ["file-content", params.id, selectedFile],
    queryFn: () => repositoryService.getFileContent(params.id as string, selectedFile!),
    enabled: !!params.id && !!selectedFile && !repoError,
  })

  const selectedCode = fileContent || "// Select a file to view its contents"
  const selectedFilename = selectedFile?.split("/").pop() || "main.ts"

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim() || !tree) return tree || []
    const q = searchQuery.toLowerCase()
    const filter = (nodes: RepositoryTreeNode[]): RepositoryTreeNode[] => {
      return nodes.reduce<RepositoryTreeNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(q)
        const filteredChildren = node.children ? filter(node.children) : []
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children })
        }
        return acc
      }, [])
    }
    return filter(tree)
  }, [tree, searchQuery])

  const flatTree = useMemo(() => flattenTree(filteredTree), [filteredTree])
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  })

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  if (repoError) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-100">Repository not found</h2>
          <p className="text-slate-400 mt-2">This repository may have been removed or the server was restarted.</p>
          <button
            onClick={() => router.push("/repositories")}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
          >
            Back to Repositories
          </button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="max-w-7xl mx-auto space-y-6">
      <Suspense fallback={<div className="h-8 w-48 animate-pulse rounded bg-slate-800" />}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{repo?.name || params.id}</h1>
            <p className="text-sm text-slate-400">Repository Explorer</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={repo?.status === "complete" ? "success" : repo?.status === "error" ? "danger" : "info"}>
              {repo?.status?.replace("_", " ") || "Loading..."}
            </Badge>
            {repo?.language && <Badge>{repo.language}</Badge>}
          </div>
        </div>
      </Suspense>

        <div className="grid grid-cols-[280px_1fr_280px] gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            </CardHeader>
            <CardContent className="p-1">
              {treeLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div ref={parentRef} className="h-[500px] overflow-auto">
                  <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const { node, depth } = flatTree[virtualItem.index]
                      const isExpanded = expandedPaths.has(node.path)
                      return (
                        <div
                          key={node.path}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                        >
                          <FileTreeNode
                            node={node}
                            depth={depth}
                            onSelect={setSelectedFile}
                            isExpanded={isExpanded}
                            onToggle={() => toggleExpand(node.path)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{selectedFilename}</CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="info">Service</Badge>
                <Badge>12 KB</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CodeViewer code={selectedCode} language="typescript" filename={selectedFilename} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" /> Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Language</span>
                  <span>{repo?.language || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><Layers className="w-3 h-3" aria-hidden="true" /> Classes</span>
                  <span>{repo?.totalClasses?.toLocaleString() || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><FunctionSquare className="w-3 h-3" aria-hidden="true" /> Functions</span>
                  <span>{repo?.totalFunctions?.toLocaleString() || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><Code className="w-3 h-3" aria-hidden="true" /> Lines</span>
                  <span>{repo?.totalLines?.toLocaleString() || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Files</span>
                  <span>{repo?.totalFiles?.toLocaleString() || "—"}</span>
                </div>
              </CardContent>
            </Card>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => router.push(`/docs/${params.id}`)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              View Documentation
            </Button>

          </div>
        </div>
      </div>
      </ErrorBoundary>
    </AppLayout>
  )
}
