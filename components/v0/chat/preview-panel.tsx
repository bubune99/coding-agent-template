"use client"

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
} from "@/components/v0/ai-elements/web-preview"
import { RefreshCw, Monitor, Maximize, Minimize } from "lucide-react"
import { cn } from "@/lib/utils"
import { PreviewControls } from "@/components/v0/preview-controls"
import { ValidationResultsPanel } from "@/components/v0/validation-results-panel"
import { useState } from "react"

interface Chat {
  id: string
  demo?: string
  url?: string
}

interface PreviewPanelProps {
  currentChat: Chat | null
  isFullscreen: boolean
  setIsFullscreen: (fullscreen: boolean) => void
  refreshKey: number
  setRefreshKey: (key: number | ((prev: number) => number)) => void
}

export function PreviewPanel({
  currentChat,
  isFullscreen,
  setIsFullscreen,
  refreshKey,
  setRefreshKey,
}: PreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<"iframe" | "docker">("iframe")
  const [dockerUrl, setDockerUrl] = useState<string | null>(null)
  const [showValidationResults, setShowValidationResults] = useState(false)

  const handleTriggerDocker = async () => {
    if (!currentChat?.id) return

    try {
      const response = await fetch("/api/preview/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChat.id,
          code: "", // Code would come from the chat context
        }),
      })

      const result = await response.json()
      if (result.dockerUrl) {
        setDockerUrl(result.dockerUrl)
        setPreviewMode("docker")
      }
    } catch (error) {
      console.error("[v0] Failed to trigger Docker preview:", error)
    }
  }

  const previewUrl = previewMode === "docker" && dockerUrl ? dockerUrl : currentChat?.demo

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-black" : "flex-1",
      )}
    >
      {currentChat?.id && (
        <PreviewControls
          chatId={currentChat.id}
          currentMode={previewMode}
          onTriggerDocker={handleTriggerDocker}
          onShowResults={() => setShowValidationResults(!showValidationResults)}
        />
      )}

      {showValidationResults && currentChat?.id && (
        <div className="px-4 py-2 border-b">
          <ValidationResultsPanel chatId={currentChat.id} onClose={() => setShowValidationResults(false)} />
        </div>
      )}

      <WebPreview
        defaultUrl={previewUrl || ""}
        onUrlChange={(url) => {
          // Optional: Handle URL changes if needed
          console.log("Preview URL changed:", url)
        }}
      >
        <WebPreviewNavigation>
          <WebPreviewNavigationButton
            onClick={() => {
              // Force refresh the iframe by updating the refresh key
              setRefreshKey((prev) => prev + 1)
            }}
            tooltip="Refresh preview"
            disabled={!previewUrl}
          >
            <RefreshCw className="h-4 w-4" />
          </WebPreviewNavigationButton>
          <WebPreviewUrl readOnly placeholder="Your app will appear here..." value={previewUrl || ""} />
          <WebPreviewNavigationButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            disabled={!previewUrl}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        {previewUrl ? (
          <WebPreviewBody key={refreshKey} src={previewUrl} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
            <div className="text-center text-border dark:text-input">
              <div className="mb-2">
                <Monitor className="mx-auto h-12 w-12 text-border dark:text-input stroke-border dark:stroke-input" />
              </div>
              <p className="text-sm font-medium">No preview available</p>
              <p className="text-xs">Start a conversation to see your app here</p>
            </div>
          </div>
        )}
      </WebPreview>
    </div>
  )
}
