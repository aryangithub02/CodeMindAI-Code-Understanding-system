import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface CardProps {
  className?: string
  children: ReactNode
  hover?: boolean
  onClick?: () => void
}

export function Card({ className, children, hover, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-5",
        hover && "hover:border-slate-700 hover:bg-slate-900 transition-all duration-200 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-4", className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("text-lg font-semibold text-slate-100", className)}>{children}</h3>
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-sm text-slate-400 mt-1", className)}>{children}</p>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(className)}>{children}</div>
}
