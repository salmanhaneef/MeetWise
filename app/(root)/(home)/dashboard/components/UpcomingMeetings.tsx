"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Calendar, Clock, Users, Copy, Edit, Trash2, Video, UserPlus, X, Save,
  Sparkles, ArrowRight, MoreVertical
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Meeting {
  id: string;
  streamCallId: string;
  title: string;
  description: string | null;
  scheduledFor: string;
  duration: number;
  status: string;
  totalParticipants: number;
  hostId: string;
  host: {
    id: string;
    clerkId?: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

interface UpcomingMeetingsProps {
  userId: string;
  onSelectMeeting?: (meeting: { id: string; streamCallId: string; title: string }) => void;
  selectedMeetingId?: string;
  onOpenInviteModal?: (meetingId: string, streamCallId: string, title: string) => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 }
};

export default function UpcomingMeetings({ 
  userId, 
  onSelectMeeting,
  selectedMeetingId,
  onOpenInviteModal 
}: UpcomingMeetingsProps) {
  const { user } = useUser();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [meetingToUpdate, setMeetingToUpdate] = useState<Meeting | null>(null);
  const [updateForm, setUpdateForm] = useState({
    title: "",
    description: "",
    scheduledFor: "",
    duration: 30,
  });
  const [updatingMeeting, setUpdatingMeeting] = useState(false);

  useEffect(() => {
    fetchUpcomingMeetings();
  }, [userId]);

  const fetchUpcomingMeetings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/meeting/upcoming?testUserId=${userId}`);
      const data = await response.json();
      if (data.success) setMeetings(data.meetings);
    } catch (error) {
      toast.error("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (meeting: Meeting) => {
    setMeetingToUpdate(meeting);
    const scheduledDate = new Date(meeting.scheduledFor);
    setUpdateForm({
      title: meeting.title,
      description: meeting.description || "",
      scheduledFor: format(scheduledDate, "yyyy-MM-dd'T'HH:mm"),
      duration: meeting.duration,
    });
    setUpdateModalOpen(true);
  };

  const handleUpdateMeeting = async () => {
    if (!meetingToUpdate) return;
    if (!updateForm.title.trim()) return toast.error("Title is required");
    
    setUpdatingMeeting(true);
    try {
      const response = await fetch(`/api/meeting?testUserId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meetingToUpdate.id,
          ...updateForm,
          scheduledFor: new Date(updateForm.scheduledFor).toISOString(),
        }),
      });
      
      if (response.ok) {
        toast.success("Meeting updated!");
        setUpdateModalOpen(false);
        fetchUpcomingMeetings();
      }
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setUpdatingMeeting(false);
    }
  };

  const copyMeetingLink = (streamCallId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${streamCallId}`);
    toast.success("Link copied!");
  };

  const handleDelete = async (meeting: Meeting) => {
    if (!confirm(`Delete "${meeting.title}"?`)) return;
    try {
      await fetch(`/api/meeting?meetingId=${meeting.id}&testUserId=${userId}`, { method: "DELETE" });
      toast.success("Meeting deleted");
      fetchUpcomingMeetings();
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const joinMeeting = (streamCallId: string) => {
    window.open(`/meeting/${streamCallId}`, "_blank");
  };

  const isHost = (meeting: Meeting) => {
    if (meeting.host?.clerkId) {
      return meeting.host.clerkId === user?.id || meeting.host.clerkId === userId;
    }
    return meeting.host?.id === userId;
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded-xl w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-white/5 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Upcoming Meetings
            </h2>
            <p className="text-blue-200/60 mt-1">
              {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"} scheduled
            </p>
          </div>
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <Calendar className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Meetings List */}
        <div className="p-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {meetings.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No upcoming meetings</h3>
                <p className="text-blue-200/50">Schedule your first meeting</p>
              </motion.div>
            ) : (
              meetings.map((meeting) => {
                const isSelected = selectedMeetingId === meeting.id;
                const host = isHost(meeting);
                
                return (
                  <motion.div
                    key={meeting.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className={`relative p-5 rounded-2xl border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-400/50 shadow-2xl shadow-blue-500/20' 
                        : 'bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/[0.07]'
                    }`}
                  >
                    {/* Selected Indicator */}
                    {isSelected && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Sparkles className="w-3 h-3 text-white" />
                      </motion.div>
                    )}

                    {/* Meeting Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white group-hover:text-blue-200 transition-colors">
                            {meeting.title}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            meeting.status === "ONGOING"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}>
                            {meeting.status}
                          </span>
                        </div>
                        {meeting.description && (
                          <p className="text-sm text-blue-200/60 line-clamp-2">{meeting.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Meeting Info */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span>{format(new Date(meeting.scheduledFor), "MMM dd")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>{format(new Date(meeting.scheduledFor), "hh:mm a")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-200/70 bg-white/5 p-2 rounded-lg col-span-2">
                        <Users className="w-4 h-4 text-violet-400" />
                        <span>{meeting.totalParticipants} participants • {meeting.duration} min</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => joinMeeting(meeting.streamCallId)}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all"
                      >
                        <Video className="w-4 h-4" />
                        Join
                      </motion.button>

                      {host && (
                        <>
                          {!isSelected && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => onSelectMeeting?.({
                                id: meeting.id,
                                streamCallId: meeting.streamCallId,
                                title: meeting.title
                              })}
                              className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                            >
                              <UserPlus className="w-4 h-4" />
                              Select
                            </motion.button>
                          )}
                          
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onOpenInviteModal?.(meeting.id, meeting.streamCallId, meeting.title)}
                            className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                          >
                            <UserPlus className="w-4 h-4" />
                            Invite
                          </motion.button>

                          <div className="flex gap-2 ml-auto">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => copyMeetingLink(meeting.streamCallId)}
                              className="p-2 bg-white/5 hover:bg-white/10 text-blue-300 rounded-lg transition-colors"
                              title="Copy link"
                            >
                              <Copy className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => openUpdateModal(meeting)}
                              className="p-2 bg-white/5 hover:bg-white/10 text-indigo-300 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(meeting)}
                              className="p-2 bg-white/5 hover:bg-rose-500/20 text-rose-300 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Update Modal */}
      <AnimatePresence>
        {updateModalOpen && meetingToUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-indigo-600/20">
                <div>
                  <h3 className="text-xl font-bold text-white">Update Meeting</h3>
                  <p className="text-blue-200/60 text-sm">Edit meeting details</p>
                </div>
                <button type="button" onClick={() => setUpdateModalOpen(false)} title="Close" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Title *</label>
                  <input
                    type="text"
                    value={updateForm.title}
                    onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Meeting title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Description</label>
                  <textarea
                    value={updateForm.description}
                    onChange={(e) => setUpdateForm({ ...updateForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Add description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={updateForm.scheduledFor}
                      onChange={(e) => setUpdateForm({ ...updateForm, scheduledFor: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      title="Select date and time for the meeting"
                      aria-label="Meeting date and time"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">Duration (min) *</label>
                    <input
                      type="number"
                      value={updateForm.duration}
                      onChange={(e) => setUpdateForm({ ...updateForm, duration: parseInt(e.target.value) || 30 })}
                      min="15"
                      step="15"
                      placeholder="Meeting duration in minutes"
                      aria-label="Meeting duration in minutes"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex gap-3 bg-white/5">
                <button
                  onClick={() => setUpdateModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateMeeting}
                  disabled={updatingMeeting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingMeeting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    </motion.div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}