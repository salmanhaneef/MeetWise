// app/meeting-info/[id]/hooks/useMeetingDetail.ts

import { useChatCore } from "@/hooks/chat/useChatCore"
import { useAuth } from "@clerk/nextjs"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { MeetingInfoData } from "../components/MeetingInfo"

export interface TranscriptSegment {
  speaker: string
  words?: Array<{ word: string; start: number; end: number }>
  text?: string
  start?: number
  end?: number
  offset?: number
}

export interface MeetingData {
  id: string
  streamCallId: string
  title: string
  description?: string
  status: string

  // Timing
  scheduledFor: string
  startedAt?: string
  endedAt?: string
  actualDuration?: number
  actualDurationFormatted?: string
  duration?: number

  // Recording
  recordingUrls: string[]
  hasRecordings: boolean
  recordingDuration?: number
  recordingDurationFormatted?: string

  // Participants — comes from API response
  totalParticipants?: number
  participants?: Array<{
    participantId: string
    joinedAt: string
    leftAt?: string
    duration?: number
    durationFormatted?: string
    isMicMuted: boolean
    isCameraOff: boolean
    user: {
      id: string
      clerkId: string
      firstName?: string
      lastName?: string
      fullName?: string
      email: string
      imageUrl?: string
      username?: string
    }
  }>

  // Analytics — comes from API response
  analytics?: {
    totalParticipants: number
    participantsWhoLeft: number
    participantsStillActive: number
    averageDuration: number
    participantsWithMicMuted: number
    participantsWithCameraOff: number
  }

  // AI output — properly typed, no `any`
  transcript?: TranscriptSegment[] | string
  speakers?: { speakers: Array<{ name: string; speakingTime: number }> }
  summary?: string
  actionItems?: Array<{
    id: number
    text: string
    assignee?: string | null
    dueDate?: string | null
    completed?: boolean
  }>
  processed: boolean
  processedAt?: string
  ragProcessed?: boolean
  ragProcessedAt?: string
  transcriptReady: boolean
  emailSent: boolean

  // Host
  host: {
    id?: string
    clerkId: string
    firstName?: string
    lastName?: string
    fullName?: string
    email: string
    imageUrl?: string
    username?: string
  }
}

export function useMeetingDetail() {
  const params = useParams()
  const streamCallId = params.id as string
  const { userId, isLoaded } = useAuth()

  const [isOwner, setIsOwner] = useState(false)
  const [userChecked, setUserChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">("summary")
  const [localActionItems, setLocalActionItems] = useState<Array<{ id: number; text: string }>>([])
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)

  const chat = useChatCore({
    apiEndpoint: "/api/rag/chat-meeting",
    getRequestBody: (input) => ({
      meetingId: meetingData?.id ?? streamCallId,
      question: input,
    }),
  })

  const handleSendMessage = async () => {
    if (!chat.chatInput.trim() || !isOwner) return
    await chat.handleSendMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    if (!isOwner) return
    chat.handleSuggestionClick(suggestion)
  }

  const handleInputChange = (value: string) => {
    if (!isOwner) return
    chat.handleInputChange(value)
  }

  // ── Fetch meeting ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return

    const fetchMeetingData = async () => {
      try {
        const response = await fetch(`/api/meeting/${streamCallId}`)
        if (!response.ok) return

        const data = await response.json()
        // API returns { success, meeting, isHost, role }
        const meeting: MeetingData = data.meeting
        setMeetingData(meeting)

        if (userId) {
          setIsOwner(meeting.host.clerkId === userId)
        }
        setUserChecked(true)

        setLocalActionItems(
          Array.isArray(meeting.actionItems)
            ? meeting.actionItems.map((item) => ({ id: item.id, text: item.text }))
            : []
        )
      } catch (error) {
        console.error("[useMeetingDetail] Error fetching meeting:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMeetingData()
  }, [streamCallId, userId, isLoaded])

  // ── Auto RAG processing ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !userChecked || !isOwner || !meetingData) return
    if (meetingData.ragProcessed) return
    if (!meetingData.transcript) return

    const processTranscript = async () => {
      try {
        let transcriptText = ""

        if (typeof meetingData.transcript === "string") {
          transcriptText = meetingData.transcript
        } else if (Array.isArray(meetingData.transcript)) {
          transcriptText = meetingData.transcript
            .map((seg: TranscriptSegment) => {
              if (Array.isArray(seg.words)) {
                return `${seg.speaker}: ${seg.words.map((w) => w.word).join(" ")}`
              }
              if (seg.text) return `${seg.speaker}: ${seg.text}`
              return ""
            })
            .filter(Boolean)
            .join("\n")
        }

        if (!transcriptText) return

        await fetch("/api/rag/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId: meetingData.id,
            transcript: transcriptText,
            meetingTitle: meetingData.title,
          }),
        })
      } catch (error) {
        console.error("[useMeetingDetail] Error processing RAG:", error)
      }
    }

    processTranscript()
  }, [isLoaded, userChecked, isOwner, meetingData])

  // ── Action items ────────────────────────────────────────────────────────────
  const deleteActionItem = (id: number) => {
    if (!isOwner) return
    setLocalActionItems((prev) => prev.filter((item) => item.id !== id))
  }

  const addActionItem = (text: string) => {
    if (!isOwner) return
    const nextId =
      localActionItems.length > 0
        ? Math.max(...localActionItems.map((i) => i.id)) + 1
        : 1
    setLocalActionItems((prev) => [...prev, { id: nextId, text }])
  }

  const displayActionItems = localActionItems.map((item) => ({
    id: item.id,
    text: item.text,
  }))

  // ── meetingInfoData — maps ALL API fields to MeetingInfo component ──────────
  const meetingInfoData: MeetingInfoData = meetingData
    ? {
        title: meetingData.title,
        description: meetingData.description ?? undefined,
        status: meetingData.status,

        date: meetingData.startedAt
          ? new Date(meetingData.startedAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : new Date(meetingData.scheduledFor).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),

        time:
          meetingData.startedAt && meetingData.endedAt
            ? `${new Date(meetingData.startedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })} – ${new Date(meetingData.endedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : new Date(meetingData.scheduledFor).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),

        // "55 minutes" from API
        duration: meetingData.actualDurationFormatted ?? undefined,

        // ✅ FIXED: parentheses resolve ?? vs || precedence error
        userName:
          meetingData.host.fullName ??
          ([meetingData.host.firstName, meetingData.host.lastName]
            .filter(Boolean)
            .join(" ") || meetingData.host.email),
        userImageUrl: meetingData.host.imageUrl ?? undefined,

        totalParticipants: meetingData.totalParticipants,
        hasRecordings: meetingData.hasRecordings,
      }
    : {
        title: "Loading...",
        date: "Loading...",
        time: "Loading...",
        userName: "Loading...",
      }

  return {
    meetingId: meetingData?.id ?? streamCallId,
    streamCallId,
    isOwner,
    userChecked,
    activeTab,
    setActiveTab,
    localActionItems,
    setLocalActionItems,
    meetingData,
    setMeetingData,
    loading,
    setLoading,
    chatInput: chat.chatInput,
    setChatInput: chat.setChatInput,
    messages: chat.messages,
    setMessages: chat.setMessages,
    showSuggestions: chat.showSuggestions,
    setShowSuggestions: chat.setShowSuggestions,
    isLoading: chat.isLoading,
    setIsLoading: chat.setIsLoading,
    handleSendMessage,
    handleSuggestionClick,
    handleInputChange,
    deleteActionItem,
    addActionItem,
    displayActionItems,
    meetingInfoData,
  }
}