"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SIDEBAR_ITEMS } from "@/lib/constants"
import {
  LayoutDashboard,
  FolderGit2,
  Building2,
  Activity,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const iconMap: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  FolderGit2,
  Building2,
  Activity,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Settings,
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "h-screen bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden",
          "fixed lg:relative z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-lg font-bold text-slate-100 whitespace-nowrap"
              >
                CodeMind AI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    "hover:bg-slate-800/50 group",
                    isActive
                      ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full h-9 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-all duration-200"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>
    </>
  )
}
