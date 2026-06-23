import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number
  className?: string
  variant?: "default" | "success" | "warning"
}

export function Progress({ value, className, variant = "default" }: ProgressProps) {
  const variants = {
    default: "bg-blue-500",
    success: "bg-green-500",
    warning: "bg-yellow-500",
  }

  return (
    <div className={cn("h-2 rounded-full bg-slate-800 overflow-hidden", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          variants[variant]
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
