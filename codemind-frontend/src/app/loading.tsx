import { Loader2 } from "lucide-react"

export default function RootLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0F172A]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
          <Loader2 className="relative h-12 w-12 animate-spin text-blue-500" />
        </div>
        <p className="text-sm font-medium text-slate-400">Loading CodeMind AI...</p>
      </div>
    </div>
  )
}
