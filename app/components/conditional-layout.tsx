"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "./app-sidebar";
import Navbar from "./Navbar";
import { useState, useEffect } from "react";
import { DashboardProvider, useDashboard } from "./DashboardContext";
import CreateMeetingModal from "@/app/(root)/(home)/dashboard/components/CreateMeetingModal";
import InviteParticipantModal from "@/app/(root)/(home)/dashboard/components/InviteParticipantModal";

// Define routes where sidebar should be hidden (purely for UI, not auth)
const NO_SIDEBAR_ROUTES = ["/", "/sign-in", "/sign-up"];

// Inner component - UI only, no auth checks
function ConditionalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Get dashboard state from context
  const {
    isCreateMeetingOpen,
    setIsCreateMeetingOpen,
    isInviteModalOpen,
    setIsInviteModalOpen,
    selectedMeeting,
    handleInviteClick,
  } = useDashboard();

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Determine if sidebar should be shown (purely UI-based)
  const showSidebar = !NO_SIDEBAR_ROUTES.includes(pathname);

  // Render without sidebar for public/marketing pages
  if (!showSidebar) {
    return (
      <div className="min-h-svh">
        {children}
        {/* Modals still available if context triggers them */}
        <CreateMeetingModal
          isOpen={isCreateMeetingOpen}
          onClose={() => setIsCreateMeetingOpen(false)}
        />
        <InviteParticipantModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          meetingId={selectedMeeting?.streamCallId || null}
        />
      </div>
    );
  }

  // Render full app layout with sidebar + navbar
  return (
    <SidebarProvider 
      defaultOpen={!isMobile}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
    >
      <div className="flex min-h-svh w-full">
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
        
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            onCreateMeeting={() => setIsCreateMeetingOpen(true)}
            onInviteParticipant={handleInviteClick}
            hasSelectedMeeting={!!selectedMeeting}
          />
          <main className="flex-1 overflow-auto p-4 ml-14 lg:ml-0 lg:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Global Modals - Controlled by dashboard context */}
      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
      />
      <InviteParticipantModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        meetingId={selectedMeeting?.streamCallId || null}
      />
    </SidebarProvider>
  );
}

// Wrapper with Provider
export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <ConditionalLayoutInner>{children}</ConditionalLayoutInner>
    </DashboardProvider>
  );
}