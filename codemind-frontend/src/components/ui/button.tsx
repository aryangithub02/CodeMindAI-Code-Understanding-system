import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:pointer-events-none"

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
    ghost: "hover:bg-slate-800/50 text-slate-300",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20",
    outline: "border border-slate-700 hover:bg-slate-800 text-slate-300",
  }

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
