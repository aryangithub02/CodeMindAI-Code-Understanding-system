"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"

export function NavigationLoader() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const [navigating, setNavigating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      setNavigating(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setNavigating(false)
      }, 700)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  return (
    <>
      <AnimatePresence>
        {navigating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed top-0 left-0 right-0 z-[100] h-1"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-lg shadow-blue-500/25"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {navigating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
                <Loader2 className="relative h-10 w-10 animate-spin text-blue-500" />
              </div>
              <p className="text-sm font-medium text-slate-400">Loading...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
