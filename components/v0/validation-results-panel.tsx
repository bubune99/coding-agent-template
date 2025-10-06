"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"

interface ValidationResult {
  status: "passed" | "failed" | "running"
  totalTests: number
  passedTests: number
  failedTests: number
  tests: Array<{
    name: string
    status: "passed" | "failed"
    error?: string
    duration?: number
  }>
  screenshots?: Array<{
    name: string
    url: string
  }>
}

interface ValidationResultsPanelProps {
  chatId: string
  onClose?: () => void
}

export function ValidationResultsPanel({ chatId, onClose }: ValidationResultsPanelProps) {
  const [results, setResults] = useState<ValidationResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/preview/validate?chatId=${chatId}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results)
        }
      } catch (error) {
        console.error("[v0] Error fetching validation results:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [chatId])

  if (isLoading) {
    return (
      <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-900 dark:text-blue-100">Running validation tests...</span>
        </div>
      </Card>
    )
  }

  if (!results) {
    return null
  }

  const statusIcon = {
    passed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
    running: <AlertCircle className="h-4 w-4 text-blue-600 animate-pulse" />,
  }[results.status]

  const statusColor = {
    passed: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    failed: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    running: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  }[results.status]

  return (
    <Card className={`p-4 ${statusColor}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="font-medium text-sm">
              Validation Results: {results.passedTests}/{results.totalTests} tests passed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-6 w-6 p-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-6 px-2 text-xs">
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-2">
            {/* Test Results */}
            <div className="space-y-1">
              {results.tests.map((test, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  {test.status === "passed" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{test.name}</div>
                    {test.error && (
                      <div className="text-xs text-red-700 dark:text-red-300 mt-1 font-mono">{test.error}</div>
                    )}
                    {test.duration && <div className="text-xs text-muted-foreground mt-1">{test.duration}ms</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Screenshots */}
            {results.screenshots && results.screenshots.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Screenshots</div>
                <div className="grid grid-cols-2 gap-2">
                  {results.screenshots.map((screenshot, index) => (
                    <a
                      key={index}
                      href={screenshot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border rounded overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <img src={screenshot.url || "/placeholder.svg"} alt={screenshot.name} className="w-full h-auto" />
                      <div className="text-xs p-1 bg-background/80 text-center">{screenshot.name}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
