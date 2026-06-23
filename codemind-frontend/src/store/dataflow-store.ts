"use client"

import { create } from "zustand"

interface DataFlowState {
  /** User-edited diagram sources (empty string = use API/default) */
  sequenceSource: string
  flowSource: string
  architectureSource: string

  /** Whether the source-editor panel is visible */
  editorOpen: boolean

  setSequenceSource: (src: string) => void
  setFlowSource: (src: string) => void
  setArchitectureSource: (src: string) => void
  setEditorOpen: (open: boolean) => void
}

export const useDataFlowStore = create<DataFlowState>((set) => ({
  sequenceSource: "",
  flowSource: "",
  architectureSource: "",
  editorOpen: false,

  setSequenceSource: (src) => set({ sequenceSource: src }),
  setFlowSource: (src) => set({ flowSource: src }),
  setArchitectureSource: (src) => set({ architectureSource: src }),
  setEditorOpen: (open) => set({ editorOpen: open }),
}))
