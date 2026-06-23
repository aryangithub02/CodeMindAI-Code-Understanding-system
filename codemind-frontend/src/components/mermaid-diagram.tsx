"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Download, ZoomIn, ZoomOut, RefreshCw, Image, Sun, Moon } from "lucide-react"
import { exportSvg, exportPng, downloadBlob } from "@/lib/mermaidExport"

interface MermaidDiagramProps {
  diagram: string
  title?: string
  className?: string
  /** Callback fired after successful render, receives the SVG element */
  onRender?: (svgElement: SVGElement) => void
}

type MermaidTheme = "dark" | "light"

const THEME_VARS: Record<MermaidTheme, Record<string, string>> = {
  dark: {
    background: "#0F172A",
    mainBkg: "#1E293B",
    nodeBorder: "#334155",
    lineColor: "#6366F1",
    textColor: "#F8FAFC",
    edgeLabelBackground: "#1E293B",
    primaryColor: "#2563EB",
    primaryTextColor: "#F8FAFC",
    primaryBorderColor: "#3B82F6",
    secondaryColor: "#1E293B",
    tertiaryColor: "#0F172A",
    fontSize: "14px",
  },
  light: {
    background: "#F8FAFC",
    mainBkg: "#FFFFFF",
    nodeBorder: "#CBD5E1",
    lineColor: "#6366F1",
    textColor: "#0F172A",
    edgeLabelBackground: "#F1F5F9",
    primaryColor: "#2563EB",
    primaryTextColor: "#FFFFFF",
    primaryBorderColor: "#3B82F6",
    secondaryColor: "#F1F5F9",
    tertiaryColor: "#E2E8F0",
    fontSize: "14px",
  },
}

let mermaidInitialized: MermaidTheme | null = null

async function initMermaid(diagramTheme: MermaidTheme) {
  const mermaid = (await import("mermaid")).default
  // Re-initialize when the theme changes
  if (mermaidInitialized !== diagramTheme) {
    mermaid.initialize({
      startOnLoad: false,
      theme: diagramTheme === "dark" ? "dark" : "default",
      darkMode: diagramTheme === "dark",
      themeVariables: THEME_VARS[diagramTheme],
      flowchart: { htmlLabels: true, curve: "basis" },
      sequence: { actorMargin: 50, messageMargin: 40 },
    })
    mermaidInitialized = diagramTheme
  }
}

export function MermaidDiagram({ diagram, title, className = "", onRender }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [diagramTheme, setDiagramTheme] = useState<MermaidTheme>("dark")
  const [exporting, setExporting] = useState(false)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)
  const renderCountRef = useRef(0)

  const render = useCallback(async () => {
    if (!diagram || !containerRef.current) return
    setLoading(true)
    setError(null)

    // Generate a unique id for each render to avoid Mermaid id collisions
    renderCountRef.current += 1
    const renderId = `${idRef.current}-${renderCountRef.current}`

    try {
      await initMermaid(diagramTheme)
      const mermaid = (await import("mermaid")).default
      const { svg } = await mermaid.render(renderId, diagram)
      if (containerRef.current) {
        containerRef.current.innerHTML = svg
        // Make SVG responsive
        const svgEl = containerRef.current.querySelector("svg")
        if (svgEl) {
          svgEl.style.maxWidth = "100%"
          svgEl.style.height = "auto"
          svgEl.removeAttribute("width")
          svgEl.removeAttribute("height")
          onRender?.(svgEl)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render diagram")
    } finally {
      setLoading(false)
    }
  }, [diagram, diagramTheme, onRender])

  useEffect(() => {
    render()
  }, [render])

  // ─── Export handlers ───────────────────────────────────────────────

  const getSvgElement = (): SVGElement | null =>
    containerRef.current?.querySelector("svg") ?? null

  const handleExportSvg = useCallback(() => {
    const svgEl = getSvgElement()
    if (!svgEl) return
    const url = exportSvg(svgEl)
    downloadBlob(url, `${title || "diagram"}.svg`)
  }, [title])

  const handleExportPng = useCallback(async () => {
    const svgEl = getSvgElement()
    if (!svgEl) return
    setExporting(true)
    try {
      const bgColor = THEME_VARS[diagramTheme].background
      const blob = await exportPng(svgEl, bgColor)
      downloadBlob(blob, `${title || "diagram"}.png`)
    } catch (err) {
      console.error("PNG export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [title, diagramTheme])

  const handleToggleTheme = useCallback(() => {
    setDiagramTheme((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  // ─── Zoom helpers ──────────────────────────────────────────────────

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2.5, z + 0.1)), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.4, z - 0.1)), [])

  return (
    <div
      className={`relative rounded-xl border overflow-hidden transition-colors duration-300 ${
        diagramTheme === "dark"
          ? "border-slate-800 bg-slate-900/50"
          : "border-slate-200 bg-white"
      } ${className}`}
    >
      {/* Toolbar */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b transition-colors duration-300 ${
          diagramTheme === "dark"
            ? "border-slate-800 bg-slate-900/80"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <span
          className={`text-xs font-medium transition-colors ${
            diagramTheme === "dark" ? "text-slate-400" : "text-slate-600"
          }`}
        >
          {title || "Diagram"}
        </span>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <ToolbarButton
            onClick={zoomOut}
            label="Zoom out diagram"
            theme={diagramTheme}
          >
            <ZoomOut className="w-4 h-4" aria-hidden="true" />
          </ToolbarButton>

          <span
            className={`text-xs w-10 text-center ${
              diagramTheme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {Math.round(zoom * 100)}%
          </span>

          <ToolbarButton
            onClick={zoomIn}
            label="Zoom in diagram"
            theme={diagramTheme}
          >
            <ZoomIn className="w-4 h-4" aria-hidden="true" />
          </ToolbarButton>

          {/* Divider */}
          <div
            className={`w-px h-5 mx-1 ${
              diagramTheme === "dark" ? "bg-slate-700" : "bg-slate-300"
            }`}
            aria-hidden="true"
          />

          {/* Theme toggle */}
          <ToolbarButton
            onClick={handleToggleTheme}
            label={`Switch to ${diagramTheme === "dark" ? "light" : "dark"} diagram theme`}
            theme={diagramTheme}
          >
            {diagramTheme === "dark" ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </ToolbarButton>

          {/* Refresh */}
          <ToolbarButton
            onClick={render}
            label="Refresh diagram"
            theme={diagramTheme}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </ToolbarButton>

          {/* Divider */}
          <div
            className={`w-px h-5 mx-1 ${
              diagramTheme === "dark" ? "bg-slate-700" : "bg-slate-300"
            }`}
            aria-hidden="true"
          />

          {/* SVG download */}
          <ToolbarButton
            onClick={handleExportSvg}
            label="Download as SVG"
            theme={diagramTheme}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </ToolbarButton>

          {/* PNG download */}
          <ToolbarButton
            onClick={handleExportPng}
            label="Download as PNG"
            disabled={exporting}
            theme={diagramTheme}
          >
            <Image className="w-4 h-4" aria-hidden="true" />
          </ToolbarButton>
        </div>
      </div>

      {/* Diagram content */}
      <div
        className={`overflow-auto p-6 min-h-[280px] transition-colors duration-300 ${
          diagramTheme === "light" ? "bg-white" : ""
        }`}
        role="img"
        aria-label={title ? `${title} diagram` : "Mermaid diagram"}
      >
        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="flex items-center gap-3 text-slate-400">
              <div
                className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
                aria-hidden="true"
              />
              <span className="text-sm">Rendering diagram…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm text-red-400">Failed to render diagram</p>
            <pre className="text-xs text-slate-500 max-w-md overflow-auto bg-slate-800/50 p-3 rounded-lg">
              {error}
            </pre>
            <button
              onClick={render}
              className="text-xs text-blue-400 hover:text-blue-300 underline focus-visible:outline-none"
            >
              Retry
            </button>
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease",
          }}
        />
      </div>
    </div>
  )
}

// ─── Internal toolbar button ──────────────────────────────────────────

function ToolbarButton({
  onClick,
  label,
  disabled,
  theme,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  theme: MermaidTheme
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
        theme === "dark"
          ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
      }`}
      aria-label={label}
    >
      {children}
    </button>
  )
}
