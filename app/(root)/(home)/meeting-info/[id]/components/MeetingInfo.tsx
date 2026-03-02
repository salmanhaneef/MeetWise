"use client";

// app/meeting-info/[id]/components/MeetingInfo.tsx

import React from "react";

export interface MeetingInfoData {
  title: string
  description?: string
  date: string
  time: string
  duration?: string
  status?: string
  userName: string
  userImageUrl?: string
  totalParticipants?: number
  hasRecordings?: boolean
}

interface MeetingInfoProps {
  meetingData: MeetingInfoData
}

function getStatusStyle(status?: string) {
  switch (status?.toUpperCase()) {
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    case "LIVE":
    case "STARTED":
      return "bg-red-500/10 text-red-400 border-red-500/20"
    case "SCHEDULED":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function MeetingInfo({ meetingData }: MeetingInfoProps) {
  const initial = meetingData.userName?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <div className="mb-8">
      {/* Title + Status */}
      <div className="flex items-start gap-3 mb-2 flex-wrap">
        <h2 className="text-3xl font-bold text-foreground">
          {meetingData.title}
        </h2>
        {meetingData.status && (
          <span
            className={`mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(meetingData.status)}`}
          >
            {meetingData.status.charAt(0) + meetingData.status.slice(1).toLowerCase()}
          </span>
        )}
      </div>

      {/* Description */}
      {meetingData.description && (
        <p className="text-sm text-muted-foreground mb-3 max-w-2xl leading-relaxed">
          {meetingData.description}
        </p>
      )}

      {/* Meta row */}
      <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
        {/* Host */}
        <span className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border">
            {meetingData.userImageUrl ? (
              <img
                src={meetingData.userImageUrl}
                alt={meetingData.userName}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-xs text-primary font-medium">{initial}</span>
              </div>
            )}
          </div>
          {meetingData.userName}
        </span>

        <span className="flex items-center gap-1">📅 {meetingData.date}</span>
        <span className="flex items-center gap-1">🕐 {meetingData.time}</span>

        {meetingData.duration && (
          <span className="flex items-center gap-1">⏱ {meetingData.duration}</span>
        )}

        {meetingData.totalParticipants !== undefined && (
          <span className="flex items-center gap-1">
            👥 {meetingData.totalParticipants} participant
            {meetingData.totalParticipants !== 1 ? "s" : ""}
          </span>
        )}

        {meetingData.hasRecordings && (
          <span className="flex items-center gap-1 text-primary">
            🔴 Recording available
          </span>
        )}
      </div>
    </div>
  )
}

export default MeetingInfo