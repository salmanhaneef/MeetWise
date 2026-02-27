"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedMeeting {
  id: string;
  streamCallId: string;
  title: string;
}

interface DashboardContextType {
  // Modal states
  isCreateMeetingOpen: boolean;
  setIsCreateMeetingOpen: (open: boolean) => void;
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (open: boolean) => void;
  
  // Meeting selection
  selectedMeeting: SelectedMeeting | null;
  setSelectedMeeting: (meeting: SelectedMeeting | null) => void;
  handleSelectMeeting: (meeting: SelectedMeeting) => void;
  clearSelectedMeeting: () => void;
  
  // Invite handler
  handleInviteClick: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<SelectedMeeting | null>(null);

  const handleSelectMeeting = (meeting: SelectedMeeting) => {
    setSelectedMeeting(meeting);
    console.log("✅ Meeting selected:", meeting);
  };

  const clearSelectedMeeting = () => {
    setSelectedMeeting(null);
  };

  const handleInviteClick = () => {
    if (selectedMeeting) {
      setIsInviteModalOpen(true);
    } else {
      console.log("⚠️ No meeting selected - Please select a meeting first");
      // Optionally show a toast notification here
      alert("Please select a meeting first before inviting participants");
    }
  };

  const handleOpenInviteModal = (meetingId: string, streamCallId: string, title: string) => {
    setSelectedMeeting({ id: meetingId, streamCallId, title });
    setIsInviteModalOpen(true);
  };

  return (
    <DashboardContext.Provider
      value={{
        isCreateMeetingOpen,
        setIsCreateMeetingOpen,
        isInviteModalOpen,
        setIsInviteModalOpen,
        selectedMeeting,
        setSelectedMeeting,
        handleSelectMeeting,
        clearSelectedMeeting,
        handleInviteClick,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}