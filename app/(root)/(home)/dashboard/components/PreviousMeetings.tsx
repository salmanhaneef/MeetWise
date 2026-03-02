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
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-800 rounded w-1/4"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-violet-400" />
              Past Meetings
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"} completed
            </p>
          </div>
          <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20">
            <Archive className="w-5 h-5 text-violet-400" />
          </div>
        </div>
      </div>

      {/* Meetings List - Simple List Format */}
      <div className="divide-y divide-slate-800">
        <AnimatePresence mode="popLayout">
          {meetings.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
                <Archive className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No past meetings</h3>
              <p className="text-slate-400 text-sm">Your completed meetings will appear here</p>
            </motion.div>
          ) : (
            meetings.map((meeting) => {
              const statusConfig = getStatusConfig(meeting.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 hover:bg-slate-800/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title and Status */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white truncate">
                          {meeting.title}
                        </h3>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} rounded-full text-xs font-medium`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Description */}
                      {meeting.description && (
                        <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                          {meeting.description}
                        </p>
                      )}

                      {/* Meeting Details - Grid Layout */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Calendar className="w-4 h-4 text-violet-400" />
                          <span>{format(new Date(meeting.scheduledFor), "MMM dd, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Clock className="w-4 h-4 text-indigo-400" />
                          <span>{format(new Date(meeting.scheduledFor), "hh:mm a")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Users className="w-4 h-4 text-blue-400" />
                          <span>{meeting.totalParticipants} participants</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          <span>{meeting.duration} min</span>
                        </div>
                      </div>

                      {/* Recording Badge if available */}
                      {meeting.recordingUrl && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-rose-400">
                          <Video className="w-4 h-4" />
                          <span>Recorded</span>
                        </div>
                      )}
                    </div>

                    {/* Details Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push(`/meeting-info/${meeting.streamCallId}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
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