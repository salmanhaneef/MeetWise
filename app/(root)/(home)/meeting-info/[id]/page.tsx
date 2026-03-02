"use client";

// app/meeting-info/[id]/page.tsx

import React from "react";
import { useMeetingDetail } from "./hooks/useMeetingDetail";
import MeetingHeader from "./components/MeetingHeader";
import MeetingInfo from "./components/MeetingInfo";
import { Button } from "@/components/ui/button";
import ActionItems from "./components/action-items/ActionItems";
import TranscriptDisplay from "./components/TranscriptDisplay";
import ChatSidebar from "./components/ChatSidebar";
import CustomAudioPlayer from "./components/AudioPlayer";
import { TranscriptSegment } from "./hooks/useMeetingDetail";

function MeetingDetail() {
  const {
    meetingId,
    isOwner,
    userChecked,
    chatInput,
    messages,
    showSuggestions,
    activeTab,
    setActiveTab,
    meetingData,
    loading,
    isLoading,
    handleSendMessage,
    handleSuggestionClick,
    handleInputChange,
    deleteActionItem,
    addActionItem,
    displayActionItems,
    meetingInfoData,
  } = useMeetingDetail();

  const summary = meetingData?.summary ?? undefined;
  const actionItemsText =
    meetingData?.actionItems?.map((item) => `• ${item.text}`).join("\n") ??
    undefined;
  const recordingUrl = meetingData?.recordingUrls?.[0] ?? undefined;
  const transcript = meetingData?.transcript as
    | string
    | TranscriptSegment[]
    | undefined;

  // These come from API response directly on meetingData
  const participants = meetingData?.participants ?? [];
  const analytics = meetingData?.analytics ?? null;

  return (
    <div className="min-h-screen bg-background">
      <MeetingHeader
        title={meetingData?.title || "Meeting"}
        meetingId={meetingId}
        summary={summary}
        actionItems={actionItemsText}
        isOwner={isOwner}
        isLoading={!userChecked}
      />

      <div className="flex h-[calc(100vh-73px)]">
        {/* ── Main content ── */}
        <div
          className={`flex-1 p-6 overflow-auto pb-24 ${
            !userChecked ? "" : !isOwner ? "max-w-4xl mx-auto" : ""
          }`}
        >
          {/* Full page loading skeleton */}
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-9 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="h-48 bg-muted rounded-lg" />
                <div className="h-48 bg-muted rounded-lg" />
              </div>
            </div>
          ) : (
            <>
              {/* ── Meeting title, status, description, host, date ── */}
              <MeetingInfo meetingData={meetingInfoData} />

              {/* ── Participants + Analytics — ALWAYS SHOWN ── */}
              {(participants.length > 0 || analytics) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                  {/* Participants card */}
                  {participants.length > 0 && (
                    <div className="bg-card rounded-lg p-6 border border-border">
                      <h3 className="text-base font-semibold text-foreground mb-4">
                        Participants ({participants.length})
                      </h3>
                      <div className="space-y-3">
                        {participants.map((p) => (
                          <div key={p.participantId} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border">
                              {p.user?.imageUrl ? (
                                <img
                                  src={p.user.imageUrl}
                                  alt={p.user.fullName ?? p.user.email}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs text-primary font-medium">
                                    {p.user?.firstName?.charAt(0)?.toUpperCase() ?? "?"}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {p.user?.fullName ?? p.user?.email ?? "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.durationFormatted ?? "—"}
                                {p.isMicMuted && " · Mic muted"}
                                {p.isCameraOff && " · Camera off"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analytics card */}
                  {analytics && (
                    <div className="bg-card rounded-lg p-6 border border-border">
                      <h3 className="text-base font-semibold text-foreground mb-4">
                        Meeting Analytics
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total participants</span>
                          <span className="text-foreground font-medium">
                            {analytics.totalParticipants}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Average duration</span>
                          <span className="text-foreground font-medium">
                            {analytics.averageDuration
                              ? `${Math.floor(analytics.averageDuration / 60)}m ${analytics.averageDuration % 60}s`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Mic muted</span>
                          <span className="text-foreground font-medium">
                            {analytics.participantsWithMicMuted ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Camera off</span>
                          <span className="text-foreground font-medium">
                            {analytics.participantsWithCameraOff ?? 0}
                          </span>
                        </div>
                        {meetingData?.actualDurationFormatted && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Meeting duration</span>
                            <span className="text-foreground font-medium">
                              {meetingData.actualDurationFormatted}
                            </span>
                          </div>
                        )}
                        {meetingData?.recordingDurationFormatted && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Recording duration</span>
                            <span className="text-foreground font-medium">
                              {meetingData.recordingDurationFormatted}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tabs: Summary / Transcript ── */}
              <div className="mb-8">
                <div className="flex border-b border-border">
                  <Button
                    variant="ghost"
                    onClick={() => setActiveTab("summary")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 rounded-none shadow-none transition-colors ${
                      activeTab === "summary"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    }`}
                    style={{ boxShadow: "none" }}
                    type="button"
                  >
                    Summary
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveTab("transcript")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 rounded-none shadow-none transition-colors ${
                      activeTab === "transcript"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    }`}
                    style={{ boxShadow: "none" }}
                    type="button"
                  >
                    Transcript
                  </Button>
                </div>

                <div className="mt-6">
                  {/* ── SUMMARY TAB ── */}
                  {activeTab === "summary" && (
                    <>
                      {/* Not processed — quiet notice, NO spinner, NO email message */}
                      {!meetingData?.processed ? (
                        <div className="bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            AI summary not yet available for this meeting.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Summary text */}
                          {meetingData.summary && (
                            <div className="bg-card border border-border rounded-lg p-6">
                              <h3 className="text-lg font-semibold text-foreground mb-3">
                                Meeting Summary
                              </h3>
                              <p className="text-muted-foreground leading-relaxed">
                                {meetingData.summary}
                              </p>
                            </div>
                          )}

                          {/* Skeleton while auth check pending */}
                          {!userChecked ? (
                            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
                              <div className="h-4 bg-muted rounded w-1/4 mb-4" />
                              <div className="space-y-2">
                                <div className="h-3 bg-muted rounded w-3/4" />
                                <div className="h-3 bg-muted rounded w-1/2" />
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Owner — full editable action items */}
                              {isOwner && displayActionItems.length > 0 && (
                                <ActionItems
                                  actionItems={displayActionItems}
                                  onDeleteItem={deleteActionItem}
                                  onAddItem={addActionItem}
                                  meetingId={meetingId}
                                />
                              )}

                              {/* Participant — read-only action items */}
                              {!isOwner && displayActionItems.length > 0 && (
                                <div className="bg-card rounded-lg p-6 border border-border">
                                  <h3 className="text-lg font-semibold text-foreground mb-4">
                                    Action Items
                                  </h3>
                                  <div className="space-y-3">
                                    {displayActionItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-start gap-3"
                                      >
                                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                        <p className="text-sm text-foreground">
                                          {item.text}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── TRANSCRIPT TAB ── */}
                  {activeTab === "transcript" && (
                    <>
                      {transcript ? (
                        <TranscriptDisplay transcript={transcript} />
                      ) : (
                        <div className="bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            Transcript not yet available for this meeting.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Chat sidebar (owner only) ── */}
        {!userChecked ? (
          <div className="w-96 border-l border-border p-4 bg-card">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="h-8 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
              </div>
            </div>
          </div>
        ) : (
          isOwner && (
            <ChatSidebar
              messages={messages}
              chatInput={chatInput}
              showSuggestions={showSuggestions}
              isLoading={isLoading}
              onInputChange={handleInputChange}
              onSendMessage={handleSendMessage}
              onSuggestionClick={handleSuggestionClick}
            />
          )
        )}
      </div>

      {/* Audio player */}
      <CustomAudioPlayer recordingUrl={recordingUrl} isOwner={isOwner} />
    </div>
  );
}

export default MeetingDetail;