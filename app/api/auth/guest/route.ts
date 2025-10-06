import { redirect } from "next/navigation"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirectUrl = url.searchParams.get("redirectUrl")

  // Auth is disabled, just redirect to the requested URL or home

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  redirect("/")
}
