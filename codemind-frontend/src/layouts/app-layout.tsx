"use client"

import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"
import { NavigationLoader } from "@/components/navigation-loader"
import { motion } from "framer-motion"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0F172A]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <NavigationLoader />
        <Navbar />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          id="main-content"
          className="flex-1 overflow-y-auto p-6"
          tabIndex={-1}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
