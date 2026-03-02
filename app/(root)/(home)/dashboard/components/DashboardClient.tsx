// app/(root)/(home)/dashboard/components/DashboardClient.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useDashboard } from '@/app/components/DashboardContext';
import UpcomingMeetings from './UpcomingMeetings';
import PreviousMeetings from './PreviousMeetings';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin, CalendarDays, Sparkles } from 'lucide-react';

export default function DashboardClient() {
  const { user, isLoaded } = useUser();
  
  const {
    selectedMeeting,
    handleSelectMeeting,
    clearSelectedMeeting,
    setIsInviteModalOpen,
    setSelectedMeeting,
  } = useDashboard();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Please sign in
      </div>
    );
  }

  const handleOpenInviteModal = (meetingId: string, streamCallId: string, title: string) => {
    setSelectedMeeting({ id: meetingId, streamCallId, title });
    setIsInviteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Dashboard Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <CalendarDays className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Dashboard
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Welcome back, <span className="text-slate-200 font-medium">{user.firstName || 'User'}</span>
                <Sparkles className="inline-block w-3.5 h-3.5 ml-1.5 text-yellow-500" />
              </p>
            </div>
          </div>
        </motion.div>

        {/* Selected Meeting Indicator */}
        <AnimatePresence>
          {selectedMeeting && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                      <Pin className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium text-sm">
                        Selected: {selectedMeeting.title}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Click invite button in navbar to add participants
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearSelectedMeeting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meetings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Meetings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <UpcomingMeetings 
              userId={user.id}
              onSelectMeeting={handleSelectMeeting}
              selectedMeetingId={selectedMeeting?.id}
              onOpenInviteModal={handleOpenInviteModal}
            />
          </motion.div>

          {/* Previous Meetings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <PreviousMeetings />
          </motion.div>
        </div>
      </div>
    </div>
  );
}