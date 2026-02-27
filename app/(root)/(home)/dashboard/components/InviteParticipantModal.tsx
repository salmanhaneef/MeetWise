"use client";

import { useState } from "react";
import { X, Users, Plus } from "lucide-react";
import toast from "react-hot-toast";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Invite Participants
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Add Participants
            </label>

            {/* Add Participant Form */}
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Participant email address"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Name (optional)"
                aria-label="Participant name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                aria-label="Add participant"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Participants List */}
            {participants.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {participants.map((participant) => (
                  <div
                    key={participant.email}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {participant.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {participant.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(participant.email)}
                      aria-label={`Remove ${participant.name} from participants`}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {participants.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No participants added yet
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || participants.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Invitations"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}