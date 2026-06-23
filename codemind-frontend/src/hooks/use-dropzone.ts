import { useState, useCallback, useRef } from "react"

interface UseDropzoneOptions {
  onDrop?: (files: File[]) => void
  accept?: Record<string, string[]>
  maxFiles?: number
}

export function useDropzone({ onDrop, accept, maxFiles }: UseDropzoneOptions) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)

      const files = Array.from(e.dataTransfer.files)
      if (maxFiles) files.splice(maxFiles)
      onDrop?.(files)
    },
    [onDrop, maxFiles]
  )

  const open = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const getInputProps = useCallback(
    () => ({
      ref: inputRef,
      type: "file" as const,
      accept: accept ? Object.values(accept).flat().join(",") : undefined,
      multiple: !maxFiles || maxFiles > 1,
      style: { display: "none" },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (maxFiles) files.splice(maxFiles)
        onDrop?.(files)
        e.target.value = ""
      },
    }),
    [accept, maxFiles, onDrop]
  )

  return {
    getRootProps: () => ({
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
      onClick: open,
    }),
    getInputProps,
    isDragActive,
  }
}
