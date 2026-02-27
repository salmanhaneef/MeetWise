// app/(root)/(home)/dashboard/components/PreviousMeetings.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  Archive, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  streamCallId: string;
  title: string;
  description?: string;
  scheduledFor: string;
  duration: number;
  status: string;
  hostId: string;
  recordingUrl?: string;
  host: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  totalParticipants: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 }
};

export default function PreviousMeetings() {
  const { user } = useUser();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchPreviousMeetings();
  }, [user]);

  const fetchPreviousMeetings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/meeting/previous');
      const data = await response.json();
      if (data.success) setMeetings(data.meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/20',
          label: 'Completed'
        };
      case 'CANCELLED':
        return {
          icon: XCircle,
          bg: 'bg-rose-500/10',
          text: 'text-rose-400',
          border: 'border-rose-500/20',
          label: 'Cancelled'
        };
      default:
        return {
          icon: Archive,
          bg: 'bg-slate-500/10',
          text: 'text-slate-400',
          border: 'border-slate-500/20',
          label: status
        };
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 h-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded-xl w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden h-full">
      {/* Header - Same style as UpcomingMeetings */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Archive className="w-6 h-6 text-violet-400" />
            Past Meetings
          </h2>
          <p className="text-blue-200/60 mt-1">
            {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"} completed
          </p>
        </div>
        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <Archive className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Meetings List - Same card style as Upcoming */}
      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {meetings.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                <Archive className="w-10 h-10 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No past meetings</h3>
              <p className="text-blue-200/50">Your completed meetings will appear here</p>
            </motion.div>
          ) : (
            meetings.map((meeting) => {
              const statusConfig = getStatusConfig(meeting.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div
                  key={meeting.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  whileHover={{ scale: 1.01, x: 5 }}
                  className="group relative p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/30 hover:bg-white/[0.07] transition-all duration-300"
                >
                  {/* Meeting Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-violet-200 transition-colors line-clamp-1">
                          {meeting.title}
                        </h3>
                        <span className={`flex items-center gap-1.5 px-3 py-1 ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} rounded-full text-xs font-bold`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </span>
                      </div>
                      {meeting.description && (
                        <p className="text-sm text-blue-200/60 line-clamp-2 mb-3">
                          {meeting.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meeting Info - Same grid style as Upcoming */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                      <Calendar className="w-4 h-4 text-violet-400" />
                      <span>{format(new Date(meeting.scheduledFor), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>{format(new Date(meeting.scheduledFor), "hh:mm a")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>{meeting.totalParticipants} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span>{meeting.duration} min</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    {meeting.recordingUrl && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold">
                        <Video className="w-3.5 h-3.5" />
                        Recorded
                      </span>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/meeting-info/${meeting.streamCallId}`)}
                      className="flex items-center gap-2 ml-auto px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/25 transition-all"
                    >
                      Details
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}