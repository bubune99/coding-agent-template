'use client'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HardDrive, Cloud } from 'lucide-react'
import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'

export type ExecutionMode = 'docker' | 'vercel'

export function ExecutionModeToggle() {
  const [mode, setMode] = useState<ExecutionMode>('vercel')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    // Read from cookie on mount
    const savedMode = Cookies.get('execution_mode') as ExecutionMode | undefined
    if (savedMode === 'docker' || savedMode === 'vercel') {
      setMode(savedMode)
    }
  }, [])

  const handleModeChange = (newMode: ExecutionMode) => {
    setMode(newMode)
    // Save to cookie
    Cookies.set('execution_mode', newMode, { expires: 365 })
  }

  if (!isClient) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vercel">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    <span>Cloud (Vercel)</span>
                  </div>
                </SelectItem>
                <SelectItem value="docker">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>Local (Docker)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {mode === 'docker' && (
              <Badge variant="outline" className="text-xs">
                Local
              </Badge>
            )}
            {mode === 'vercel' && (
              <Badge variant="outline" className="text-xs">
                Cloud
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">Execution Mode</p>
            <p className="text-sm text-muted-foreground">
              {mode === 'vercel'
                ? 'Using Vercel Sandbox (cloud-based, requires tokens)'
                : 'Using Docker (local development, requires Docker installed)'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
