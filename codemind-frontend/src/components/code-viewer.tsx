"use client"

import { useState, useCallback, memo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Copy, Check, FileCode } from "lucide-react"

interface CodeViewerProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  maxHeight?: number
  className?: string
}

function detectLanguage(filename?: string, fallback = "typescript"): string {
  if (!filename) return fallback
  const ext = filename.split(".").pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    java: "java",
    rs: "rust",
    rb: "ruby",
    php: "php",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    md: "markdown",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
  }
  return map[ext || ""] || fallback
}

const customStyle: React.CSSProperties = {
  margin: 0,
  padding: "1rem",
  background: "transparent",
  fontSize: "0.75rem",
  lineHeight: "1.6",
  fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
}

export const CodeViewer = memo(function CodeViewer({
  code,
  language,
  filename,
  showLineNumbers = true,
  maxHeight = 520,
  className = "",
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false)
  const detectedLang = language || detectLanguage(filename)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])

  return (
    <div
      className={`relative rounded-xl border border-slate-800 bg-[#1A2035] overflow-hidden ${className}`}
      role="region"
      aria-label={filename ? `Code viewer: ${filename}` : "Code viewer"}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-300">{filename || "untitled"}</span>
          <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{detectedLang}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Code */}
      <div style={{ maxHeight, overflowY: "auto" }}>
        <SyntaxHighlighter
          language={detectedLang}
          style={oneDark}
          showLineNumbers={showLineNumbers}
          customStyle={customStyle}
          lineNumberStyle={{
            color: "#334155",
            fontSize: "0.7rem",
            paddingRight: "1rem",
            userSelect: "none",
            minWidth: "2.5rem",
          }}
          wrapLines
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
})
