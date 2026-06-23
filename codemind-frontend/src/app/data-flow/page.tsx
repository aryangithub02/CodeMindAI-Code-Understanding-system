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
  Activity,
  ArrowRight,
  Database,
  Globe,
  Shield,
  AlertTriangle,
  Lightbulb,
  Search,
  X,
  Layers,
  Bot,
  BookOpen,
  Maximize2,
  Download,
} from "lucide-react"
import { toPng } from "html-to-image"
import { useRepositoryStore } from "@/store/repository-store"
import type { DataFlowNode, DataFlowEdge, DataFlowJourney, FlowMetrics, FlowBottleneck } from "@/types"

const NODE_COLORS: Record<string, string> = {
  user: "#3B82F6",
  frontend: "#6366F1",
  controller: "#8B5CF6",
  service: "#22C55E",
  repository: "#F59E0B",
  database: "#EF4444",
  external: "#06B6D4",
  queue: "#EC4899",
  event: "#F97316",
  gateway: "#14B8A6",
  cache: "#22D3EE",
  transformer: "#A78BFA",
}

const EDGE_COLORS: Record<string, string> = {
  REQUESTS: "#3B82F6",
  FORWARDS: "#6366F1",
  CALLS: "#22C55E",
  QUERIES: "#F59E0B",
  READS_WRITES: "#EF4444",
  READS: "#06B6D4",
  WRITES: "#F97316",
  CALLS_API: "#14B8A6",
  TRIGGERS: "#EC4899",
  PUBLISHES: "#8B5CF6",
  SUBSCRIBES: "#A78BFA",
  RESPONDS: "#64748B",
}

const NODE_WIDTH = 170;
const NODE_HEIGHT = 80;

const FLOW_LAYER_ORDER = [
  "user",
  "frontend",
  "gateway",
  "controller",
  "service",
  "cache",
  "transformer",
  "queue",
  "event",
  "repository",
  "database",
  "external",
  "other"
];

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "LR") {
  // Custom grid-based layering layout to prevent overflow in the data flow section
  const layerNodesMap = new globalThis.Map<string, Node[]>();
  nodes.forEach((node) => {
    if (node.type === "default") {
      const type = (node.data?.type || "other") as string;
      if (!layerNodesMap.has(type)) {
        layerNodesMap.set(type, []);
      }
      layerNodesMap.get(type)!.push(node);
    }
  });

  const activeLayers = Array.from(layerNodesMap.keys()).sort((a, b) => {
    let idxA = FLOW_LAYER_ORDER.indexOf(a);
    let idxB = FLOW_LAYER_ORDER.indexOf(b);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });

  const nodesep = 20;
  const ranksep = 55;
  const padding = 15;

  const layerLayouts = new globalThis.Map<string, {
    width: number;
    height: number;
    positions: globalThis.Map<string, { x: number; y: number }>;
  }>();

  activeLayers.forEach((layer) => {
    const layerNodes = layerNodesMap.get(layer)!;
    const N = layerNodes.length;
    
    // Compute number of columns for grid
    let numCols = 2; // For smaller nodes, 2 cols is very compact and clean
    if (N <= 1) numCols = N;
    else if (N > 6) numCols = 3; // 3 columns if group is very large

    const numRows = Math.ceil(N / numCols);
    const width = numCols * NODE_WIDTH + (numCols - 1) * nodesep + 2 * padding;
    const height = numRows * NODE_HEIGHT + (numRows - 1) * nodesep + 2 * padding;

    const positions = new globalThis.Map<string, { x: number; y: number }>();
    layerNodes.forEach((node: Node, i: number) => {
      const r = Math.floor(i / numCols);
      const c = i % numCols;
      const x = padding + c * (NODE_WIDTH + nodesep);
      const y = padding + r * (NODE_HEIGHT + nodesep);
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
  nodes.forEach((node) => {
    const type = (node.data?.type || "other") as string;
    const layout = layerLayouts.get(type);
    if (layout) {
      const pos = layout.positions.get(node.id)!;
      const groupPos = layerGroupPositions.get(type)!;
      layoutedNodes.push({
        ...node,
        position: { x: groupPos.x + pos.x, y: groupPos.y + pos.y },
      });
    } else {
      layoutedNodes.push(node);
    }
  });

  return { nodes: layoutedNodes, edges };
}

function FlowNodeComponent({ data }: { data: {
  label: string; type: string; requestCount: number; riskLevel: string; color: string; opacity: number;
  isHighlighted: boolean; description?: string; direction?: "TB" | "LR";
} }) {
  const riskColor = data.riskLevel === "Critical" ? "#7C3AED" : data.riskLevel === "High" ? "#EF4444" : data.riskLevel === "Medium" ? "#F59E0B" : "#22C55E";
  const targetPos = data.direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = data.direction === "LR" ? Position.Right : Position.Bottom;
  
  return (
    <>
      <Handle type="target" position={targetPos} style={{ background: data.color, width: 8, height: 8, border: `2px solid #0F172A` }} />
      <div
        title={data.description || `${data.label} (${data.type})`}
        className="flex flex-col gap-1 min-w-[140px] cursor-pointer"
        style={{
          background: "#1E293B",
          border: `1px solid ${data.color}`,
          borderTop: `3px solid ${data.color}`,
          borderRadius: 10, padding: 12,
          opacity: data.isHighlighted ? 1 : 0.2,
          boxShadow: data.isHighlighted ? `0 0 15px ${data.color}30` : "none",
          width: NODE_WIDTH,
        }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-slate-100 truncate">{data.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0" style={{ borderColor: data.color, color: data.color, backgroundColor: `${data.color}15` }}>{data.type}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Activity className="w-3 h-3 shrink-0" />{data.requestCount} req</span>
        </div>
        <div className="text-[10px] px-1.5 py-0.5 rounded-full border w-fit" style={{ borderColor: riskColor, color: riskColor, backgroundColor: `${riskColor}15` }}>
          {data.riskLevel} Risk
        </div>
      </div>
      <Handle type="source" position={sourcePos} style={{ background: data.color, width: 8, height: 8, border: `2px solid #0F172A` }} />
    </>
  );
}

function DataFlowInner() {
  const params = useParams()
  const { currentRepository } = useRepositoryStore()
  const repoId = (params.id as string) || currentRepository?.id

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance: ReactFlowInstance = useReactFlow()
  const [searchFilter, setSearchFilter] = useState("")
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [activeJourney, setActiveJourney] = useState<string | null>(null)
  const [graphLoading, setGraphLoading] = useState(true)
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [layoutDir, setLayoutDir] = useState<"TB" | "LR">("LR")
  const [showFlowDetails, setShowFlowDetails] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState("overview")
  const [isComparing, setIsComparing] = useState(false)
  const [compareFlowA, setCompareFlowA] = useState<string | null>(null)
  const [compareFlowB, setCompareFlowB] = useState<string | null>(null)
  const [aiExplanationStyle, setAiExplanationStyle] = useState<"detailed" | "business" | "technical" | "beginner">("detailed")
  const [hoveredEdge, setHoveredEdge] = useState<any | null>(null)

  const { data: dataFlow, isLoading, isError } = useQuery({
    queryKey: ["dataflow", repoId],
    queryFn: () => repositoryService.getDataFlow(repoId as string),
    enabled: !!repoId,
    retry: false,
  })

  const { data: analysisData } = useQuery({
    queryKey: ["dataflow-analysis", repoId],
    queryFn: () => repositoryService.getDataFlowAnalysis(repoId as string),
    enabled: !!repoId && !!dataFlow,
    retry: false,
  })

  const nodeTypes = useMemo(() => ({ default: FlowNodeComponent }), [])

  // Source data
  const sourceNodes: DataFlowNode[] = useMemo(() =>
    (dataFlow as any)?.nodes || [], [(dataFlow as any)?.nodes]
  )
  const sourceEdges: DataFlowEdge[] = useMemo(() =>
    (dataFlow as any)?.edges || [], [(dataFlow as any)?.edges]
  )
  const journeys: DataFlowJourney[] = useMemo(() =>
    (dataFlow as any)?.flows || [], [(dataFlow as any)?.flows]
  )
  const metrics: FlowMetrics | undefined = useMemo(() =>
    (dataFlow as any)?.metrics, [(dataFlow as any)?.metrics]
  )
  const bottlenecks: FlowBottleneck[] = useMemo(() =>
    (dataFlow as any)?.bottlenecks || [], [(dataFlow as any)?.bottlenecks]
  )

  // Build React Flow nodes
  const rfNodes = useMemo(() => {
    if (sourceNodes.length === 0) return []

    const activeJourneyNodeIds = activeJourney
      ? new Set(journeys.find(j => j.id === activeJourney)?.nodeIds || [])
      : null

    let filtered = sourceNodes
    if (activeJourneyNodeIds) {
      filtered = sourceNodes.filter(n => activeJourneyNodeIds.has(n.id))
    }

    return filtered.map((n) => {
      const color = NODE_COLORS[n.type] || "#64748B"
      const matchesSearch = !searchFilter || n.label.toLowerCase().includes(searchFilter.toLowerCase())
      const isSelected = selectedNode === n.id
      return {
        id: n.id,
        type: "default",
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          type: n.type,
          requestCount: n.requestCount,
          riskLevel: n.riskLevel,
          description: n.description,
          color,
          opacity: matchesSearch ? 1 : 0.15,
          isHighlighted: matchesSearch && (isSelected || !selectedNode),
          direction: layoutDir,
        },
      }
    })
  }, [sourceNodes, selectedNode, searchFilter, activeJourney, journeys, layoutDir])

  const rfEdges = useMemo(() => {
    if (sourceEdges.length === 0) return []

    const activeJourneyEdgeIds = activeJourney
      ? new Set(journeys.find(j => j.id === activeJourney)?.edgeIds || [])
      : null

    let filtered = sourceEdges
    if (activeJourneyEdgeIds) {
      filtered = sourceEdges.filter(e => activeJourneyEdgeIds.has(`${e.source}->${e.target}`))
    }

    return filtered.map((e, i) => {
      const relatesToSelected = !selectedNode || e.source === selectedNode || e.target === selectedNode
      const color = EDGE_COLORS[e.relation] || "#475569"
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.relation,
        style: {
          stroke: color,
          strokeWidth: relatesToSelected ? 3 : 0.5,
          opacity: relatesToSelected ? 1 : 0.1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        animated: e.isAnimated && (relatesToSelected || !selectedNode),
        labelStyle: { fontSize: 9, fill: "#64748B" },
        data: {
          relation: e.relation,
          frequency: e.frequency || e.volume || 12,
          riskLevel: e.riskLevel || "Low",
          sourceLabel: sourceNodes.find(n => n.id === e.source)?.label || e.source,
          targetLabel: sourceNodes.find(n => n.id === e.target)?.label || e.target,
        }
      }
    }) as Edge[]
  }, [sourceEdges, selectedNode, activeJourney, journeys, sourceNodes])

  // Apply dagre layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (rfNodes.length === 0) return { nodes: [], edges: [] }
    const result = getLayoutedElements(rfNodes, rfEdges, layoutDir)
    return result;
  }, [rfNodes, rfEdges, layoutDir])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const prevNodeKey = useRef("")
  const prevEdgeKey = useRef("")
  const [layoutVersion, setLayoutVersion] = useState(0)

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

  useEffect(() => {
    if (layoutedNodes.length > 0 && reactFlowInstance) {
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 200 })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [layoutVersion, reactFlowInstance])

  useEffect(() => {
    if (layoutedNodes.length > 0 || (dataFlow && layoutedNodes.length === 0)) {
      setGraphLoading(false)
    }
  }, [layoutedNodes.length, dataFlow])

  const onExport = useCallback(async () => {
    if (!reactFlowWrapper.current) return
    try {
      const dataUrl = await toPng(reactFlowWrapper.current, { backgroundColor: "#0F172A", pixelRatio: 2 })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = "dataflow.png"
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

  const selectedNodeData = useMemo(() => {
    if (!showDetails) return null
    return sourceNodes.find(n => n.id === showDetails) || null
  }, [showDetails, sourceNodes])

  const selectedNodeEdges = useMemo(() => {
    if (!showDetails) return { incoming: [], outgoing: [] }
    return {
      incoming: sourceEdges.filter(e => e.target === showDetails),
      outgoing: sourceEdges.filter(e => e.source === showDetails),
    }
  }, [showDetails, sourceEdges])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-20 mt-2" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-[450px] w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Data Flow</h1>
          <p className="text-slate-400 mt-1">Visualize how data moves through your system</p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-100 mb-2">No Data Flow Data</h2>
            <p className="text-slate-400">Upload a repository first to see its data flow visualization.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Data Flow</h1>
          <p className="text-slate-400 mt-1">Visualize how data moves through your system</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-sm px-3 py-1">
            {metrics?.riskScore || "Unknown"} Risk
          </Badge>
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" /> Export PNG
          </Button>
          <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Flows", value: `${metrics?.totalFlows || 0}`, icon: Layers, color: "text-blue-400" },
          { label: "Request Flows", value: `${metrics?.requestFlows || 0}`, icon: Activity, color: "text-purple-400" },
          { label: "Database Flows", value: `${metrics?.databaseFlows || 0}`, icon: Database, color: "text-orange-400" },
          { label: "External APIs", value: `${metrics?.externalAPIs || 0}`, icon: Globe, color: "text-cyan-400" },
          { label: "Bottlenecks", value: `${metrics?.bottlenecks || 0}`, icon: AlertTriangle, color: "text-red-400" },
          { label: "Risk Score", value: metrics?.riskScore || "—", icon: Shield, color: metrics?.riskScore === "Critical" ? "text-red-400" : metrics?.riskScore === "High" ? "text-orange-400" : "text-green-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Layout: Graph + Side Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Graph Area */}
        <div className="xl:col-span-3 space-y-4">
          {/* Journey Mode + Filters */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search nodes..."
                    className="w-44 pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setLayoutDir("TB")}
                    title="Vertical Layout"
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
                    title="Horizontal Layout"
                    className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${
                      layoutDir === "LR"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    LR
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {journeys.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => setActiveJourney(activeJourney === j.id ? null : j.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        activeJourney === j.id
                          ? "text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      style={{
                        backgroundColor: activeJourney === j.id ? `${j.color}20` : "transparent",
                        border: `1px solid ${activeJourney === j.id ? j.color : "transparent"}`,
                        color: activeJourney === j.id ? j.color : undefined,
                      }}
                    >
                      {j.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                onClick={() => { setSelectedNode(null); setSearchFilter(""); setActiveJourney(null) }}
                aria-label="Reset view"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={reactFlowWrapper} style={{ height: 450, position: "relative" }}>
              {graphLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Loading Data Flow Graph...</p>
                  </div>
                </div>
              )}
              {!graphLoading && nodes.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
                  <div className="text-center max-w-md">
                    <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-base font-semibold text-slate-100 mb-1">No Data Flow Graph</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      No data flow graph could be generated for this repository.
                    </p>
                    <div className="mt-4 text-xs text-slate-500 space-y-1">
                      <p>Possible reasons:</p>
                      <ul className="list-disc list-inside">
                        <li>Analysis still pending</li>
                        <li>Flow extraction failed</li>
                        <li>Repository not supported</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  setSelectedNode(selectedNode === node.id ? null : node.id)
                  setShowDetails(showDetails === node.id ? null : node.id)
                }}
                onEdgeMouseEnter={(_, edge) => {
                  setHoveredEdge(edge)
                }}
                onEdgeMouseLeave={() => {
                  setHoveredEdge(null)
                }}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-left"
              >
                <Controls />
                <MiniMap style={{ backgroundColor: "#0F172A" }} nodeColor={() => "#1E293B"} />
                <Background color="#1E293B" gap={20} />
              </ReactFlow>
              {hoveredEdge && hoveredEdge.data && (
                <div 
                  className="absolute z-30 p-3 rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur shadow-lg text-[11px] pointer-events-none"
                  style={{
                    left: 20,
                    top: 20,
                    maxWidth: 240,
                  }}
                >
                  <div className="font-semibold text-slate-100 flex items-center gap-1 mb-1">
                    <span>{hoveredEdge.data.sourceLabel}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span>{hoveredEdge.data.targetLabel}</span>
                  </div>
                  <div className="space-y-1 text-slate-400">
                    <p><span className="text-slate-500">Type:</span> <span className="text-blue-400 font-semibold">{hoveredEdge.data.relation}</span></p>
                    <p><span className="text-slate-500">Frequency:</span> <span className="text-slate-200 font-mono">{hoveredEdge.data.frequency} calls</span></p>
                    <p><span className="text-slate-500">Risk:</span> <span className={`font-semibold ${
                      hoveredEdge.data.riskLevel === "Critical" ? "text-purple-400" :
                      hoveredEdge.data.riskLevel === "High" ? "text-red-400" :
                      hoveredEdge.data.riskLevel === "Medium" ? "text-orange-400" :
                      "text-green-400"
                    }`}>{hoveredEdge.data.riskLevel}</span></p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                  <span key={type} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-slate-400 capitalize">{type}</span>
                  </span>
                ))}
                <span className="text-slate-600 mx-1">|</span>
                {Object.entries(EDGE_COLORS).slice(0, 5).map(([rel, color]) => (
                  <span key={rel} className="flex items-center gap-1">
                    <span className="w-4 h-px" style={{ backgroundColor: color }} />
                    <span className="text-slate-400 text-[10px]">{rel}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Bottlenecks */}
          {bottlenecks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Bottlenecks ({bottlenecks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[250px] overflow-y-auto">
                {bottlenecks.map((b, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-800/30 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
                    onClick={() => { setSelectedNode(b.nodeId); setShowDetails(b.nodeId) }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-100">{b.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        b.severity === "Critical" ? "border-red-500 text-red-400" : "border-yellow-500 text-yellow-400"
                      }`}>{b.severity}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Used by {b.usedByCount} flows</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 italic">{b.suggestion}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Analysis */}
          {analysisData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-400" /> AI Flow Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
                <div className="p-2 rounded-lg bg-slate-800/20">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{analysisData.summary}</p>
                </div>
                {analysisData.strengths?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-green-400 uppercase tracking-wider mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {analysisData.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <span className="w-1 h-1 rounded-full bg-green-400 mt-1.5 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisData.risks?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-1">Risks</p>
                    <ul className="space-y-1">
                      {analysisData.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisData.recommendations?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-1">Recommendations</p>
                    <ul className="space-y-1">
                      {analysisData.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <Lightbulb className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mermaid Preview */}
          {(dataFlow as any)?.mermaidDiagram && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" /> Flow Diagram
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto max-h-[200px] leading-relaxed">
                  {(dataFlow as any)?.mermaidDiagram}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Flow Details Drawer */}
      {showDetails && selectedNodeData && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => { setShowDetails(null); setSelectedNode(null) }} />
          <div className="fixed right-0 top-0 bottom-0 w-96 z-50 bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[selectedNodeData.type] || "#64748B" }} />
                {selectedNodeData.label}
              </h3>
              <button
                onClick={() => { setShowDetails(null); setSelectedNode(null) }}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 text-xs">
              {/* Overview card */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Type</p>
                  <Badge variant="info" className="text-[10px]">{selectedNodeData.type}</Badge>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Requests</p>
                  <p className="font-mono text-slate-100 font-semibold">{selectedNodeData.requestCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Risk Level</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                    selectedNodeData.riskLevel === "Critical" ? "border-red-500 text-red-400 bg-red-500/10" :
                    selectedNodeData.riskLevel === "High" ? "border-orange-500 text-orange-400 bg-orange-500/10" :
                    selectedNodeData.riskLevel === "Medium" ? "border-yellow-500 text-yellow-400 bg-yellow-500/10" :
                    "border-green-500 text-green-400 bg-green-500/10"
                  }`}>{selectedNodeData.riskLevel}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Language</p>
                  <p className="text-slate-100">{selectedNodeData.language || "—"}</p>
                </div>
              </div>

              {/* Purpose */}
              {selectedNodeData.purpose && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Purpose</p>
                  <p className="text-slate-300 leading-relaxed">{selectedNodeData.purpose}</p>
                </div>
              )}

              {/* Business Role */}
              {selectedNodeData.businessRole && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Business Domain</p>
                  <Badge variant="info" className="text-[10px]">{selectedNodeData.businessRole}</Badge>
                </div>
              )}

              {/* Description */}
              {selectedNodeData.description && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-slate-300 leading-relaxed">{selectedNodeData.description}</p>
                </div>
              )}

              {/* Inputs */}
              {selectedNodeData.inputs && selectedNodeData.inputs.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Inputs</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNodeData.inputs.map((input, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px]">{input}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Outputs */}
              {selectedNodeData.outputs && selectedNodeData.outputs.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Outputs</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNodeData.outputs.map((output, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-300 text-[10px]">{output}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Transformations */}
              {selectedNodeData.dataTransformations && selectedNodeData.dataTransformations.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Data Transformations</p>
                  <div className="space-y-1">
                    {selectedNodeData.dataTransformations.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/30 text-slate-300">
                        <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependencies (what this node calls) */}
              {selectedNodeEdges.outgoing.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Dependencies</p>
                  <div className="space-y-1">
                    {selectedNodeEdges.outgoing.map((e, i) => {
                      const targetNode = sourceNodes.find(n => n.id === e.target)
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/30">
                          <span className="text-[10px] text-blue-400 font-medium">{e.relation}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-slate-300">{targetNode?.label || e.target}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Dependents (what calls this node) */}
              {selectedNodeEdges.incoming.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Used By</p>
                  <div className="space-y-1">
                    {selectedNodeEdges.incoming.map((e, i) => {
                      const sourceNode = sourceNodes.find(n => n.id === e.source)
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/30">
                          <span className="text-slate-300">{sourceNode?.label || e.source}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-[10px] text-blue-400 font-medium">{e.relation}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* AI Explanation */}
              {selectedNodeData.aiExplanation && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 border border-slate-800">
                  <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-2">AI Explanation</p>
                  <p className="text-slate-300 leading-relaxed">{selectedNodeData.aiExplanation}</p>
                </div>
              )}

              {/* File path if available */}
              {selectedNodeData.filePath && (
                <div>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Source File</p>
                  <p className="font-mono text-[10px] text-slate-400 truncate">{selectedNodeData.filePath}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Runtime Flow Catalog */}
      <Card className="border border-slate-800 bg-slate-900/50 backdrop-blur mt-6">
        <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" /> Runtime Flow Catalog
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Select, analyze, and compare individual runtime data paths across repository components
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (journeys.length >= 2) {
                  setCompareFlowA(journeys[0].id)
                  setCompareFlowB(journeys[1].id)
                  setIsComparing(true)
                }
              }}
              className="text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300 animate-pulse"
            >
              <Layers className="w-4 h-4 mr-1 text-purple-400 animate-spin" /> Compare Flows
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {journeys.map((j) => (
              <Card key={j.id} className="border border-slate-800/80 bg-slate-900/30 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{j.label}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{j.description}</p>
                    </div>
                    <Badge style={{ backgroundColor: `${j.color}15`, color: j.color, borderColor: j.color }} variant="outline">
                      {j.businessCriticality || "High"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
                    <div className="p-1.5 rounded bg-slate-800/30 border border-slate-800 text-center">
                      <span className="block text-slate-500 uppercase tracking-wider text-[8px]">Perf Score</span>
                      <span className="font-semibold text-green-400 font-mono">{j.performanceScore || 88}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/30 border border-slate-800 text-center">
                      <span className="block text-slate-500 uppercase tracking-wider text-[8px]">Risk</span>
                      <span className={`font-semibold font-mono ${
                        j.riskLevel === "Critical" ? "text-purple-400" :
                        j.riskLevel === "High" ? "text-red-400" :
                        j.riskLevel === "Medium" ? "text-orange-400" :
                        "text-green-400"
                      }`}>{j.riskLevel || "Low"}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/30 border border-slate-800 text-center">
                      <span className="block text-slate-500 uppercase tracking-wider text-[8px]">Latency</span>
                      <span className="font-semibold text-blue-400 font-mono">{j.averageResponse || "120 ms"}</span>
                    </div>
                  </div>
                </CardContent>
                <div className="px-4 pb-4 pt-0 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setActiveJourney(j.id)
                      setShowFlowDetails(j.id)
                    }}
                    className="flex-1 text-[11px] bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300"
                  >
                    <Bot className="w-3.5 h-3.5 mr-1 text-blue-400" /> Explain Flow
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setActiveJourney(j.id)
                      if (reactFlowInstance) {
                        const nodeIds = j.nodeIds;
                        if (nodeIds.length > 0) {
                          reactFlowInstance.fitView({ nodes: nodeIds.map(id => ({ id })), duration: 300 });
                        }
                      }
                    }}
                    className="text-[11px] bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300"
                    title="Visualize in Graph"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Flow Details Drawer */}
      {showFlowDetails && journeys.find(j => j.id === showFlowDetails) && (
        (() => {
          const selectedFlow = journeys.find(j => j.id === showFlowDetails)!
          return (
            <>
              <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => { setShowFlowDetails(null); setActiveJourney(null) }} />
              <div className="fixed right-0 top-0 bottom-0 w-[550px] z-50 bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: selectedFlow.color }} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{selectedFlow.label}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{selectedFlow.route || "/"}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowFlowDetails(null); setActiveJourney(null) }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab navigation */}
                <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex gap-1 overflow-x-auto shrink-0 scrollbar-none">
                  {[
                    { id: "overview", label: "Overview & Path" },
                    { id: "breakdown", label: "Transformation & Steps" },
                    { id: "files", label: "Files & Roles" },
                    { id: "data", label: "APIs & DB Flow" },
                    { id: "security", label: "Security & Failures" },
                    { id: "performance", label: "Performance & Bottlenecks" },
                    { id: "onboarding", label: "Onboarding" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDrawerTab(tab.id)}
                      className={`px-3 py-1.5 text-[10px] font-medium rounded-md whitespace-nowrap transition-colors ${
                        drawerTab === tab.id
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Content Area */}
                <div className="p-5 space-y-6 flex-1 overflow-y-auto text-xs">
                  {/* Overview tab */}
                  {drawerTab === "overview" && (
                    <div className="space-y-5">
                      {/* Metrics Card */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Flow Type</p>
                          <p className="font-semibold text-slate-200">{selectedFlow.flowType}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Complexity</p>
                          <p className="font-semibold text-slate-200">{selectedFlow.complexity}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Risk Level</p>
                          <span className={`inline-block text-[10px] font-semibold ${
                            selectedFlow.riskLevel === "Critical" ? "text-purple-400" :
                            selectedFlow.riskLevel === "High" ? "text-red-400" :
                            selectedFlow.riskLevel === "Medium" ? "text-orange-400" :
                            "text-green-400"
                          }`}>{selectedFlow.riskLevel}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Perf Score</p>
                          <p className="font-semibold text-green-400">{selectedFlow.performanceScore}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Latency</p>
                          <p className="font-semibold text-blue-400">{selectedFlow.averageResponse}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Business Impact</p>
                          <p className="font-semibold text-slate-200">{selectedFlow.businessCriticality}</p>
                        </div>
                      </div>

                      {/* Info counts */}
                      <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-slate-400 py-1.5 border-y border-slate-800">
                        <div>
                          <strong className="block text-slate-200 text-sm">{selectedFlow.filesInvolved}</strong>
                          Files Involved
                        </div>
                        <div>
                          <strong className="block text-slate-200 text-sm">{selectedFlow.functionsInvolved}</strong>
                          Functions
                        </div>
                        <div>
                          <strong className="block text-slate-200 text-sm">{selectedFlow.databaseQueries}</strong>
                          DB Queries
                        </div>
                        <div>
                          <strong className="block text-slate-200 text-sm">{selectedFlow.externalAPIs}</strong>
                          APIs
                        </div>
                      </div>

                      {/* Purpose */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-2">Purpose</h4>
                        <p className="text-slate-300 leading-relaxed bg-slate-800/20 border border-slate-800 p-3 rounded-lg">{selectedFlow.purpose}</p>
                      </div>

                      {/* Explanation style selector */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10.5px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <Bot className="w-4 h-4 text-blue-400" /> Explain Flow Mode
                          </h4>
                          <div className="flex gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                            {(["detailed", "business", "technical", "beginner"] as const).map((style) => (
                              <button
                                key={style}
                                onClick={() => setAiExplanationStyle(style)}
                                className={`px-2 py-1 text-[9px] font-medium capitalize rounded-md transition-colors ${
                                  aiExplanationStyle === style
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11.5px]">
                          {selectedFlow.aiExplanation?.[aiExplanationStyle] || "No explanation available."}
                        </p>
                      </div>

                      {/* Request Journey (Visual Timeline) */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-3">Request Journey Path</h4>
                        <div className="relative pl-6 space-y-3">
                          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800" />
                          {selectedFlow.requestJourney?.map((jNode, idx) => (
                            <div key={idx} className="relative flex items-center gap-3">
                              <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full border bg-slate-900 border-blue-500 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              </div>
                              <div className="bg-slate-850/50 border border-slate-800/80 px-3 py-1.5 rounded-lg flex-1">
                                <span className="font-semibold text-slate-100 font-mono text-[10.5px]">{jNode}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Breakdown & Transformations tab */}
                  {drawerTab === "breakdown" && (
                    <div className="space-y-6">
                      {/* Transformation pipeline */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-3">Data Transformation Pipeline</h4>
                        <div className="space-y-3">
                          {selectedFlow.dataTransformation?.map((t, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-slate-800/25 border border-slate-800/80 p-2.5 rounded-lg">
                              <Badge className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 w-20 justify-center text-slate-300" variant="default">
                                {t.stage}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-slate-200 text-[11px] truncate">{t.value}</p>
                                {t.operation && <p className="text-[9px] text-slate-500 mt-0.5">Op: {t.operation}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Step-by-step breakdown */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-3">Execution Steps</h4>
                        <div className="space-y-3">
                          {selectedFlow.breakdown?.map((step) => (
                            <div key={step.step} className="p-3 rounded-lg bg-slate-850 border border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-blue-400 font-mono">Step {step.step}</span>
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]" title={step.file}>{step.file}</span>
                              </div>
                              <h4 className="text-xs font-semibold text-slate-200">{step.title}</h4>
                              {step.request && <code className="block text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-pink-400 font-mono w-fit">{step.request}</code>}
                              <p className="text-slate-400 text-[11px] leading-relaxed">{step.purpose}</p>
                              {step.operations && step.operations.length > 0 && (
                                <div className="pt-1.5 space-y-1">
                                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Internal Operations:</span>
                                  <ul className="list-disc list-inside text-slate-400 text-[10px] pl-1 space-y-0.5">
                                    {step.operations.map((op, oIdx) => (
                                      <li key={oIdx}>{op}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Files tab */}
                  {drawerTab === "files" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-2">File Participation Analysis</h4>
                      <div className="space-y-3">
                        {selectedFlow.fileParticipation?.map((file, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-slate-855 border border-slate-800/80 space-y-2">
                            <div className="flex items-start justify-between">
                              <span className="font-mono text-slate-100 font-semibold truncate max-w-[280px]">{file.file}</span>
                              <Badge variant="outline" className="text-[9px] text-slate-300">{file.role}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Calls</span>
                                {file.calls.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {file.calls.map((c, cIdx) => (
                                      <span key={cIdx} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[9px]">{c}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 italic">None</span>
                                )}
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Dependencies</span>
                                {file.dependencies.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {file.dependencies.map((d, dIdx) => (
                                      <span key={dIdx} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[9px]">{d}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 italic">None</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data & APIs tab */}
                  {drawerTab === "data" && (
                    <div className="space-y-6">
                      {/* Database flow */}
                      {selectedFlow.databaseFlow && (
                        <div className="p-4 rounded-lg bg-slate-855 border border-slate-800 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5"><Database className="w-4 h-4 text-orange-400" /> Database Flow Analysis</h4>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-[9px] text-slate-500 block uppercase">Reads</span>
                              <span className="text-sm font-semibold text-slate-200 font-mono">{selectedFlow.databaseFlow.readOperations}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-[9px] text-slate-500 block uppercase">Writes</span>
                              <span className="text-sm font-semibold text-slate-200 font-mono">{selectedFlow.databaseFlow.writeOperations}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-[9px] text-slate-500 block uppercase">Query Complexity</span>
                              <span className="text-sm font-semibold text-slate-200">{selectedFlow.databaseFlow.queryComplexity}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-[9px] text-slate-500 block uppercase">Indexes Used</span>
                              <span className="text-[10px] font-semibold text-slate-200 font-mono truncate block" title={selectedFlow.databaseFlow.indexesUsed.join(", ")}>{selectedFlow.databaseFlow.indexesUsed.join(", ") || "None"}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase block mb-1">Accessed Entities / Collections</span>
                            <div className="flex flex-wrap gap-1">
                              {(selectedFlow.databaseFlow.tablesAccessed.concat(selectedFlow.databaseFlow.collectionsAccessed)).map((item, idx) => (
                                <span key={idx} className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-mono text-[10px]">{item}</span>
                              ))}
                              {(selectedFlow.databaseFlow.tablesAccessed.length === 0 && selectedFlow.databaseFlow.collectionsAccessed.length === 0) && (
                                <span className="text-slate-600 italic">No database entities accessed in this flow</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* External APIs */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-3">External API Analysis</h4>
                        <div className="space-y-3">
                          {selectedFlow.externalAPIDetails && selectedFlow.externalAPIDetails.length > 0 ? (
                            selectedFlow.externalAPIDetails.map((api, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-slate-850 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-100 font-mono">{api.name}</span>
                                  <Badge variant="outline" className="text-[9px] text-slate-300">{api.failureImpact} Failure Impact</Badge>
                                </div>
                                <p className="text-slate-400 text-[11px]">{api.purpose}</p>
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                  <span>Avg Latency: <strong className="text-slate-300">{api.avgResponse}</strong></span>
                                  <span>Calls: <strong className="text-slate-300">{api.calls}</strong></span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-slate-500 italic bg-slate-850 border border-slate-800 rounded-lg">No external APIs called by this flow</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security tab */}
                  {drawerTab === "security" && (
                    <div className="space-y-6">
                      {/* Security scores */}
                      {selectedFlow.securityFlow && (
                        <div className="p-4 rounded-lg bg-slate-850 border border-slate-800 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5"><Shield className="w-4 h-4 text-blue-400" /> Security Flow Analysis</h4>
                          <div className="grid grid-cols-2 gap-2.5 text-[10px]">
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-500 block uppercase">Authentication</span>
                              <span className="font-semibold text-slate-200">{selectedFlow.securityFlow.authentication}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-500 block uppercase">Authorization</span>
                              <span className={`font-semibold ${selectedFlow.securityFlow.authorization.toLowerCase().includes("missing") ? "text-red-400" : "text-green-400"}`}>{selectedFlow.securityFlow.authorization}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-500 block uppercase">Input Validation</span>
                              <span className="font-semibold text-slate-200">{selectedFlow.securityFlow.inputValidation}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-500 block uppercase">Sensitive Data Exposure</span>
                              <span className="font-semibold text-slate-200">{selectedFlow.securityFlow.sensitiveDataExposure}</span>
                            </div>
                          </div>
                          {selectedFlow.securityFlow.reason && (
                            <div className="p-3 rounded bg-red-950/20 border border-red-900/30 text-[11px] text-red-400">
                              <strong>Risk Reason:</strong> {selectedFlow.securityFlow.reason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Failure impact */}
                      {selectedFlow.failureImpact && (
                        <div className="p-4 rounded-lg bg-slate-850 border border-slate-800 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-purple-400" /> Failure Impact Analysis</h4>
                          <div className="space-y-2 text-[11px]">
                            <p><span className="text-slate-500">If node fails:</span> <span className="font-mono text-slate-200 font-semibold">{selectedFlow.failureImpact.nodeName}</span></p>
                            <p><span className="text-slate-500">Impact:</span> <span className="text-red-400 font-semibold">{selectedFlow.failureImpact.impact}</span></p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                                <span className="text-slate-500 text-[9px] block uppercase">Affected Flows</span>
                                <span className="text-sm font-semibold text-slate-200">{selectedFlow.failureImpact.affectedFlows}</span>
                              </div>
                              <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                                <span className="text-slate-500 text-[9px] block uppercase">Affected Files</span>
                                <span className="text-sm font-semibold text-slate-200">{selectedFlow.failureImpact.affectedFiles}</span>
                              </div>
                            </div>
                            <p className="mt-2"><span className="text-slate-500">Business Impact:</span> <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-block ${
                              selectedFlow.failureImpact.businessImpact === "Critical" ? "border-red-500 text-red-400 bg-red-500/10" :
                              selectedFlow.failureImpact.businessImpact === "High" ? "border-orange-500 text-orange-400 bg-orange-500/10" :
                              "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                            }`}>{selectedFlow.failureImpact.businessImpact}</span></p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Performance & Bottlenecks tab */}
                  {drawerTab === "performance" && (
                    <div className="space-y-6">
                      {/* Latency Allocations */}
                      {selectedFlow.performanceBreakdown && (
                        <div className="p-4 rounded-lg bg-slate-850 border border-slate-800 space-y-4">
                          <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5"><Activity className="w-4 h-4 text-green-400" /> Performance Intelligence</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Database Cost</span>
                                <span className="font-semibold text-slate-200">{selectedFlow.performanceBreakdown.database}%</span>
                              </div>
                              <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${selectedFlow.performanceBreakdown.database}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Business Logic Cost</span>
                                <span className="font-semibold text-slate-200">{selectedFlow.performanceBreakdown.businessLogic}%</span>
                              </div>
                              <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${selectedFlow.performanceBreakdown.businessLogic}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Network Cost</span>
                                <span className="font-semibold text-slate-200">{selectedFlow.performanceBreakdown.network}%</span>
                              </div>
                              <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${selectedFlow.performanceBreakdown.network}%` }} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-3 border-t border-slate-800">
                            <div>
                              <span className="text-slate-500 uppercase text-[9px] block">CPU Overhead</span>
                              <span className="font-semibold text-slate-200">{selectedFlow.performanceBreakdown.cpuCost || "Low"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 uppercase text-[9px] block">Memory Overhead</span>
                              <span className="font-semibold text-slate-200">{selectedFlow.performanceBreakdown.memoryCost || "Low"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bottlenecks list */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider mb-3">Bottlenecks Detected</h4>
                        <div className="space-y-3">
                          {selectedFlow.bottlenecksList && selectedFlow.bottlenecksList.length > 0 ? (
                            selectedFlow.bottlenecksList.map((b, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-red-955/15 border border-red-900/30 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-red-400">Bottleneck Found</span>
                                  <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">{b.severity}</Badge>
                                </div>
                                <p className="text-slate-200 text-[11px] font-semibold">{b.issue}</p>
                                <p className="text-slate-400 text-[10px]">Recommendation: {b.recommendation}</p>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-slate-500 italic bg-slate-850 border border-slate-800 rounded-lg">No runtime bottlenecks detected in this flow</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Onboarding tab */}
                  {drawerTab === "onboarding" && (
                    <div className="space-y-4">
                      {selectedFlow.onboarding && (
                        <div className="p-4 rounded-lg bg-blue-955/10 border border-blue-900/30 space-y-4">
                          <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-blue-400" /> Learn This Flow</h4>
                          
                          <div className="space-y-3.5">
                            <div>
                              <span className="text-slate-500 uppercase text-[9px] block mb-1">Files to Read</span>
                              <div className="space-y-1">
                                {selectedFlow.onboarding.filesToRead.map((file, idx) => (
                                  <code key={idx} className="block text-[10px] font-mono text-blue-300 bg-slate-900/50 p-1.5 border border-slate-800 rounded truncate">{file}</code>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-slate-500 uppercase text-[9px] block mb-1.5">Execution Order</span>
                              <div className="space-y-2 relative pl-4 border-l border-slate-800">
                                {selectedFlow.onboarding.executionOrder.map((step, idx) => (
                                  <div key={idx} className="relative text-[10.5px] text-slate-300">
                                    <span className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-blue-500 border border-slate-900" />
                                    {step}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-slate-500 uppercase text-[9px] block mb-1">Key Concepts</span>
                              <div className="flex flex-wrap gap-1">
                                {selectedFlow.onboarding.conceptsRequired.map((concept, idx) => (
                                  <span key={idx} className="bg-slate-850 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">{concept}</span>
                                ))}
                              </div>
                            </div>

                            <div className="pt-2.5 border-t border-slate-850 flex justify-between text-[10px] text-slate-400">
                              <span>Estimated Learning Time:</span>
                              <strong className="text-slate-200">{selectedFlow.onboarding.estimatedLearningTime}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        })()
      )}

      {/* Compare Flows Modal */}
      {isComparing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" /> Flow Comparison Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-1">Select and compare structural metrics and performance scores of two runtime flows</p>
              </div>
              <button onClick={() => setIsComparing(false)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector bar */}
            <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-4 text-xs">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-slate-500 font-semibold">Flow A:</span>
                <select
                  value={compareFlowA || ""}
                  onChange={(e) => setCompareFlowA(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" disabled>Select Flow</option>
                  {journeys.map(j => (
                    <option key={j.id} value={j.id} disabled={j.id === compareFlowB}>{j.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-slate-600 font-semibold">vs</div>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-slate-500 font-semibold">Flow B:</span>
                <select
                  value={compareFlowB || ""}
                  onChange={(e) => setCompareFlowB(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" disabled>Select Flow</option>
                  {journeys.map(j => (
                    <option key={j.id} value={j.id} disabled={j.id === compareFlowA}>{j.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix Content */}
            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {compareFlowA && compareFlowB && journeys.find(j => j.id === compareFlowA) && journeys.find(j => j.id === compareFlowB) ? (
                (() => {
                  const flowAObj = journeys.find(j => j.id === compareFlowA)!
                  const flowBObj = journeys.find(j => j.id === compareFlowB)!
                  
                  const metricsToCompare = [
                    { label: "Complexity", valA: flowAObj.complexity, valB: flowBObj.complexity },
                    { label: "Risk Level", valA: flowAObj.riskLevel, valB: flowBObj.riskLevel, isRisk: true },
                    { label: "Performance Score", valA: `${flowAObj.performanceScore}%`, valB: `${flowBObj.performanceScore}%` },
                    { label: "Average Response", valA: flowAObj.averageResponse, valB: flowBObj.averageResponse },
                    { label: "Files Involved", valA: flowAObj.filesInvolved, valB: flowBObj.filesInvolved },
                    { label: "Database Queries", valA: flowAObj.databaseQueries, valB: flowBObj.databaseQueries },
                    { label: "External APIs", valA: flowAObj.externalAPIs, valB: flowBObj.externalAPIs },
                    { label: "Business Criticality", valA: flowAObj.businessCriticality, valB: flowBObj.businessCriticality },
                    { label: "Entry Point", valA: flowAObj.entryPoint, valB: flowBObj.entryPoint, isMono: true },
                    { label: "Route", valA: flowAObj.route, valB: flowBObj.route, isMono: true },
                    { label: "Output Contract", valA: flowAObj.output, valB: flowBObj.output },
                  ]

                  return (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="py-2.5 w-1/3">Metric / Property</th>
                          <th className="py-2.5 w-1/3" style={{ color: flowAObj.color }}>{flowAObj.label}</th>
                          <th className="py-2.5 w-1/3" style={{ color: flowBObj.color }}>{flowBObj.label}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {metricsToCompare.map((metric, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/10">
                            <td className="py-3 font-medium text-slate-400">{metric.label}</td>
                            <td className="py-3">
                              {metric.isRisk ? (
                                <Badge style={{
                                  backgroundColor: metric.valA === "Critical" ? "#7C3AED15" : metric.valA === "High" ? "#EF444415" : "#22C55E15",
                                  color: metric.valA === "Critical" ? "#7C3AED" : metric.valA === "High" ? "#EF4444" : "#22C55E",
                                  borderColor: metric.valA === "Critical" ? "#7C3AED50" : metric.valA === "High" ? "#EF444450" : "#22C55E50"
                                }} variant="outline">
                                  {metric.valA}
                                </Badge>
                              ) : metric.isMono ? (
                                <code className="text-[10px] bg-slate-900 border border-slate-800 px-1 py-0.5 rounded font-mono text-slate-300">{metric.valA}</code>
                              ) : (
                                <span>{metric.valA}</span>
                              )}
                            </td>
                            <td className="py-3">
                              {metric.isRisk ? (
                                <Badge style={{
                                  backgroundColor: metric.valB === "Critical" ? "#7C3AED15" : metric.valB === "High" ? "#EF444415" : "#22C55E15",
                                  color: metric.valB === "Critical" ? "#7C3AED" : metric.valB === "High" ? "#EF4444" : "#22C55E",
                                  borderColor: metric.valB === "Critical" ? "#7C3AED50" : metric.valB === "High" ? "#EF444450" : "#22C55E50"
                                }} variant="outline">
                                  {metric.valB}
                                </Badge>
                              ) : metric.isMono ? (
                                <code className="text-[10px] bg-slate-900 border border-slate-800 px-1 py-0.5 rounded font-mono text-slate-300">{metric.valB}</code>
                              ) : (
                                <span>{metric.valB}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                })()
              ) : (
                <div className="text-center py-12 text-slate-500 italic">Please select two flows to generate comparison matrix</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DataFlowPageInner() {
  return (
    <ReactFlowProvider>
      <DataFlowInner />
    </ReactFlowProvider>
  )
}

export default function DataFlowPage() {
  return (
    <AppLayout>
      <DataFlowPageInner />
    </AppLayout>
  )
}
