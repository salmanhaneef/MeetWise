"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Users, FileText, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@clerk/nextjs";

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Participant {
  email: string;
  name: string;
}

// ✅ Define error type for type safety
interface InviteError { 
  email: string; 
  error: string; 
}

export default function CreateMeetingModal({
  isOpen,
  onClose,
}: CreateMeetingModalProps) {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [duration, setDuration] = useState("30");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      console.log("🔍 MODAL OPENED - Debug Info:");
      console.log("  ├─ Clerk Auth Loaded:", isLoaded);
      console.log("  ├─ User Signed In:", isSignedIn);
      console.log("  ├─ User ID:", userId);
      console.log("  ├─ Participants Count:", participants.length);
      console.log("  └─ Form Fields:", { title, description, scheduledFor, duration });
    }
  }, [isOpen, isLoaded, isSignedIn, userId, participants, title, description, scheduledFor, duration]);

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
  setLoading(true);

  // 📋 Collect debug info for final alert
  let debugSummary = "";
  let meetingIdUsed = "";
  let invitationsSent = 0;
  let hasErrors = false;

  console.log("\n========================================");
  console.log("🚀 STARTING MEETING CREATION FLOW");
  console.log("========================================");
  
  console.log("\n[STEP 1: AUTH VALIDATION]");
  console.log("  ├─ Clerk Auth Loaded:", isLoaded);
  console.log("  ├─ User Signed In:", isSignedIn);
  console.log("  └─ User ID:", userId);

  if (!isLoaded) {
    console.error("❌ AUTH ERROR: Clerk auth not loaded yet");
    toast.error("Authentication system loading. Please wait and try again.");
    setLoading(false);
    return;
  }

  if (!isSignedIn) {
    console.error("❌ AUTH ERROR: User not signed in");
    toast.error("You must be signed in to create a meeting");
    setLoading(false);
    return;
  }

  if (!userId) {
    console.error("❌ AUTH ERROR: User ID is missing");
    toast.error("Authentication error: User ID not found");
    setLoading(false);
    return;
  }

  console.log("✅ Auth validation passed\n");

  console.log("[STEP 2: FORM DATA VALIDATION]");
  console.log("  ├─ Title:", title);
  console.log("  ├─ Description:", description);
  console.log("  ├─ Scheduled For:", scheduledFor);
  console.log("  ├─ Duration:", duration);
  
  // ✅ CRITICAL FIX: Build final participants list including pending input
  const finalParticipants = [...participants];
  
  // Auto-add participant from input fields if email is filled
  if (newParticipantEmail.trim()) {
    const email = newParticipantEmail.trim();
    const name = newParticipantName.trim() || email.split("@")[0];
    
    // Only add if not already in the list
    if (!finalParticipants.some(p => p.email === email)) {
      finalParticipants.push({ email, name });
      console.log("  ✅ Auto-added participant from input fields");
    }
  }
  
  console.log("  └─ Participants:", finalParticipants);
  console.log("      Count:", finalParticipants.length);

  if (!title.trim()) {
    console.error("❌ FORM ERROR: Title is required");
    toast.error("Meeting title is required");
    setLoading(false);
    return;
  }

  if (!scheduledFor) {
    console.error("❌ FORM ERROR: Date/time is required");
    toast.error("Please select a date and time");
    setLoading(false);
    return;
  }

  console.log("✅ Form validation passed\n");

  try {
    console.log("[STEP 3: CREATING MEETING]");
    console.log("  ├─ Endpoint: /api/meeting");
    console.log("  ├─ Method: POST");
    console.log("  └─ Sending with credentials: include");

    const meetingResponse = await fetch("/api/meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title,
        description,
        scheduledFor,
        duration: parseInt(duration),
      }),
    });

    console.log("  ├─ Response Status:", meetingResponse.status);
    console.log("  └─ Response OK:", meetingResponse.ok);

    if (!meetingResponse.ok) {
      const errorData = await meetingResponse.json().catch(() => ({}));
      console.error("❌ MEETING CREATION FAILED:");
      console.error("  ├─ Status:", meetingResponse.status);
      console.error("  ├─ Error:", errorData);
      throw new Error(errorData.error || `HTTP ${meetingResponse.status}: ${meetingResponse.statusText}`);
    }

    const meetingData = await meetingResponse.json();
    console.log("\n✅ MEETING CREATED SUCCESSFULLY");
    console.log("  ├─ Full Response:", meetingData);

    console.log("\n[STEP 4: EXTRACTING MEETING ID]");
    
    const callId = meetingData.callId;
    const streamCallId = meetingData.streamCallId;
    const dbId = meetingData.id;
    
    console.log("  ├─ callId:", callId);
    console.log("  ├─ streamCallId:", streamCallId);
    console.log("  └─ id (database):", dbId);

    let meetingIdToUse = null;

    if (callId) {
      meetingIdToUse = callId;
      console.log("  ✅ Using 'callId' field:", meetingIdToUse);
    } else if (streamCallId) {
      meetingIdToUse = streamCallId;
      console.log("  ✅ Using 'streamCallId' field:", meetingIdToUse);
    } else if (dbId) {
      meetingIdToUse = dbId;
      console.log("  ⚠️ Using 'id' field (database ID):", meetingIdToUse);
      console.log("  ⚠️ WARNING: This might not work for invite endpoint!");
    } else {
      console.error("❌ CRITICAL ERROR: No meeting ID found in response!");
      console.error("  Response structure:", Object.keys(meetingData));
      throw new Error("Invalid meeting response: Missing meeting identifier");
    }

    meetingIdUsed = meetingIdToUse;
    console.log("  ✅ Meeting ID to use:", meetingIdToUse);

    toast.success("Meeting created successfully!");

    // ✅ Send invitations if participants added (USE finalParticipants)
    if (finalParticipants.length > 0) {
      console.log("\n[STEP 5: SENDING INVITATIONS]");
      console.log("  ├─ Participants to invite:", finalParticipants.length);
      console.log("  ├─ Invite URL:", `/api/meeting/${meetingIdToUse}/invite`);
      console.log("  └─ Sending with credentials: include");

      const inviteResponse = await fetch(
        `/api/meeting/${meetingIdToUse}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ participants: finalParticipants }), // ✅ Use finalParticipants
        }
      );

      console.log("  ├─ Response Status:", inviteResponse.status);
      console.log("  └─ Response OK:", inviteResponse.ok);

      let inviteData;
      try {
        inviteData = await inviteResponse.json();
        console.log("  ├─ Response Data:", inviteData);
      } catch (parseError) {
        console.error("  ❌ Failed to parse response:", parseError);
        inviteData = {};
      }

      if (inviteResponse.ok) {
        console.log("\n✅ INVITATIONS SENT SUCCESSFULLY");
        console.log("  ├─ Invitations Created:", inviteData.invitationsCreated || 0);
        console.log("  ├─ Results:", inviteData.results || []);
        console.log("  └─ Errors:", inviteData.errors || []);

        invitationsSent = inviteData.invitationsCreated || 0;

        if (invitationsSent > 0) {
          debugSummary += `✅ Invitations sent: ${invitationsSent}\n`;
        }

        if (inviteData.errors && inviteData.errors.length > 0) {
          hasErrors = true;
          const duplicateCount = (inviteData.errors as InviteError[]).filter(
            e => e.error.includes("Already")
          ).length;
          
          if (duplicateCount > 0) {
            debugSummary += `⚠️ Already invited: ${duplicateCount}\n`;
            console.log(`  ⚠️ ${duplicateCount} participant(s) already invited`);
          }
        }
      } else {
        hasErrors = true;
        console.error("\n❌ INVITATION FAILED");
        console.error("  ├─ Status:", inviteResponse.status);
        console.error("  ├─ Error:", inviteData.error || inviteData.message || "Unknown error");

        let errorMsg = "Unknown error";
        
        if (inviteResponse.status === 401) {
          errorMsg = "Session expired - please sign in again";
        } else if (inviteResponse.status === 403) {
          errorMsg = "Only the meeting host can send invitations";
        } else if (inviteResponse.status === 404) {
          errorMsg = `Meeting not found (ID: ${meetingIdToUse})`;
        } else if (inviteResponse.status === 400) {
          errorMsg = inviteData.error || "Invalid request";
        } else {
          errorMsg = inviteData.error || inviteData.message || "Unknown error";
        }

        debugSummary += `❌ Invitation failed: ${errorMsg}\n`;
      }
    } else {
      console.log("\n[STEP 5: SKIPPED - NO PARTICIPANTS]");
      debugSummary += "ℹ️ No participants invited\n";
    }

    // ✅ Reset form and close modal BEFORE alert
    resetForm();
    onClose();

    console.log("\n========================================");
    console.log("✅ PROCESS COMPLETED SUCCESSFULLY");
    console.log("========================================\n");

    // ✅ BUILD SUCCESS MESSAGE FOR ALERT
    let alertMessage = "✅ MEETING CREATED SUCCESSFULLY\n\n";
    alertMessage += `📋 Meeting Details:\n`;
    alertMessage += `   Title: ${title}\n`;
    alertMessage += `   Date: ${new Date(scheduledFor).toLocaleString()}\n`;
    alertMessage += `   Duration: ${duration} minutes\n`;
    alertMessage += `\n`;

    if (finalParticipants.length > 0) { // ✅ Use finalParticipants
      alertMessage += `📧 Invitations:\n`;
      if (invitationsSent > 0) {
        alertMessage += `   ✅ Sent to ${invitationsSent} participant(s)\n`;
      }
      if (hasErrors) {
        alertMessage += `   ⚠️ Some invitations may have failed\n`;
      }
    } else {
      alertMessage += `📧 No participants invited\n`;
    }

    alertMessage += `\n📋 Debug Info:\n`;
    alertMessage += `   User ID: ${userId.substring(0, 15)}...\n`;
    alertMessage += `   Meeting ID: ${meetingIdUsed}\n`;
    if (debugSummary) {
      alertMessage += `   Status: ${debugSummary.replace(/\n/g, '   ')}`;
    }

    alertMessage += `\nClick OK to refresh the page and see your meeting.`;

    // ✅ SHOW ALERT BEFORE REDIRECTING
    alert(alertMessage);

    // ✅ ONLY RELOAD AFTER USER CLICKS OK
    window.location.reload();

  } catch (error) {
    console.error("\n========================================");
    console.error("💥 FATAL ERROR OCCURRED");
    console.error("========================================");
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error Message:", errorMessage);
    
    if (error instanceof Error && error.stack) {
      console.error("Stack Trace:", error.stack);
    }
    
    console.error("========================================\n");

    // ✅ Show error in alert instead of just toast
    alert(`❌ FAILED TO CREATE MEETING\n\nError: ${errorMessage}\n\nCheck console (F12) for details.`);
    
    toast.error(`Failed: ${errorMessage}`);
  } finally {
    setLoading(false);
  }
};  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledFor("");
    setDuration("30");
    setParticipants([]);
    setNewParticipantEmail("");
    setNewParticipantName("");
  };

  if (!isOpen) return null;

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Create New Meeting
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
          {/* Meeting Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Meeting Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Standup Meeting"
              required
              className="w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add meeting description..."
              rows={3}
              className="w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date & Time *
              </label>
              <input
                type="datetime-local"
                aria-label="Scheduled time"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Duration (minutes) *
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                title="Meeting duration in minutes"
                className="w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Invite Participants (Optional)
            </label>

            {/* Add Participant Form */}
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                placeholder="Email address"
                title="Participant email address"
                className="flex-1 px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Name (optional)"
                title="Participant name"
                className="flex-1 px-4 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      aria-label="Remove participant"
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
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
              disabled={loading || !isSignedIn}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Meeting"}
            </button>
          </div>

          {/* Debug Info Display */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-medium">Debug Info:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Clerk Auth: {isLoaded ? (isSignedIn ? "✅ Signed In" : "❌ Not Signed In") : "⏳ Loading..."}</li>
              <li>User ID: {userId ? `${userId.substring(0, 15)}...` : "⚠️ Missing"}</li>
              <li>Participants: {participants.length}</li>
            </ul>
            <p className="mt-2 text-xs">
              After submission, an alert will show detailed results before page refresh.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}