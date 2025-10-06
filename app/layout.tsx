import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import { StreamingProvider } from '@/contexts/streaming-context'
import { SWRProvider } from '@/components/v0/providers/swr-provider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Coding Agent Template',
  description:
    'AI-powered coding agent template supporting Claude Code, OpenAI Codex CLI, Cursor CLI, and opencode with Vercel Sandbox',
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SWRProvider>
            <StreamingProvider>
              <AppLayoutWrapper>{children}</AppLayoutWrapper>
              <Toaster />
            </StreamingProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
