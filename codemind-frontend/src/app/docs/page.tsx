"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRepositoryStore } from "@/store/repository-store"
import { AppLayout } from "@/layouts/app-layout"
import { BookOpen, Loader2 } from "lucide-react"

export default function DocsRedirect() {
  const router = useRouter()
  const { currentRepository, repositories } = useRepositoryStore()

  useEffect(() => {
    if (currentRepository) {
      router.replace(`/docs/${currentRepository.id}`)
    } else if (repositories.length > 0) {
      router.replace(`/docs/${repositories[0].id}`)
    }
  }, [currentRepository, repositories, router])

  if (!currentRepository && repositories.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-2xl" />
            <BookOpen className="relative h-16 w-16 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Documentation Available</h3>
          <p className="text-sm text-slate-500 max-w-md">
            Upload a repository to automatically generate comprehensive documentation.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    </AppLayout>
  )
}
