import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    queued: "bg-yellow-500/20 text-yellow-400",
    cloning: "bg-blue-500/20 text-blue-400",
    scanning: "bg-blue-500/20 text-blue-400",
    parsing: "bg-purple-500/20 text-purple-400",
    embedding: "bg-indigo-500/20 text-indigo-400",
    graph_building: "bg-orange-500/20 text-orange-400",
    complete: "bg-green-500/20 text-green-400",
    error: "bg-red-500/20 text-red-400",
  }
  return colors[status] || "bg-gray-500/20 text-gray-400"
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  }
  return colors[severity.toLowerCase()] || "bg-gray-500/20 text-gray-400"
}
