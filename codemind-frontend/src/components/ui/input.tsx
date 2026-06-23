import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full rounded-lg border bg-slate-900/50 px-3 py-2 text-sm text-slate-100",
          "border-slate-700 placeholder:text-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50",
          "transition-all duration-200",
          error && "border-red-500 focus:ring-red-500/50",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
