"use client";

import { useState } from "react";
import { X, Users, Plus, Send } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface InviteParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string | null;
}

interface Participant {
  email: string;
  name: string;
}

export default function InviteParticipantModal({
  isOpen,
  onClose,
  meetingId,
}: InviteParticipantModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddParticipant = () => {
    if (!newParticipantEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (participants.some((p) => p.email === newParticipantEmail)) {
      toast.error("Participant already added");
      return;
    }

    setParticipants([
      ...participants,
      {
        email: newParticipantEmail,
        name: newParticipantName || newParticipantEmail.split("@")[0],
      },
    ]);
    setNewParticipantEmail("");
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (email: string) => {
    setParticipants(participants.filter((p) => p.email !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId) {
      toast.error("No meeting selected");
      return;
    }

    if (participants.length === 0) {
      toast.error("Please add at least one participant");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/meeting/${meetingId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants }),
      });

      if (response.ok) {
        toast.success(`Invitations sent to ${participants.length} participants`);
        resetForm();
        onClose();
      } else {
        throw new Error("Failed to send invitations");
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error("Failed to send invitations");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setParticipants([]);
    setNewParticipantEmail("");
    setNewParticipantName("");
  };

  if (!isOpen || !meetingId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Invite Participants</h2>
            <p className="text-slate-400 text-sm mt-1">Add people to your meeting</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            title="Close modal"
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Add Participant Form */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Users className="w-4 h-4 inline mr-1.5" />
              Add Participants
            </label>

            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Participant email address"
                className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Name (optional)"
                aria-label="Participant name"
                className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                aria-label="Add participant"
                title="Add participant"
                className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Participants List */}
          <AnimatePresence mode="wait">
            {participants.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 max-h-48 overflow-y-auto"
              >
                {participants.map((participant) => (
                  <motion.div
                    key={participant.email}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">
                          {participant.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {participant.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(participant.email)}
                      aria-label={`Remove ${participant.name}`}
                      title={`Remove ${participant.name}`}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 border border-dashed border-slate-700 rounded-xl"
              >
                <div className="w-12 h-12 mx-auto mb-3 bg-slate-800 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">No participants added yet</p>
                <p className="text-slate-500 text-xs mt-1">Add participants using the form above</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary */}
          {participants.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl"
            >
              <p className="text-sm text-blue-300">
                <span className="font-semibold">{participants.length}</span> participant{participants.length !== 1 ? 's' : ''} will receive an invitation
              </p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || participants.length === 0}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  aria-hidden="true"
                />
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  Send Invitations
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}