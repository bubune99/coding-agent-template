"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Container, PlayCircle, CheckCircle2, XCircle, Loader2, AlertCircle, FileText } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PreviewControlsProps {
  chatId: string
  currentMode: "iframe" | "docker"
  onTriggerDocker: () => void
  onShowResults?: () => void
}

export function PreviewControls({ chatId, currentMode, onTriggerDocker, onShowResults }: PreviewControlsProps) {
  const [validationStatus, setValidationStatus] = useState<string>("pending")
  const [validationResults, setValidationResults] = useState<any>(null)
  const [isPolling, setIsPolling] = useState(true)

  useEffect(() => {
    if (!isPolling) return

    const pollValidation = async () => {
      try {
        const response = await fetch(`/api/preview/validate?chatId=${chatId}`)
        const data = await response.json()

        setValidationStatus(data.status || "pending")
        setValidationResults(data)

        // Stop polling if validation is complete
        if (data.status === "passed" || data.status === "failed" || data.status === "error") {
          setIsPolling(false)
        }
      } catch (error) {
        console.error("[v0] Failed to fetch validation results:", error)
      }
    }

    const interval = setInterval(pollValidation, 3000)
    pollValidation() // Initial fetch

    return () => clearInterval(interval)
  }, [chatId, isPolling])

  const getStatusIcon = () => {
    switch (validationStatus) {
      case "pending":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (validationStatus) {
      case "pending":
        return "Validation queued"
      case "running":
        return "Running tests..."
      case "passed":
        return `${validationResults?.passed || 0} tests passed`
      case "failed":
        return `${validationResults?.failed || 0} tests failed`
      case "error":
        return "Validation error"
      default:
        return "Unknown status"
    }
  }

  const getStatusColor = () => {
    switch (validationStatus) {
      case "passed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "running":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "error":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
      {/* Preview Mode Badge */}
      <Badge variant="outline" className="gap-1.5">
        {currentMode === "iframe" ? (
          <>
            <PlayCircle className="h-3 w-3" />
            Fast Preview
          </>
        ) : (
          <>
            <Container className="h-3 w-3" />
            Docker Preview
          </>
        )}
      </Badge>

      {/* Validation Status */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1.5 ${getStatusColor()} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={onShowResults}
            >
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              {validationStatus === "passed" && (
                <div>
                  <p className="font-medium">All tests passed!</p>
                  <p className="text-muted-foreground">{validationResults?.total || 0} tests completed</p>
                </div>
              )}
              {validationStatus === "failed" && (
                <div>
                  <p className="font-medium">Some tests failed</p>
                  <p className="text-muted-foreground">
                    {validationResults?.passed || 0} passed, {validationResults?.failed || 0} failed
                  </p>
                </div>
              )}
              {validationStatus === "running" && <p>Running Playwright tests in background...</p>}
              {validationStatus === "pending" && <p>Validation will start shortly...</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1" />

      {(validationStatus === "passed" || validationStatus === "failed") && onShowResults && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onShowResults} className="gap-2">
                <FileText className="h-4 w-4" />
                View Results
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View detailed test results and screenshots</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Manual Docker Trigger */}
      {currentMode === "iframe" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onTriggerDocker} className="gap-2 bg-transparent">
                <Container className="h-4 w-4" />
                Switch to Docker
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Run preview in Docker container with full debugging</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
