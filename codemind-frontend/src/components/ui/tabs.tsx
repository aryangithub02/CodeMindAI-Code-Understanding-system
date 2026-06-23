"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange?: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange?: (value: string) => void
}

export function Tabs({ value, onValueChange, className, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 p-1 text-slate-400 border border-slate-800",
        className
      )}
      {...props}
    />
  )
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({ value, className, onClick, ...props }: TabsTriggerProps) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsTrigger must be used within a Tabs component")

  const isActive = context.value === value

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (context.onValueChange) {
      context.onValueChange(value)
    }
    if (onClick) {
      onClick(e)
    }
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive 
          ? "bg-slate-800 text-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.1)] data-[state=active]:bg-blue-600/20" 
          : "hover:bg-slate-800/50 hover:text-slate-200",
        className
      )}
      {...props}
    />
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsContent must be used within a Tabs component")

  const isActive = context.value === value

  if (!isActive) return null

  return (
    <div
      role="tabpanel"
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}
