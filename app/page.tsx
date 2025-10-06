import { cookies } from "next/headers"
import { HomePageContent } from "@/components/home-page-content"
import { HomeClient } from "@/components/v0/home/home-client"
import { getModeFromCookie } from "@/lib/utils/cookies"

export default async function Home() {
  const cookieStore = await cookies()
  const selectedOwner = cookieStore.get("selected-owner")?.value || ""
  const selectedRepo = cookieStore.get("selected-repo")?.value || ""
  const installDependencies = cookieStore.get("install-dependencies")?.value === "true"
  const maxDuration = Number.parseInt(cookieStore.get("max-duration")?.value || "5", 10)

  const mode = getModeFromCookie(cookieStore.toString())

  if (mode === "build") {
    return <HomeClient />
  }

  return (
    <HomePageContent
      initialSelectedOwner={selectedOwner}
      initialSelectedRepo={selectedRepo}
      initialInstallDependencies={installDependencies}
      initialMaxDuration={maxDuration}
    />
  )
}
