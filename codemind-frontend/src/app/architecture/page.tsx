"use client"

import { useCallback, useRef, useState, useMemo, useEffect } from "react"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { repositoryService } from "@/services/api"
import { useParams } from "next/navigation"
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react"
import dagre from "dagre"
import {
  Download,
  Maximize2,
  Layers,
  GitBranch,
  AlertTriangle,
  Shield,
  BarChart3,
  Lightbulb,
  FileCode,
  Database,
  Globe,
  Box,
  Search,
  X,
  CheckCircle2,
  ExternalLink,
  Play,
  Map,
  Activity,
  BookOpen,
  TrendingUp,
} from "lucide-react"
import { toPng } from "html-to-image"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import type { ArchitectureAnalysis, ArchitectureNode, ArchitectureEdge, ModuleDetail } from "@/types"
import { useRepositoryStore } from "@/store/repository-store"
import { ModuleDrawer } from "@/components/module-drawer"

const NODE_COLORS: Record<string, string> = {
  frontend: "#3B82F6",
  api: "#22C55E",
  service: "#06B6D4",
  repository: "#F59E0B",
  model: "#EC4899",
  database: "#F97316",
  external: "#84CC16",
  entry: "#EF4444",
  framework: "#6366F1",
  layer: "#8B5CF6",
  module: "#8B5CF6",
  controller: "#22C55E",
  other: "#64748B",
}

const EDGE_COLORS: Record<string, string> = {
  CALLS: "#6366F1",
  USES: "#22C55E",
  IMPORTS: "#3B82F6",
  DEPENDS_ON: "#F59E0B",
  READS: "#06B6D4",
  WRITES: "#EF4444",
  PART_OF: "#64748B",
}

const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "bg-green-500/10 text-green-400 border-green-500/20",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  High: "bg-red-500/10 text-red-400 border-red-500/20",
  Critical: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 145;

const LAYER_ORDER = [
  "entry",
  "frontend",
  "controller",
  "api",
  "service",
  "model",
  "repository",
  "database",
  "external",
  "framework",
  "module",
  "layer",
  "other"
];

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "LR", viewMode = "module") {
  if (viewMode !== "layer") {
    // Lay out nodes dynamically using Dagre based on connections/edges
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 })

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    })

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    return {
      nodes: nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        if (!nodeWithPosition) return node
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - NODE_WIDTH / 2,
            y: nodeWithPosition.y - NODE_HEIGHT / 2,
          },
        }
      }),
      edges,
    }
  }

  const isLayer = viewMode === "layer";

  // Custom grid-based layering layout to prevent overflow on repos with large numbers of modules
  const layerNodesMap = new globalThis.Map<string, Node[]>();
  nodes.forEach((node) => {
    if (node.type === "default") {
      const layer = (node.data?.layer || node.data?.type || "other") as string;
      if (!layerNodesMap.has(layer)) {
        layerNodesMap.set(layer, []);
      }
      layerNodesMap.get(layer)!.push(node);
    }
  });

  const activeLayers = Array.from(layerNodesMap.keys()).sort((a, b) => {
    let idxA = LAYER_ORDER.indexOf(a);
    let idxB = LAYER_ORDER.indexOf(b);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });

  const nodesep = 25;
  const ranksep = 60;
  const padding = 20;

  const layerLayouts = new globalThis.Map<string, {
    width: number;
    height: number;
    positions: globalThis.Map<string, { x: number; y: number }>;
  }>();

  activeLayers.forEach((layer) => {
    const layerNodes = layerNodesMap.get(layer)!;
    const N = layerNodes.length;
    
    // Compute number of columns for grid
    let numCols = 3;
    if (N <= 2) numCols = N;
    else if (N === 4) numCols = 2; // 2x2 grid looks better
    else if (N > 8) numCols = 4;   // 4 cols for very large groups

    const numRows = Math.ceil(N / numCols);
    const width = numCols * NODE_WIDTH + (numCols - 1) * nodesep + 2 * padding;
    const height = numRows * NODE_HEIGHT + (numRows - 1) * nodesep + 2 * padding + 25; // added extra header space

    const positions = new globalThis.Map<string, { x: number; y: number }>();
    layerNodes.forEach((node: Node, i: number) => {
      const r = Math.floor(i / numCols);
      const c = i % numCols;
      const x = padding + c * (NODE_WIDTH + nodesep);
      const y = padding + 20 + r * (NODE_HEIGHT + nodesep);
      positions.set(node.id, { x, y });
    });

    layerLayouts.set(layer, { width, height, positions });
  });

  const layerGroupPositions = new globalThis.Map<string, { x: number; y: number }>();
  if (direction === "TB") {
    // Stack layers vertically, centered horizontally
    const maxWidth = Math.max(...Array.from(layerLayouts.values()).map((l: any) => l.width), 0);
    let currentY = 0;
    activeLayers.forEach((layer) => {
      const layout = layerLayouts.get(layer)!;
      const x = (maxWidth - layout.width) / 2;
      layerGroupPositions.set(layer, { x, y: currentY });
      currentY += layout.height + ranksep;
    });
  } else {
    // Stack layers horizontally, centered vertically
    const maxHeight = Math.max(...Array.from(layerLayouts.values()).map((l: any) => l.height), 0);
    let currentX = 0;
    activeLayers.forEach((layer) => {
      const layout = layerLayouts.get(layer)!;
      const y = (maxHeight - layout.height) / 2;
      layerGroupPositions.set(layer, { x: currentX, y });
      currentX += layout.width + ranksep;
    });
  }

  const layoutedNodes: Node[] = [];
  
  // Add group container nodes ONLY in layer mode
  if (isLayer) {
    activeLayers.forEach((layer) => {
      const layout = layerLayouts.get(layer)!;
      const groupPos = layerGroupPositions.get(layer)!;
      layoutedNodes.push({
        id: `group-${layer}`,
        type: "group",
        position: groupPos,
        style: {
          width: layout.width,
          height: layout.height,
          backgroundColor: "rgba(30, 41, 59, 0.45)",
          border: "1px dashed rgba(100, 116, 139, 0.5)",
          borderRadius: 16,
          zIndex: -1,
        },
        data: { label: `${layer.toString().toUpperCase()} LAYER` },
      });
    });
  }

  // Add children relative to their groups (in layer mode) or absolutely (in other modes)
  nodes.forEach((node) => {
    const layer = (node.data?.layer || node.data?.type || "other") as string;
    const layout = layerLayouts.get(layer);
    if (layout) {
      const pos = layout.positions.get(node.id)!;
      if (isLayer) {
        layoutedNodes.push({
          ...node,
          position: pos,
          parentId: `group-${layer}`,
          extent: "parent",
        });
      } else {
        const groupPos = layerGroupPositions.get(layer)!;
        layoutedNodes.push({
          ...node,
          position: { x: groupPos.x + pos.x, y: groupPos.y + pos.y },
        });
      }
    } else {
      layoutedNodes.push(node);
    }
  });

  return { nodes: layoutedNodes, edges };
}

function ArchitectureNodeComponent({ data }: { data: {
  label: string; type: string; fileCount: number; complexity: string; color: string; opacity: number; boxShadow: string;
  dependencyCount?: number; riskLevel?: string; isEntryPoint?: boolean; description?: string;
  purpose?: string; importance?: string; healthScore?: number; layer?: string;
  direction?: "TB" | "LR";
} }) {
  const isCritical = data.importance === "Critical" || data.riskLevel === "Critical";
  const riskColor = data.riskLevel === "Critical" ? "#7C3AED" : data.riskLevel === "High" ? "#EF4444" : data.riskLevel === "Medium" ? "#F59E0B" : "#22C55E";
  const borderGlow = data.isEntryPoint ? `0 0 12px ${data.color}80` : data.boxShadow;
  
  const targetPos = data.direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = data.direction === "LR" ? Position.Right : Position.Bottom;
  
  return (
    <>
      <Handle type="target" position={targetPos} style={{ background: data.color, width: 8, height: 8, border: `2px solid #0F172A` }} />
      <div
        title={data.description || `${data.label} (${data.type})`}
        className="flex flex-col cursor-pointer transition-all"
        style={{
          background: "#1E293B",
          border: `1px solid ${data.color}`,
          borderTop: `4px solid ${data.color}`,
          borderRadius: 8, padding: 10,
          opacity: data.opacity, 
          boxShadow: isCritical ? `0 0 20px ${data.color}80` : borderGlow, 
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        }}
      >
        <div className="flex items-start justify-between mb-1.5">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate flex items-center gap-1">
              {data.label}
              {data.isEntryPoint && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} title="Entry Point" />}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider" style={{ borderColor: `${data.color}50`, color: data.color, backgroundColor: `${data.color}10`, border: '1px solid' }}>
                 {data.layer || data.type}
               </span>
               {data.importance && (
                 <span className={`text-[9px] font-semibold ${data.importance === 'Critical' ? 'text-red-400' : 'text-slate-400'}`}>
                   {data.importance}
                 </span>
               )}
            </div>
          </div>
        </div>

        <div className="flex-1 mt-0.5 mb-1 overflow-hidden">
           <p className="text-[11px] text-slate-400 leading-snug line-clamp-1" title={data.purpose || data.description}>
             {data.purpose || data.description || "No business purpose documented."}
           </p>
        </div>

        <div className="grid grid-cols-3 gap-1 mt-auto border-t border-slate-700/50 pt-1.5">
           <div className="flex flex-col">
             <span className="text-[8px] text-slate-500 uppercase tracking-wide">Health</span>
             <span className="text-[10px] font-semibold text-slate-200">{data.healthScore ?? '--'}%</span>
           </div>
           <div className="flex flex-col">
             <span className="text-[8px] text-slate-500 uppercase tracking-wide">Complex</span>
             <span className="text-[10px] font-semibold text-slate-200">{data.complexity}</span>
           </div>
           <div className="flex flex-col">
             <span className="text-[8px] text-slate-500 uppercase tracking-wide">Risk</span>
             <span className="text-[10px] font-semibold" style={{ color: riskColor }}>{data.riskLevel || 'Low'}</span>
           </div>
        </div>
        
        <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1.5">
           <span className="flex items-center gap-1"><FileCode className="w-3 h-3" /> {data.fileCount} files</span>
           {data.dependencyCount !== undefined && (
             <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {data.dependencyCount} deps</span>
           )}
        </div>
      </div>
      <Handle type="source" position={sourcePos} style={{ background: data.color, width: 8, height: 8, border: `2px solid #0F172A` }} />
    </>
  );
}

function insightIcon(type: string) {
  switch (type) {
    case "strength": return <CheckCircle2 className="w-4 h-4 text-green-400" />
    case "weakness": return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    case "risk": return <Shield className="w-4 h-4 text-red-400" />
    case "recommendation": return <Lightbulb className="w-4 h-4 text-blue-400" />
    default: return null
  }
}

function ArchitectureFlowInner() {
  const params = useParams()
  const { currentRepository } = useRepositoryStore()
  const repoId = (params.id as string) || currentRepository?.id

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance: ReactFlowInstance = useReactFlow()
  const [searchFilter, setSearchFilter] = useState("")
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [drawerModule, setDrawerModule] = useState<ModuleDetail | null>(null)
  const [activeInsightTab, setActiveInsightTab] = useState<string>("all")
  const [graphLoading, setGraphLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"layer" | "module" | "dependency" | "flow">("module")
  const [layoutDir, setLayoutDir] = useState<"TB" | "LR">("LR") // Default to LR (horizontal) for widescreen fit

  const { data: analysis, isLoading, isError } = useQuery({
    queryKey: ["architecture", repoId],
    queryFn: () => repositoryService.getAnalysis(repoId as string),
    enabled: !!repoId,
    retry: false,
  }) as { data: ArchitectureAnalysis | undefined; isLoading: boolean; isError: boolean }

  const { data: insightsData } = useQuery({
    queryKey: ["architecture-insights", repoId],
    queryFn: () => repositoryService.getArchitectureInsights(repoId as string),
    enabled: !!repoId && !!analysis,
    retry: false,
  })

  // Fallback graph: when analysis.nodes is empty, generate from modules/entryPoints/metrics
  const fallbackGraph = useMemo(() => {
    if (!analysis) return null
    if (analysis.nodes && analysis.nodes.length > 0) return null

    const fbNodes: ArchitectureNode[] = []
    const fbEdges: ArchitectureEdge[] = []

    if (analysis.modules && analysis.modules.length > 0) {
      analysis.modules.forEach((m, i) => {
        const nid = `fb-mod-${i}`
        fbNodes.push({
          id: nid, label: m.name, type: "module",
          fileCount: m.files, complexity: m.files > 10 ? "High" : m.files > 3 ? "Medium" : "Low",
          dependencyCount: 0, riskLevel: "Low", description: `${m.files} file(s)`,
        })
      })
    }

    if (analysis.entryPoints && analysis.entryPoints.length > 0) {
      analysis.entryPoints.forEach((ep, i) => {
        const nid = `fb-entry-${i}`
        fbNodes.push({
          id: nid, label: ep.split("/").pop() || ep, type: "entry",
          fileCount: 1, complexity: "Low", isEntryPoint: true,
          dependencyCount: 0, riskLevel: "Low", description: `Entry point: ${ep}`,
        })
      })
    }

    if (Object.keys(analysis.frameworks || {}).length > 0) {
      Object.keys(analysis.frameworks).forEach((fw, i) => {
        const nid = `fb-fw-${i}`
        fbNodes.push({
          id: nid, label: fw, type: "framework",
          fileCount: 0, complexity: "Low",
          dependencyCount: 0, riskLevel: "Low", description: `Framework: ${fw}`,
        })
      })
    }

    if (analysis.layers && analysis.layers.length > 0) {
      analysis.layers.forEach((l, i) => {
        const nid = `fb-layer-${i}`
        fbNodes.push({
          id: nid, label: l.name, type: "layer",
          fileCount: 0, complexity: "Low",
          dependencyCount: 0, riskLevel: "Low", description: l.description,
        })
        fbNodes.slice(0, -1).forEach((n) => {
          if (n.type === "module" || n.type === "entry") {
            fbEdges.push({ source: n.id, target: nid, relation: "PART_OF", weight: 1 })
          }
        })
      })
    }

    return { nodes: fbNodes, edges: fbEdges }
  }, [analysis])

  // Source data: use analysis.nodes or fallback
  const sourceNodes: ArchitectureNode[] = useMemo(() =>
    analysis?.nodes?.length ? analysis.nodes : (fallbackGraph?.nodes || []),
    [analysis?.nodes, fallbackGraph]
  )

  const sourceEdges: ArchitectureEdge[] = useMemo(() =>
    analysis?.edges?.length ? analysis.edges : (fallbackGraph?.edges || []),
    [analysis?.edges, fallbackGraph]
  )

  const nodeTypes = useMemo(() => ({ default: ArchitectureNodeComponent }), [])

  // Build React Flow nodes — data contains ONLY primitive values, no JSX
  const rfNodes = useMemo(() => {
    if (sourceNodes.length === 0) return []

    // Do NOT filter out any nodes in layer view mode anymore, so they render inside layer groups
    const rawNodes: Node[] = sourceNodes.map((n) => {
      const color = NODE_COLORS[n.type] || "#64748B"
      const isHighlighted = !selectedModule || selectedModule === n.id
      const matchesSearch = !searchFilter || n.label.toLowerCase().includes(searchFilter.toLowerCase())
      return {
        id: n.id,
        type: "default",
        position: { x: 0, y: 0 },
        data: {
          ...n,
          color,
          opacity: 1,
          boxShadow: selectedModule === n.id ? `0 0 20px ${color}40` : "none",
          direction: layoutDir,
        },
      }
    })

    return rawNodes;
  }, [sourceNodes, selectedModule, searchFilter, layoutDir])

  const rfEdges = useMemo(() => {
    if (sourceEdges.length === 0) return []
    const maxWeight = Math.max(...sourceEdges.map(e => e.weight || 1), 1)
    return sourceEdges.map((e, i) => {
      const weight = e.weight || 1
      const isSelected = selectedModule && (e.source === selectedModule || e.target === selectedModule)
      const strokeWidth = selectedModule
        ? (isSelected ? weight * 2 : weight * 0.5)
        : 1 + (weight / maxWeight) * 4
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: isSelected || viewMode === "dependency" ? e.relation : undefined,
        style: {
          stroke: EDGE_COLORS[e.relation] || "#475569",
          strokeWidth: Math.max(0.5, strokeWidth),
          opacity: isSelected ? 1 : selectedModule ? 0.1 : 0.4,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.relation] || "#475569" },
        animated: viewMode === "flow" || isSelected, // Enabled active flow/dependency line animations
        labelStyle: { fontSize: 10, fill: "#94A3B8", fontWeight: 'bold' },
        labelBgStyle: { fill: "#1E293B", stroke: "#334155", fillOpacity: 0.8 },
      }
    }) as Edge[]
  }, [sourceEdges, selectedModule, viewMode])

  // Apply dagre layout dynamically with layout direction and viewMode
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (rfNodes.length === 0) return { nodes: [], edges: [] }
    const result = getLayoutedElements(rfNodes, rfEdges, layoutDir, viewMode)
    return result
  }, [rfNodes, rfEdges, layoutDir, viewMode])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const prevNodeKey = useRef("")
  const prevEdgeKey = useRef("")
  const [layoutVersion, setLayoutVersion] = useState(0)

  // Sync layouted nodes — serialization guard prevents infinite loop from new-array-on-every-render
  useEffect(() => {
    const key = JSON.stringify(layoutedNodes.map(n => `${n.id}:${n.position.x}:${n.position.y}`))
    if (key !== prevNodeKey.current) {
      prevNodeKey.current = key
      setLayoutVersion(v => v + 1)
      setNodes(layoutedNodes)
    }
  }, [layoutedNodes, setNodes])

  useEffect(() => {
    const key = JSON.stringify(layoutedEdges.map(e => `${e.source}>${e.target}`))
    if (key !== prevEdgeKey.current) {
      prevEdgeKey.current = key
      setEdges(layoutedEdges)
    }
  }, [layoutedEdges, setEdges])

  // Fit view when layout version changes
  useEffect(() => {
    if (layoutedNodes.length > 0 && reactFlowInstance) {
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 200 })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [layoutVersion, reactFlowInstance])

  // Clear loading when we have nodes or analysis is complete
  useEffect(() => {
    if (layoutedNodes.length > 0 || (analysis && layoutedNodes.length === 0)) {
      setGraphLoading(false)
    }
  }, [layoutedNodes.length, analysis])

  const onExport = useCallback(async () => {
    if (!reactFlowWrapper.current) return
    try {
      const dataUrl = await toPng(reactFlowWrapper.current, { backgroundColor: "#0F172A", pixelRatio: 2 })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = "architecture.png"
      a.click()
    } catch (err) {
      console.error("Failed to export PNG:", err)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      reactFlowWrapper.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Metrics chart data — "Lines" excluded because its magnitude (often 1000s) dwarfs all other counts
  const metricsChartData = useMemo(() => {
    if (!analysis?.metrics) return []
    const m = analysis.metrics
    return [
      { name: "Files", value: m.totalFiles },
      { name: "Classes", value: m.totalClasses },
      { name: "Functions", value: m.totalFunctions },
      { name: "Services", value: m.services },
      { name: "Controllers", value: m.controllers },
      { name: "APIs", value: m.apis },
    ]
  }, [analysis?.metrics])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-20 mt-2" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2"><Skeleton className="h-[500px] w-full rounded-xl" /></div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Architecture</h1>
          <p className="text-slate-400 mt-1">Visualize your repository architecture</p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-100 mb-2">No Architecture Data</h2>
            <p className="text-slate-400">Upload a repository first to see its architecture visualization.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const insights = analysis?.insights || []
  const filteredInsights = activeInsightTab === "all" ? insights : insights.filter(i => i.type === activeInsightTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">AI Architecture Intelligence Engine</h1>
          <p className="text-slate-400 mt-1">{analysis?.summary || "Deep repository architecture intelligence and impact analysis"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-sm px-3 py-1">
            {analysis?.type || "Unknown"}
          </Badge>
          <Button variant="primary" size="sm" onClick={() => setActiveInsightTab('all')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <BookOpen className="w-4 h-4 mr-1.5" /> Explain Architecture
          </Button>
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" /> Export PNG
          </Button>
          <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Architecture Pattern", value: analysis?.type || "—", icon: Layers, color: "text-blue-400" },
          { label: "Architecture Health", value: `${analysis?.healthScore || 0}/100`, icon: Activity, color: "text-green-400" },
          { label: "Critical Modules", value: `${analysis?.criticalModulesCount || 0}`, icon: AlertTriangle, color: "text-red-400" },
          { label: "High Risk Areas", value: `${analysis?.highRiskAreasCount || 0}`, icon: Shield, color: "text-purple-400" },
          { label: "Coupling Score", value: analysis?.couplingScore || "Low", icon: GitBranch, color: "text-amber-400" },
          { label: "Scalability Score", value: analysis?.scalabilityScore || "Medium", icon: TrendingUp, color: "text-cyan-400" },
          { label: "Technical Debt", value: analysis?.technicalDebtScore || "Low", icon: Box, color: "text-orange-400" },
          { label: "Confidence", value: analysis?.confidence || "High", icon: CheckCircle2, color: "text-emerald-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content: Graph + AI Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Graph */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-700">
                  {(["layer", "module", "dependency", "flow"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode);
                        if (mode === "layer") {
                          setLayoutDir("TB");
                        } else {
                          setLayoutDir("LR");
                        }
                      }}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${
                        viewMode === mode
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setLayoutDir("TB")}
                    title="Vertical Layout (Top-to-Bottom)"
                    className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${
                      layoutDir === "TB"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    TB
                  </button>
                  <button
                    onClick={() => setLayoutDir("LR")}
                    title="Horizontal Layout (Left-to-Right)"
                    className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${
                      layoutDir === "LR"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    LR
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter nodes..."
                    className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.frontend }} />
                  <span>Frontend</span>
                  <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: NODE_COLORS.api }} />
                  <span>API</span>
                  <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: NODE_COLORS.service }} />
                  <span>Service</span>
                  <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: NODE_COLORS.repository }} />
                  <span>Repo</span>
                  <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: NODE_COLORS.database }} />
                  <span>DB</span>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  {analysis?.moduleDetails && Object.keys(analysis.moduleDetails).length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Map className="w-3 h-3" />
                      <span className="hidden md:inline">Journey:</span>
                      <button
                        onClick={() => {
                          const first = Object.values(analysis.moduleDetails!)[0]
                          if (first) setDrawerModule(drawerModule?.id === first.id ? null : first)
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >Explore</button>
                    </div>
                  )}
                  <button
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                    onClick={() => { setSelectedModule(null); setSearchFilter(""); setDrawerModule(null) }}
                    aria-label="Reset view"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            <div ref={reactFlowWrapper} style={{ height: 520, position: "relative" }}>
              {graphLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Loading Architecture Graph...</p>
                  </div>
                </div>
              )}
              {!graphLoading && nodes.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
                  <div className="text-center max-w-md">
                    <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-base font-semibold text-slate-100 mb-1">No Architecture Graph</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The architecture graph could not be generated.
                      <br />Possible causes: repository parsing incomplete, graph generation failed, or no architecture data available.
                    </p>
                  </div>
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  const detail = analysis?.moduleDetails?.[node.id]
                  if (detail) {
                    setDrawerModule(detail === drawerModule ? null : detail)
                  }
                  setSelectedModule(selectedModule === node.id ? null : node.id)
                }}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-left"
              >
                <Controls />
                <MiniMap style={{ backgroundColor: "#0F172A" }} nodeColor={() => "#1E293B"} />
                <Background color="#1E293B" gap={20} />
              </ReactFlow>
            </div>
          </Card>

          {/* Module List */}
          {sourceNodes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Box className="w-4 h-4 text-purple-400" /> Modules ({sourceNodes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {sourceNodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        const detail = analysis?.moduleDetails?.[n.id]
                        if (detail) {
                          setDrawerModule(detail === drawerModule ? null : detail)
                        } else {
                          setSelectedModule(selectedModule === n.id ? null : n.id)
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all text-xs ${
                        selectedModule === n.id
                          ? "bg-blue-600/10 border-blue-600/30"
                          : drawerModule?.id === n.id
                            ? "bg-purple-600/10 border-purple-600/30"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <p className="font-medium text-slate-100 truncate">{n.label}</p>
                      <p className="text-slate-500 mt-1">{n.type} · {n.fileCount} files</p>
                      {n.riskLevel && <p className="text-slate-500 mt-0.5">Risk: {n.riskLevel}</p>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel — AI Insights */}
        <div className="space-y-4">
          {/* AI Explanation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex gap-1 pb-2 border-b border-slate-800 overflow-x-auto">
                {["all", "strength", "weakness", "risk", "recommendation"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveInsightTab(tab)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap capitalize transition-all ${
                      activeInsightTab === tab
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "all" ? "All" : tab}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {filteredInsights.length > 0 ? filteredInsights.map((insight, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                    <div className="flex items-start gap-2">
                      {insightIcon(insight.type)}
                      <div>
                        <p className="text-xs font-medium text-slate-100">{insight.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500 py-4 text-center">No insights for this category.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Explanation from OpenRouter */}
          {insightsData?.summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" /> Architecture Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto">
                <div>
                  <p className="font-medium text-slate-100 mb-1">Architecture Pattern</p>
                  <p>{insightsData.architectureType}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-100 mb-1">Complexity</p>
                  <p>{insightsData.complexity}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-100 mb-1">Maintainability</p>
                  <p>{insightsData.maintainability}%</p>
                </div>
                {insightsData.strengths?.length > 0 && (
                  <div>
                    <p className="font-medium text-green-400 mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {insightsData.strengths.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /><span>{s}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {insightsData.weaknesses?.length > 0 && (
                  <div>
                    <p className="font-medium text-yellow-400 mb-1">Weaknesses</p>
                    <ul className="space-y-1">
                      {insightsData.weaknesses.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" /><span>{s}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {insightsData.recommendations?.length > 0 && (
                  <div>
                    <p className="font-medium text-blue-400 mb-1">Recommendations</p>
                    <ul className="space-y-1">
                      {insightsData.recommendations.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5"><Lightbulb className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" /><span>{s}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Entry Points */}
          {analysis?.entryPoints && analysis.entryPoints.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-red-400" /> Entry Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {analysis.entryPoints.map((ep, i) => (
                  <div key={i} className="px-3 py-2 rounded bg-slate-800/50 text-xs font-mono text-slate-300 truncate">
                    {ep}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Database & External APIs */}
          {((analysis?.databaseConnections?.length ?? 0) > 0 || (analysis?.externalAPIs?.length ?? 0) > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" /> Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {analysis?.databaseConnections && analysis.databaseConnections.length > 0 && (
                  <div>
                    <p className="text-slate-400 mb-1">Databases</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.databaseConnections.map((db, i) => (
                        <Badge key={i} variant="info">{db}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis?.externalAPIs && analysis.externalAPIs.length > 0 && (
                  <div>
                    <p className="text-slate-400 mb-1 mt-2">External APIs</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.externalAPIs.map((api, i) => (
                        <Badge key={i} variant="warning">{api}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      {analysis?.metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" /> Repository Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                    <BarChart data={metricsChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #334155", borderRadius: "8px", color: "#F8FAFC" }}
                      />
                      <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Test Files", value: analysis.metrics.testFiles, color: "text-green-400" },
                  { label: "Config Files", value: analysis.metrics.configFiles, color: "text-blue-400" },
                  { label: "Doc Files", value: analysis.metrics.docFiles, color: "text-purple-400" },
                  { label: "Avg File Size", value: `${analysis.metrics.avgFileSize} lines`, color: "text-orange-400" },
                  { label: "Frameworks", value: Object.keys(analysis.frameworks || {}).length, color: "text-cyan-400" },
                  { label: "DB Connections", value: analysis.metrics.databaseTables, color: "text-amber-400" },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-3">
                      <p className="text-lg font-bold text-slate-100">{stat.value}</p>
                      <p className="text-[10px] text-slate-400">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Frameworks */}
      {analysis?.frameworks && Object.keys(analysis.frameworks).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" /> Detected Frameworks & Technologies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.keys(analysis.frameworks).map((fw) => (
                <Badge key={fw} variant="info" className="text-xs px-3 py-1">{fw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Architecture Story Mode */}
      {analysis && sourceNodes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" /> Architecture Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 border border-slate-800">
              <p className="text-xs text-slate-300 leading-relaxed">
                This application follows a <strong className="text-blue-300">{analysis.type}</strong> architecture pattern.
                It consists of <strong className="text-blue-300">{sourceNodes.length} modules</strong> across{" "}
                <strong className="text-blue-300">{analysis.metrics.totalFiles} files</strong>.
                {analysis.type.includes("Layered") && (
                  <> Requests enter through <strong className="text-cyan-300">controllers</strong>,
                  which delegate business logic to <strong className="text-cyan-300">services</strong>.
                  Services access <strong className="text-cyan-300">repositories</strong> for data persistence.
                  {analysis.databaseConnections.length > 0 && (
                    <> The system uses <strong className="text-amber-300">{analysis.databaseConnections.join(", ")}</strong> for storage.</>
                  )}
                  </>
                )}
                {analysis.complexity.level === "Low" && " The codebase is well-organized with manageable complexity."}
                {analysis.complexity.level === "Medium" && " The codebase has moderate complexity."}
                {analysis.complexity.level === "High" && " The codebase has high complexity — consider modularization."}
                {analysis.entryPoints.length > 0 && (
                  <> Key entry points: <strong className="text-red-300">{analysis.entryPoints.slice(0, 3).join(", ")}</strong>
                  {analysis.entryPoints.length > 3 && ` and ${analysis.entryPoints.length - 3} more.`}
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Drawer */}
      {drawerModule && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setDrawerModule(null)}
          />
          <ModuleDrawer moduleData={drawerModule} onClose={() => setDrawerModule(null)} />
        </>
      )}
    </div>
  )
}

function ArchitectureFlow() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlowInner />
    </ReactFlowProvider>
  )
}

export default function ArchitecturePage() {
  return (
    <AppLayout>
      <ArchitectureFlow />
    </AppLayout>
  )
}