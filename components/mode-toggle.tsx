"use client"

import { useState, useEffect } from "react"
import { getMode, setMode } from "@/lib/utils/cookies"
import { Code2, Wrench } from "lucide-react"

interface ModeToggleProps {
  initialMode?: "build" | "features"
  onChange?: (mode: "build" | "features") => void
}

export function ModeToggle({ initialMode, onChange }: ModeToggleProps) {
  const [mode, setModeState] = useState<"build" | "features">(() => {
    if (typeof window !== "undefined") {
      return getMode()
    }
    return initialMode || "features"
  })

  useEffect(() => {
    const savedMode = getMode()
    if (savedMode !== mode) {
      setModeState(savedMode)
    }
  }, [initialMode])

  const handleModeChange = (newMode: "build" | "features") => {
    setModeState(newMode)
    setMode(newMode)
    onChange?.(newMode)
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-1">
      <button
        onClick={() => handleModeChange("build")}
        className={`
          inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all
          ${
            mode === "build"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }
        `}
      >
        <Code2 className="h-4 w-4" />
        Build
      </button>
      <button
        onClick={() => handleModeChange("features")}
        className={`
          inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all
          ${
            mode === "features"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }
        `}
      >
        <Wrench className="h-4 w-4" />
        Features
      </button>
    </div>
  )
}
