"use client";

import { Bot, DollarSign, Home, Layers3, Play, Settings, Video } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUsage } from "@/app/contexts/UsageContext";
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
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const items = [
  { title: "Home", url: "/home", icon: Home },
  { title: "Integrations", url: "/integrations", icon: Layers3 },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Chat with AI", url: "/chat", icon: Bot },
  { title: "Pricing", url: "/pricing", icon: DollarSign },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { usage, limits, loading } = useUsage();
  const { userId, isLoaded } = useAuth();

  // ─── DEBUG STATE ───────────────────────────────────────────────


  useEffect(() => {
    console.log("🔍 [Sidebar] loading:", loading);
    console.log("🔍 [Sidebar] usage:", usage);
    console.log("🔍 [Sidebar] limits:", limits);
    console.log("🔍 [Sidebar] userId:", userId);
    console.log("🔍 [Sidebar] isLoaded:", isLoaded);
  }, [loading, usage, limits, userId, isLoaded]);

  
  // ─── END DEBUG ─────────────────────────────────────────────────

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
        return { title: "Upgrade to Starter", description: "Get 10 meetings per month and 30 daily chat messages", showButton: true };
      case "starter":
        return { title: "Upgrade to Pro", description: "Get 30 meetings per month and 100 daily chat messages", showButton: true };
      case "pro":
        return { title: "Upgrade to Premium", description: "Get unlimited meetings and chat messages", showButton: true };
      case "premium":
        return { title: "You're on Premium!", description: "Enjoy unlimited access to all features", showButton: false };
      default:
        return { title: "Upgrade Your Plan", description: "Get access to more features", showButton: true };
    }
  };

  const upgradeInfo = getUpgradeInfo();

  return (
    <Sidebar collapsible="none" className="h-screen border-r border-sidebar-border flex flex-col">
      {/* HEADER */}
      <SidebarHeader className="border-b border-sidebar-border p-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sidebar-primary-foreground">
            <Video className="w-4 h-4" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">MeetWise</span>
        </div>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent className="flex-1 overflow-y-auto p-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
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
      <SidebarFooter className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-sidebar-foreground">MeetWise</span>
        </div>

    

        {loading && (
          <div className="rounded-lg bg-sidebar-accent/50 p-3 mb-3 animate-pulse">
            <div className="h-3 bg-sidebar-accent rounded w-24 mb-3" />
            <div className="h-2 bg-sidebar-accent rounded w-full mb-2" />
            <div className="h-2 bg-sidebar-accent rounded w-3/4 mb-4" />
            <div className="h-2 bg-sidebar-accent rounded w-full mb-2" />
            <div className="h-2 bg-sidebar-accent rounded w-3/4" />
          </div>
        )}

        {!loading && usage && (
          <div className="rounded-lg bg-sidebar-accent/50 p-3 mb-3">
            <p className="text-xs font-medium text-sidebar-accent-foreground mb-3">
              Current Plan: {usage.currentPlan.toUpperCase()}
            </p>
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-sidebar-accent-foreground/70">Meetings</span>
                <span className="text-xs text-sidebar-accent-foreground/70">
                  {usage.meetingsThisMonth}/{limits.meetings === -1 ? "∞" : limits.meetings}
                </span>
              </div>
              {limits.meetings !== -1 && (
                <div className="w-full bg-sidebar-accent/30 rounded-full h-2">
                  <div className="bg-sidebar-primary h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${meetingProgress}%` }} />
                </div>
              )}
              {limits.meetings === -1 && (
                <div className="text-xs text-sidebar-accent-foreground/50 italic">Unlimited</div>
              )}
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-sidebar-accent-foreground/70">Chat Messages</span>
                <span className="text-xs text-sidebar-accent-foreground/70">
                  {usage.chatMessagesToday}/{limits.chatMessages === -1 ? "∞" : limits.chatMessages}
                </span>
              </div>
              {limits.chatMessages !== -1 && (
                <div className="w-full bg-sidebar-accent/30 rounded-full h-2">
                  <div className="bg-sidebar-primary h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${chatProgress}%` }} />
                </div>
              )}
              {limits.chatMessages === -1 && (
                <div className="text-xs text-sidebar-accent-foreground/50 italic">Unlimited</div>
              )}
            </div>
          </div>
        )}

        {!loading && upgradeInfo && (
          <div className="rounded-lg bg-sidebar-accent p-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-sidebar-accent-foreground">{upgradeInfo.title}</p>
                <p className="text-xs text-sidebar-accent-foreground/70">{upgradeInfo.description}</p>
              </div>
              {upgradeInfo.showButton && (
                <Link href="/pricing">
                  <Button className="w-full rounded-md bg-sidebar-primary px-3 py-2 text-xs font-medium text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90 cursor-pointer">
                    {upgradeInfo.title}
                  </Button>
                </Link>
              )}
              {!upgradeInfo.showButton && (
                <div className="text-center py-2">
                  <span className="text-xs text-sidebar-accent-foreground/60">🎉 Thank you for your support!</span>
                </div>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}