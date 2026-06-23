"use client"

import { useState, useCallback, useEffect } from "react"
import { AppLayout } from "@/layouts/app-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Upload, Globe, Link, FileCode, Clock, CheckCircle2, ChevronRight, X, AlertCircle, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import { useDropzone } from "@/hooks/use-dropzone"
import { formatDate, getStatusColor, formatNumber } from "@/lib/utils"
import { ANALYSIS_STAGES } from "@/lib/constants"
import { useRepositoryStore } from "@/store/repository-store"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { repositoryService } from "@/services/api"
import type { AnalysisStatus, Repository } from "@/types"

const PROVIDERS = [
  { name: "GitHub", placeholder: "https://github.com/owner/repo" },
  { name: "GitLab", placeholder: "https://gitlab.com/owner/repo" },
  { name: "Bitbucket", placeholder: "https://bitbucket.org/owner/repo" },
]

function UploadZone() {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [urlModal, setUrlModal] = useState<{ open: boolean; provider: string }>({ open: false, provider: "" })
  const [repoUrl, setRepoUrl] = useState("")
  const [uploadingRepoId, setUploadingRepoId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const [uploadStatus, setUploadStatus] = useState<{ message: string; progress: number } | null>(null)

  // Poll repo status when URL upload is in progress
  const { data: uploadingRepo } = useQuery({
    queryKey: ["repository", uploadingRepoId],
    queryFn: () => repositoryService.getById(uploadingRepoId!),
    enabled: !!uploadingRepoId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === "complete" || data?.status === "error") return false
      return 1500
    },
  })

  const urlProgress = uploadingRepo
    ? ANALYSIS_STAGES.indexOf(uploadingRepo.status as typeof ANALYSIS_STAGES[number])
    : 0
  const urlProgressPct = uploadingRepo?.status === "complete" ? 100
    : uploadingRepo?.status === "error" ? 100
    : Math.round((urlProgress / (ANALYSIS_STAGES.length - 1)) * 100)

  // Close modal when URL upload completes
  useEffect(() => {
    if (uploadingRepo?.status === "complete" || uploadingRepo?.status === "error") {
      const timer = setTimeout(() => {
        setUploadingRepoId(null)
        setUrlModal({ open: false, provider: "" })
        setRepoUrl("")
      }, uploadingRepo.status === "complete" ? 1000 : 3000)
      return () => clearTimeout(timer)
    }
  }, [uploadingRepo?.status])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus({ message: "Uploading file...", progress: 15 })
      const formData = new FormData()
      formData.append("file", file)
      const result = await repositoryService.upload(formData)
      setUploadStatus({ message: "Processing...", progress: 40 })
      return result
    },
    onSuccess: () => {
      setUploadStatus({ message: "Analysis queued...", progress: 60 })
      // Simulate progress through stages
      const stages = ["Cloning", "Scanning", "Parsing", "Embedding", "Graph Building"]
      let i = 0
      const interval = setInterval(() => {
        i++
        if (i <= stages.length) {
          setUploadStatus({ message: `${stages[i - 1]}...`, progress: 60 + (i / stages.length) * 35 })
        } else {
          clearInterval(interval)
          setUploadStatus({ message: "Complete!", progress: 100 })
          setTimeout(() => {
            setUploadStatus(null)
            setUploadProgress(null)
          }, 1500)
        }
      }, 1200)
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
    },
    onError: () => {
      setUploadProgress(null)
      setUploadStatus(null)
    },
  })

  const urlMutation = useMutation({
    mutationFn: async (url: string) => {
      return repositoryService.uploadFromUrl(url)
    },
    onSuccess: (data) => {
      setUploadingRepoId(data.id)
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
    },
  })

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploadProgress(10)
    uploadMutation.mutate(file, {
      onSuccess: () => setUploadProgress(100),
      onError: () => setUploadProgress(null),
    })
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
  })

  const handleUrlSubmit = () => {
    if (!repoUrl.trim()) return
    urlMutation.mutate(repoUrl)
  }

  const currentProvider = PROVIDERS.find((p) => p.name === urlModal.provider)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Repository</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragActive
              ? "border-blue-500 bg-blue-500/5"
              : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
            }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">
            {isDragActive ? "Drop your ZIP file here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Supports .zip files up to 500MB</p>
        </div>

        {(uploadProgress !== null || uploadMutation.isPending || uploadStatus) && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">{uploadStatus?.message || "Uploading..."}</span>
              <span className="text-slate-400">{Math.round(uploadStatus?.progress ?? uploadProgress ?? 0)}%</span>
            </div>
            <Progress value={uploadStatus?.progress ?? uploadProgress ?? 0} />
            {uploadStatus && uploadStatus.progress < 100 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" aria-hidden="true" />
                <span>Repository is being analyzed...</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Or connect from</p>
          <div className="flex gap-2">
            {PROVIDERS.map(({ name }) => (
              <Button
                key={name}
                variant="secondary"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setUrlModal({ open: true, provider: name })}
              >
                <Globe className="w-4 h-4" /> {name}
              </Button>
            ))}
          </div>
        </div>

        {urlModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {uploadingRepoId ? "Fetching Repository..." : `Connect ${urlModal.provider}`}
                  </CardTitle>
                  {!uploadingRepoId && (
                    <button
                      onClick={() => setUrlModal({ open: false, provider: "" })}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400"
                      aria-label="Close modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {uploadingRepoId ? (
                  <div className="space-y-3 py-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 capitalize">
                        {uploadingRepo?.status === "error" ? "Failed" : uploadingRepo?.status?.replace(/_/g, " ") || "Connecting..."}
                      </span>
                      <span className="text-slate-400">{uploadingRepo?.status === "error" ? "—" : `${urlProgressPct}%`}</span>
                    </div>
                    <Progress
                      value={urlProgressPct}
                      variant={uploadingRepo?.status === "error" ? "warning" : "default"}
                    />
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {uploadingRepo?.status === "error" ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400">Failed to fetch repository. Check the URL and try again.</span>
                        </>
                      ) : uploadingRepo?.status === "complete" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-green-400">Repository fetched successfully!</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          <span>Fetching files from GitHub...</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <Input
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder={currentProvider?.placeholder || "Repository URL"}
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => setUrlModal({ open: false, provider: "" })}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={handleUrlSubmit}
                        isLoading={urlMutation.isPending}
                      >
                        Connect
                      </Button>
                    </div>
                    {urlMutation.isError && (
                      <p className="text-xs text-red-400">Failed to connect repository. Please try again.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RepositoryCard({ repo }: { repo: Repository }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setCurrentRepository } = useRepositoryStore()
  const [showDelete, setShowDelete] = useState(false)
  const progressIndex = ANALYSIS_STAGES.indexOf(repo.status as typeof ANALYSIS_STAGES[number])
  const totalStages = ANALYSIS_STAGES.length
  const progress = repo.status === "complete" ? 100 : (progressIndex / totalStages) * 100

  const deleteMutation = useMutation({
    mutationFn: () => repositoryService.delete(repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
      setShowDelete(false)
    },
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          setCurrentRepository(repo)
          router.push(`/repositories/${repo.id}`)
        }}
      >
        <Card hover>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-slate-100">{repo.name}</span>
                  <Badge>{repo.language}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{formatNumber(repo.totalFiles)} files</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(repo.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {repo.status === "complete" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <div className="w-20">
                    <Progress value={progress} variant={repo.status === "error" ? "warning" : "default"} />
                  </div>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(repo.status)}`}>
                  {repo.status.replace("_", " ")}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDelete(true) }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label={`Delete ${repo.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDelete(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
          <Card className="w-full max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="text-sm">Delete Repository</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <span className="font-semibold text-slate-100">{repo.name}</span>? This will permanently remove all associated data including file trees, analysis results, and onboarding plans.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </>
  )
}

export default function RepositoriesPage() {
  const { data: repositories = [], isLoading } = useQuery({
    queryKey: ["repositories"],
    queryFn: repositoryService.getAll,
  })

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Repositories</h1>
          <p className="text-slate-400 mt-1">Upload and manage your repositories</p>
        </div>

        <UploadZone />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Recent Repositories</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent>
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-800 rounded w-1/3" />
                      <div className="h-3 bg-slate-800 rounded w-1/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : repositories.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-slate-500 text-center py-8">No repositories yet. Upload one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {repositories.map((repo) => (
                <RepositoryCard key={repo.id} repo={repo} />
              ))}
            </div>
          )}
        </div>
      </div>
      </ErrorBoundary>
    </AppLayout>
  )
}
