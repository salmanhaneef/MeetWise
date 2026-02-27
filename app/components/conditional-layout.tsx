'use client'

import { SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { AppSidebar } from "./app-sidebar"
import Navbar from "./Navbar"
import { useState, useEffect } from "react"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const showSidebar =
    isSignedIn &&
    pathname !== "/" &&
    !(pathname.startsWith("/meeting/") && !isSignedIn)

  if (!showSidebar) {
    return <div className="min-h-svh">{children}</div>
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full">
        <AppSidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(true)}  // Open sidebar
          onClose={() => setSidebarOpen(false)}   // Close sidebar
        />
        
        {/* Main content with left margin on mobile for icon bar */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isMobile && !sidebarOpen ? 'ml-16' : ''
        }`}>
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            onCreateMeeting={() => {/* your logic */}}
            onInviteParticipant={() => {/* your logic */}}
          />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}