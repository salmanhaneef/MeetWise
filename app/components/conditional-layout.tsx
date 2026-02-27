"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@clerk/nextjs";
import { useUser } from '@clerk/nextjs';
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import Navbar from "./Navbar";
import { useState, useEffect } from "react";
import { DashboardProvider, useDashboard } from "./DashboardContext";
import CreateMeetingModal from "@/app/(root)/(home)/dashboard/components/CreateMeetingModal";
import InviteParticipantModal from "@/app/(root)/(home)/dashboard/components/InviteParticipantModal";

// Inner component that uses context
function ConditionalLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please sign in</div>;
  }

  const showSidebar =
    isSignedIn &&
    pathname !== "/" &&
    !(pathname.startsWith("/meeting/") && !isSignedIn);

  if (!showSidebar) {
    return <div className="min-h-svh">{children}</div>;
  }

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

      {/* Global Modals - Controlled by context */}
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