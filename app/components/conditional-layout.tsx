'use client'

import { SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { AppSidebar } from "./app-sidebar"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()

  const showSidebar =
    pathname !== "/" &&
    !(pathname.startsWith("/meeting/") && !isSignedIn)

  if (!showSidebar) {
    return <div className="min-h-svh">{children}</div>
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}