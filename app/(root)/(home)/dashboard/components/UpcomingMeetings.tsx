// app/(root)/(home)/dashboard/components/UpcomingMeetings.tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Calendar,
  Clock,
  Users,
  Copy,
  Edit,
  Trash2,
  Video,
  UserPlus,
  X,
  Save,
  Sparkles,
  CheckCircle2,
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
  onSelectMeeting?: (meeting: {
    id: string;
    streamCallId: string;
    title: string;
  }) => void;
  selectedMeetingId?: string;
  onOpenInviteModal?: (
    meetingId: string,
    streamCallId: string,
    title: string,
  ) => void;
}

export default function UpcomingMeetings({
  userId,
  onSelectMeeting,
  selectedMeetingId,
  onOpenInviteModal,
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
      const response = await fetch(
        `/api/meeting/upcoming?testUserId=${userId}`,
      );
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
    navigator.clipboard.writeText(
      `${window.location.origin}/meeting/${streamCallId}`,
    );
    toast.success("Link copied!");
  };

  const handleDelete = async (meeting: Meeting) => {
    if (!confirm(`Delete "${meeting.title}"?`)) return;
    try {
      await fetch(`/api/meeting?meetingId=${meeting.id}&testUserId=${userId}`, {
        method: "DELETE",
      });
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
      return (
        meeting.host.clerkId === user?.id || meeting.host.clerkId === userId
      );
    }
    return meeting.host?.id === userId;
  };

  if (loading) {
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
    <>
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles
                  className="w-5 h-5 text-yellow-400"
                  aria-hidden="true"
                />
                Upcoming Meetings
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {meetings.length}{" "}
                {meetings.length === 1 ? "meeting" : "meetings"} scheduled
              </p>
            </div>
            <div
              className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20"
              aria-hidden="true"
            >
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Meetings List */}
        <div className="divide-y divide-slate-800">
          <AnimatePresence mode="popLayout">
            {meetings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Calendar className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  No upcoming meetings
                </h3>
                <p className="text-slate-400 text-sm">
                  Schedule your first meeting
                </p>
              </motion.div>
            ) : (
              meetings.map((meeting) => {
                const isSelected = selectedMeetingId === meeting.id;
                const host = isHost(meeting);

                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-6 transition-colors ${
                      isSelected ? "bg-blue-500/5" : "hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Title and Status */}
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-base font-semibold text-white truncate">
                            {meeting.title}
                          </h3>
                          <span
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              meeting.status === "ONGOING"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            <CheckCircle2
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                            {meeting.status}
                          </span>
                        </div>

                        {/* Description */}
                        {meeting.description && (
                          <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                            {meeting.description}
                          </p>
                        )}

                        {/* Meeting Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Calendar
                              className="w-4 h-4 text-blue-400"
                              aria-hidden="true"
                            />
                            <span>
                              {format(
                                new Date(meeting.scheduledFor),
                                "MMM dd, yyyy",
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock
                              className="w-4 h-4 text-indigo-400"
                              aria-hidden="true"
                            />
                            <span>
                              {format(
                                new Date(meeting.scheduledFor),
                                "hh:mm a",
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Users
                              className="w-4 h-4 text-violet-400"
                              aria-hidden="true"
                            />
                            <span>
                              {meeting.totalParticipants} participants •{" "}
                              {meeting.duration} min
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() => joinMeeting(meeting.streamCallId)}
                            aria-label={`Join meeting: ${meeting.title}`}
                            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                          >
                            <Video className="w-4 h-4" aria-hidden="true" />
                            Join
                          </motion.button>

                          {host && (
                            <>
                              {!isSelected && (
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  type="button"
                                  onClick={() =>
                                    onSelectMeeting?.({
                                      id: meeting.id,
                                      streamCallId: meeting.streamCallId,
                                      title: meeting.title,
                                    })
                                  }
                                  aria-label={`Select meeting: ${meeting.title}`}
                                  className="flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                                >
                                  <UserPlus
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  Select
                                </motion.button>
                              )}

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() =>
                                  onOpenInviteModal?.(
                                    meeting.id,
                                    meeting.streamCallId,
                                    meeting.title,
                                  )
                                }
                                aria-label={`Invite people to: ${meeting.title}`}
                                className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                              >
                                <UserPlus
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                Invite
                              </motion.button>

                              <div className="flex gap-2 ml-auto">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  onClick={() =>
                                    copyMeetingLink(meeting.streamCallId)
                                  }
                                  aria-label={`Copy link for: ${meeting.title}`}
                                  title="Copy meeting link"
                                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                >
                                  <Copy
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  onClick={() => openUpdateModal(meeting)}
                                  aria-label={`Edit meeting: ${meeting.title}`}
                                  title="Edit meeting"
                                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                >
                                  <Edit
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  onClick={() => handleDelete(meeting)}
                                  aria-label={`Delete meeting: ${meeting.title}`}
                                  title="Delete meeting"
                                  className="p-2 bg-slate-800 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                                >
                                  <Trash2
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                </motion.button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-modal-title"
            aria-describedby="update-modal-description"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3
                    id="update-modal-title"
                    className="text-lg font-bold text-white"
                  >
                    Update Meeting
                  </h3>
                  <p
                    id="update-modal-description"
                    className="text-slate-400 text-sm"
                  >
                    Edit meeting details
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  aria-label="Close update meeting modal"
                  title="Close"
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label
                    htmlFor="update-meeting-title"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Title <span aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="update-meeting-title"
                    type="text"
                    value={updateForm.title}
                    onChange={(e) =>
                      setUpdateForm({ ...updateForm, title: e.target.value })
                    }
                    placeholder="Meeting title"
                    aria-required="true"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="update-meeting-description"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Description
                  </label>
                  <textarea
                    id="update-meeting-description"
                    value={updateForm.description}
                    onChange={(e) =>
                      setUpdateForm({
                        ...updateForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Add description..."
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date & Time */}
                  <div>
                    <label
                      htmlFor="update-meeting-scheduled-for"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Date &amp; Time <span aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <input
                      id="update-meeting-scheduled-for"
                      type="datetime-local"
                      value={updateForm.scheduledFor}
                      onChange={(e) =>
                        setUpdateForm({
                          ...updateForm,
                          scheduledFor: e.target.value,
                        })
                      }
                      title="Scheduled date and time"
                      aria-required="true"
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label
                      htmlFor="update-meeting-duration"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Duration (min) <span aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <input
                      id="update-meeting-duration"
                      type="number"
                      value={updateForm.duration}
                      onChange={(e) =>
                        setUpdateForm({
                          ...updateForm,
                          duration: parseInt(e.target.value) || 30,
                        })
                      }
                      min="15"
                      step="15"
                      title="Meeting duration in minutes"
                      placeholder="30"
                      aria-required="true"
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateMeeting}
                  disabled={updatingMeeting}
                  aria-label={
                    updatingMeeting
                      ? "Saving meeting changes..."
                      : "Save meeting changes"
                  }
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingMeeting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        aria-hidden="true"
                      >
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      </motion.div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" aria-hidden="true" />
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
