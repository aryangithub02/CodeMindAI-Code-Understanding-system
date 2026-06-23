"use client"

import { create } from "zustand"
import type { ArchitectureAnalysis, GraphNode, GraphEdge } from "@/types"

interface ArchitectureState {
  architecture: ArchitectureAnalysis | null
  selectedNode: GraphNode | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  filterType: string | null

  setArchitecture: (arch: ArchitectureAnalysis) => void
  setSelectedNode: (node: GraphNode | null) => void
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void
  setFilterType: (type: string | null) => void
}

export const useArchitectureStore = create<ArchitectureState>((set) => ({
  architecture: null,
  selectedNode: null,
  nodes: [],
  edges: [],
  filterType: null,

  setArchitecture: (architecture) => set({ architecture }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setFilterType: (type) => set({ filterType: type }),
}))
