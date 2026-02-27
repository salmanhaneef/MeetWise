"use client";

import {
  Bot,
  DollarSign,
  Home,
  Layers3,
  LogOut,
  Video,
  X,
  Menu,
  Settings,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useUsage } from "@/app/contexts/UsageContext";
import { useClerk } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const items = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Integrations", url: "/integrations", icon: Layers3 },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Chat", url: "/chat", icon: Bot },
  { title: "Pricing", url: "/pricing", icon: DollarSign },
];

interface AppSidebarProps {
  isOpen?: boolean;
  onToggle: () => void;  // Changed from onClose to onToggle
  onClose: () => void;
}

// Mobile overlay backdrop
function MobileOverlay({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden transition-opacity duration-300"
      onClick={onClose}
    />
  );
}

// Compact Icon Bar for mobile/medium screens
function CompactIconBar({ 
  pathname, 
  onMenuClick, 
  onSignOut 
}: { 
  pathname: string; 
  onMenuClick: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="lg:hidden fixed left-0 top-[64px] bottom-0 w-16 z-[45] bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 border-r border-blue-800/50 flex flex-col items-center py-4 gap-2">
      {/* Menu Button at top */}
      <button
        onClick={onMenuClick}
        className="p-3 rounded-xl text-blue-300 hover:text-white hover:bg-blue-800/50 transition-all duration-200 active:scale-95 mb-2"
        title="Open Menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="w-8 h-px bg-blue-800/50 mb-2" />

      {/* Nav Icons */}
      {items.map((item) => (
        <Link
          key={item.title}
          href={item.url}
          title={item.title}
          className={`p-3 rounded-xl transition-all duration-200 active:scale-95 ${
            pathname === item.url
              ? 'text-white bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30'
              : 'text-blue-300 hover:text-white hover:bg-blue-800/30'
          }`}
        >
          <item.icon className="w-5 h-5" />
        </Link>
      ))}

      <div className="flex-1" />

      {/* Sign Out at bottom */}
      <button
        onClick={onSignOut}
        title="Sign Out"
        className="p-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-all duration-200 active:scale-95 mb-2"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}

export function AppSidebar({ isOpen = false, onToggle, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { usage, limits, loading } = useUsage();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut();
  };

  const meetingProgress =
    usage && limits?.meetings !== undefined && limits.meetings !== -1
      ? Math.min((usage.meetingsThisMonth / limits.meetings) * 100, 100)
      : 0;

  const chatProgress =
    usage && limits?.chatMessages !== undefined && limits.chatMessages !== -1
      ? Math.min((usage.chatMessagesToday / limits.chatMessages) * 100, 100)
      : 0;

  const getUpgradeInfo = () => {
    if (!usage) return null;
    switch (usage.currentPlan) {
      case "free":
        return {
          title: "Upgrade to Starter",
          description: "Get 10 meetings per month and 30 daily chat messages",
          showButton: true,
        };
      case "starter":
        return {
          title: "Upgrade to Pro",
          description: "Get 30 meetings per month and 100 daily chat messages",
          showButton: true,
        };
      case "pro":
        return {
          title: "Upgrade to Premium",
          description: "Get unlimited meetings and chat messages",
          showButton: true,
        };
      case "premium":
        return {
          title: "You're on Premium!",
          description: "Enjoy unlimited access to all features",
          showButton: false,
        };
      default:
        return {
          title: "Upgrade Your Plan",
          description: "Get access to more features",
          showButton: true,
        };
    }
  };

  const upgradeInfo = getUpgradeInfo();

  return (
    <>
      <MobileOverlay isOpen={isOpen} onClose={onClose} />
      
      {/* Compact Icon Bar - Visible when sidebar is closed on mobile */}
      {!isOpen && (
        <CompactIconBar 
          pathname={pathname} 
          onMenuClick={onToggle}  // Use onToggle here
          onSignOut={handleSignOut} 
        />
      )}

      {/* Full Sidebar */}
      <Sidebar
        collapsible="none"
        className={`border-r border-sidebar-border flex flex-col bg-sidebar-background transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-64 fixed shadow-2xl z-[110] lg:h-screen lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          w-72 top-[64px] h-[calc(100vh-64px)] lg:top-0 left-0
        `}
      >
        {/* Mobile Header with Close button */}
        <div className="lg:hidden border-b border-sidebar-border p-4 shrink-0 flex items-center justify-between bg-gradient-to-r from-sidebar-background to-sidebar-accent/20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">
              MeetWise
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors duration-200 group"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-sidebar-foreground group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Desktop Header */}
        <SidebarHeader className="hidden lg:flex border-b border-sidebar-border p-4 shrink-0 items-center justify-between bg-gradient-to-r from-sidebar-background to-sidebar-accent/20">
          <div
            className="flex px-3 cursor-pointer items-center gap-2 group"
            onClick={() => router.push("/")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-transparent">
              MeetWise
            </span>
          </div>
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="w-full justify-start gap-3 cursor-pointer rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-md"
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* FOOTER */}
        <SidebarFooter className="p-4 border-t border-sidebar-border shrink-0 space-y-3">
          {loading && (
            <div className="rounded-xl bg-sidebar-accent/50 p-3 animate-pulse space-y-3">
              <div className="h-3 bg-sidebar-accent rounded w-24" />
              <div className="h-2 bg-sidebar-accent rounded w-full" />
              <div className="h-2 bg-sidebar-accent rounded w-3/4" />
            </div>
          )}

          {!loading && usage && (
            <div className="rounded-xl bg-gradient-to-br from-sidebar-accent/50 to-sidebar-accent/30 p-3 border border-sidebar-accent">
              <p className="text-xs font-bold text-sidebar-accent-foreground mb-3 uppercase tracking-wider">
                {usage.currentPlan} Plan
              </p>
              
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sidebar-accent-foreground/70">Meetings</span>
                  <span className="font-medium text-sidebar-accent-foreground">
                    {usage.meetingsThisMonth}/
                    {limits.meetings === -1 ? "∞" : limits.meetings}
                  </span>
                </div>
                {limits.meetings !== -1 ? (
                  <div className="w-full bg-sidebar-accent/30 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${meetingProgress}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-500 font-medium">Unlimited</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sidebar-accent-foreground/70">Chat</span>
                  <span className="font-medium text-sidebar-accent-foreground">
                    {usage.chatMessagesToday}/
                    {limits.chatMessages === -1 ? "∞" : limits.chatMessages}
                  </span>
                </div>
                {limits.chatMessages !== -1 ? (
                  <div className="w-full bg-sidebar-accent/30 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${chatProgress}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-500 font-medium">Unlimited</div>
                )}
              </div>
            </div>
          )}

          {!loading && upgradeInfo && upgradeInfo.showButton && (
            <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-3 border border-indigo-200/50">
              <p className="text-sm font-semibold text-sidebar-foreground mb-1">
                {upgradeInfo.title}
              </p>
              <p className="text-xs text-sidebar-foreground/60 mb-3 line-clamp-2">
                {upgradeInfo.description}
              </p>
              <Link href="/pricing">
                <Button className="w-full rounded-lg cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl text-sidebar-foreground/70 hover:text-red-600 hover:bg-red-50 transition-all duration-200 w-full group"
          >
            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}