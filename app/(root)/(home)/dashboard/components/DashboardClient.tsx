// app/(root)/(home)/dashboard/components/DashboardClient.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useDashboard } from '@/app/components/DashboardContext';
import UpcomingMeetings from './UpcomingMeetings';
import PreviousMeetings from './PreviousMeetings';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Pin, CalendarDays } from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center text-white">
        Please sign in
      </div>
    );
  }

  const handleOpenInviteModal = (meetingId: string, streamCallId: string, title: string) => {
    setSelectedMeeting({ id: meetingId, streamCallId, title });
    setIsInviteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Dashboard Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 relative"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/25">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Dashboard
            </h1>
          </div>
          <p className="text-blue-200/70 text-lg ml-11">
            Welcome back, <span className="text-blue-100 font-semibold">{user.firstName || 'User'}</span>!
            <Sparkles className="inline-block w-4 h-4 ml-2 text-yellow-400 animate-pulse" />
          </p>
        </motion.div>

        {/* Selected Meeting Indicator */}
        <AnimatePresence>
          {selectedMeeting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, height: 0 }}
              animate={{ opacity: 1, scale: 1, height: 'auto' }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="relative p-5 rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 backdrop-blur-xl shadow-2xl shadow-blue-900/20">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-2xl" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-500/30 rounded-full animate-bounce">
                      <Pin className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-blue-100 font-semibold text-lg">
                        Selected: {selectedMeeting.title}
                      </p>
                      <p className="text-blue-300/70 text-sm mt-1">
                        Click invite button in navbar to add participants
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={clearSelectedMeeting}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all duration-300 backdrop-blur-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meetings Grid - Equal Height Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative items-start">
          {/* Upcoming Meetings */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <UpcomingMeetings 
              userId={user.id}
              onSelectMeeting={handleSelectMeeting}
              selectedMeetingId={selectedMeeting?.id}
              onOpenInviteModal={handleOpenInviteModal}
            />
          </motion.div>

          {/* Previous Meetings - Now matches Upcoming style */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <PreviousMeetings />
          </motion.div>
        </div>
      </div>
    </div>
  );
}