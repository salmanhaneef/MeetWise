// app/api/meetings/[id]/route.ts
// GET specific meeting details by ID (role-based response with Stream sync)
// ✅ FIXED: Proper actionItems JsonValue transformation + debugging

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { StreamClient } from '@stream-io/node-sdk'
import prisma from '@/lib/prisma'

/* -------------------------------------------------------------------------- */
/*                               STREAM CONFIG                                 */
/* -------------------------------------------------------------------------- */

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY

/* -------------------------------------------------------------------------- */
/*                          AUTH HELPER                                        */
/* -------------------------------------------------------------------------- */

async function getUserFromRequest(req: NextRequest) {
  console.log('🔐 [AUTH] Authenticating user...')

  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_TEST_AUTH === 'true'
  ) {
    const testUserId = req.nextUrl.searchParams.get('testUserId')
    if (testUserId) {
      console.log('🧪 [AUTH] Using test user:', testUserId)
      return { id: testUserId }
    }
  }

  const user = await currentUser()
  console.log('✅ [AUTH] User authenticated:', user?.id || 'None')
  return user
}

/* -------------------------------------------------------------------------- */
/*                    SYNC MEETING DATA FROM STREAM                            */
/* -------------------------------------------------------------------------- */

async function syncMeetingFromStream(meetingId: string, streamCallId: string) {
  console.log('\n📡 [STREAM-SYNC] Syncing meeting data from GetStream.io')
  console.log('📡 [STREAM-SYNC] Meeting ID:', meetingId)
  console.log('📡 [STREAM-SYNC] Stream Call ID:', streamCallId)

  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.log('⚠️  [STREAM-SYNC] Missing Stream credentials, skipping sync')
    return null
  }

  try {
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET)
    const call = client.video.call('default', streamCallId)

    console.log('📞 [STREAM-SYNC] Fetching call data...')
    const callData = await call.get()

    const updateData: {
      startedAt?: Date
      endedAt?: Date
      actualDuration?: number
      recordingUrls?: string[]
      recordingDuration?: number
      status?: 'ONGOING' | 'COMPLETED'
    } = {}
    let needsUpdate = false

    /* ----------------------------- Started At ------------------------------ */
    if (callData.call?.session?.started_at) {
      updateData.startedAt = new Date(callData.call.session.started_at)
      needsUpdate = true
    }

    /* ----------------------------- Ended At -------------------------------- */
    if (callData.call?.ended_at) {
      updateData.endedAt = new Date(callData.call.ended_at)
      updateData.status = 'COMPLETED'
      needsUpdate = true
    } else if (callData.call?.session?.started_at) {
      updateData.status = 'ONGOING'
      needsUpdate = true
    }

    /* --------------------------- Actual Duration --------------------------- */
    if (callData.call?.session?.started_at && callData.call?.ended_at) {
      const start = new Date(callData.call.session.started_at)
      const end = new Date(callData.call.ended_at)
      updateData.actualDuration = Math.round(
        (end.getTime() - start.getTime()) / 60000
      )
      needsUpdate = true
    }

    /* ----------------------------- Recordings ------------------------------ */
    try {
      const recordings = await call.listRecordings()
      if (recordings.recordings && recordings.recordings.length > 0) {
        updateData.recordingUrls = recordings.recordings.map((r) => r.url)
        console.log(
          '🎥 [STREAM-SYNC] Found',
          updateData.recordingUrls.length,
          'recording(s)'
        )
        needsUpdate = true
      } else {
        console.log('ℹ️  [STREAM-SYNC] No recordings found')
      }
    } catch (recordingError) {
      console.log(
        '⚠️  [STREAM-SYNC] Failed to fetch recordings:',
        recordingError instanceof Error
          ? recordingError.message
          : String(recordingError)
      )
    }

    if (!needsUpdate) {
      console.log('ℹ️  [STREAM-SYNC] No updates needed')
      return null
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        host: true,
        participants: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
        transcriptChunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    })

    console.log('✅ [STREAM-SYNC] Successfully synced meeting data')
    return updatedMeeting
  } catch (error) {
    console.error(
      '❌ [STREAM-SYNC] Failed to sync from Stream:',
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*                    ACTION ITEMS TRANSFORM HELPER                           */
/* -------------------------------------------------------------------------- */

/**
 * Transform Prisma JsonValue to ActionItem[] array
 * Handles: array, stringified JSON, single object, null/undefined
 */
/* -------------------------------------------------------------------------- */
/*                    ACTION ITEMS TRANSFORM HELPER                           */
/* -------------------------------------------------------------------------- */

// ✅ Define proper types for Prisma JsonValue and ActionItem
type PrismaJsonValue = 
  | null 
  | undefined 
  | string 
  | number 
  | boolean 
  | { [key: string]: PrismaJsonValue } 
  | PrismaJsonValue[]

interface TransformedActionItem {
  id: number
  text: string
  assignee: string | null
  dueDate: string | null
  completed: boolean
}

/**
 * Transform Prisma JsonValue to ActionItem[] array
 * Handles: array, stringified JSON, single object, null/undefined
 */
function transformActionItems(jsonValue: PrismaJsonValue): TransformedActionItem[] {
  console.log('🔍 [ACTION-ITEMS] Transform input type:', typeof jsonValue)
  console.log('🔍 [ACTION-ITEMS] Transform input value:', jsonValue)
  console.log('🔍 [ACTION-ITEMS] Is array:', Array.isArray(jsonValue))

  // Case 1: Already an array
  if (Array.isArray(jsonValue)) {
    console.log('✅ [ACTION-ITEMS] Processing array with', jsonValue.length, 'items')
    return jsonValue.map((item: unknown, index: number): TransformedActionItem => {
      console.log(`🔍 [ACTION-ITEMS] Item[${index}] raw:`, item)
      
      // ✅ Safe type guard for object items
      const obj = item && typeof item === 'object' && !Array.isArray(item) 
        ? item as Record<string, unknown> 
        : {}
      
      const transformed: TransformedActionItem = {
        id: typeof (obj as Record<string, unknown>)?.id === 'number' 
          ? (obj as Record<string, unknown>).id as number 
          : ((obj as Record<string, unknown>)?.id ? Number((obj as Record<string, unknown>).id) : index + 1),
        text: String((obj as Record<string, unknown>)?.text || obj || ''),
        assignee: (obj as Record<string, unknown>)?.assignee as string | null ?? null,
        dueDate: (obj as Record<string, unknown>)?.dueDate as string | null ?? null,
        completed: typeof (obj as Record<string, unknown>)?.completed === 'boolean' 
          ? (obj as Record<string, unknown>).completed as boolean 
          : false,
      }
      
      console.log(`✅ [ACTION-ITEMS] Item[${index}] transformed:`, transformed)
      return transformed
    })
  }

  // Case 2: Stringified JSON
  if (typeof jsonValue === 'string') {
    console.log('⚠️ [ACTION-ITEMS] Value is string, attempting JSON.parse')
    try {
      const parsed: PrismaJsonValue = JSON.parse(jsonValue)
      console.log('✅ [ACTION-ITEMS] Parsed string to:', parsed)
      return transformActionItems(parsed) // Recursive call with parsed value
    } catch (e) {
      console.error('❌ [ACTION-ITEMS] Failed to parse JSON string:', e)
      return []
    }
  }

  // Case 3: Single object (not array) - wrap in array
  if (jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
    console.log('⚠️ [ACTION-ITEMS] Value is single object, wrapping in array')
    const obj = jsonValue as Record<string, unknown>
    if ('text' in obj || 'id' in obj) {
      return [{
        id: typeof obj.id === 'number' ? obj.id : 1,
        text: String(obj.text ?? ''),
        assignee: (obj.assignee as string | null) ?? null,
        dueDate: (obj.dueDate as string | null) ?? null,
        completed: typeof obj.completed === 'boolean' ? obj.completed : false,
      }]
    }
  }

  // Case 4: null, undefined, or unexpected type
  console.log('⚠️ [ACTION-ITEMS] Returning empty array - unexpected input')
  return []
}

/* -------------------------------------------------------------------------- */
/*                    GET: FETCH MEETING DETAILS (ROLE-BASED)                 */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('\n🚀 [GET] Fetching meeting details')

  try {
    const { id } = await params
    console.log('📋 [GET] ID param:', id)

    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find DB user by Clerk ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // ✅ FIX: The [id] param could be either DB uuid or streamCallId
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let meeting = await prisma.meeting.findUnique({
      where: isUuid ? { id } : { streamCallId: id },
      include: {
        host: true,
        participants: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
        transcriptChunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    })

    // If uuid lookup failed, try streamCallId as fallback
    if (!meeting && isUuid) {
      meeting = await prisma.meeting.findUnique({
        where: { streamCallId: id },
        include: {
          host: true,
          participants: {
            include: { user: true },
            orderBy: { joinedAt: 'asc' },
          },
          transcriptChunks: {
            orderBy: { chunkIndex: 'asc' },
          },
        },
      })
    }

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Use the actual streamCallId from the found meeting for Stream sync
    const streamCallId = meeting.streamCallId

    // ✅ Role check
    const isHost = meeting.hostId === dbUser.id
    const isParticipant = meeting.participants.some(
      (p) => p.userId === dbUser.id
    )

    console.log('👤 [GET] Is Host:', isHost, '| Is Participant:', isParticipant)

    // Sync latest data from Stream
    const syncedMeeting = await syncMeetingFromStream(
      meeting.id,
      streamCallId
    )
    if (syncedMeeting) meeting = syncedMeeting

    // 🔍 DEBUG: Log raw actionItems BEFORE transformation
    console.log('\n🔍 [AI-OUTPUT] Raw actionItems from Prisma:')
    console.log('  - Type:', typeof meeting.actionItems)
    console.log('  - Value:', meeting.actionItems)
    console.log('  - Is Array:', Array.isArray(meeting.actionItems))
    if (meeting.actionItems !== null && meeting.actionItems !== undefined) {
      console.log('  - JSON.stringify:', JSON.stringify(meeting.actionItems))
    }

    // ✅ Transform actionItems using helper
    const transformedActionItems = transformActionItems(meeting.actionItems)
    console.log('✅ [AI-OUTPUT] Transformed actionItems count:', transformedActionItems.length)
    console.log('✅ [AI-OUTPUT] Transformed actionItems:', transformedActionItems)

    // ── Shared AI output block ──
    const aiOutput = {
      processed: meeting.processed,
      processedAt: meeting.processedAt,
      ragProcessed: meeting.ragProcessed,
      ragProcessedAt: meeting.ragProcessedAt,
      transcriptReady: meeting.transcriptReady,
      summary: meeting.summary ?? null,
      
      // ✅ CRITICAL: Use transformed action items
      actionItems: transformedActionItems,
      
      transcript: meeting.transcript ?? null,
      speakers: meeting.speakers ?? null,
    }

    /* ---------------------------------------------------------------------- */
    /*                         HOST RESPONSE                                   */
    /* ---------------------------------------------------------------------- */
    if (isHost) {
      console.log('👑 [GET] Returning HOST full details')

      const participantDetails = meeting.participants.map((p) => {
        const fullName =
          [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') ||
          'Unknown User'
        const username =
          p.user.username || p.user.email?.split('@')[0] || 'user'
        const durationMinutes = p.duration ? Math.floor(p.duration / 60) : 0
        const durationSeconds = p.duration ? p.duration % 60 : 0
        const durationFormatted = p.duration
          ? `${durationMinutes}m ${durationSeconds}s`
          : 'Still in meeting'

        return {
          participantId: p.id,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.duration,
          durationFormatted,
          isMicMuted: p.isMicMuted,
          isCameraOff: p.isCameraOff,
          user: {
            id: p.user.id,
            clerkId: p.user.clerkId,
            username,
            email: p.user.email,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            fullName,
            imageUrl: p.user.imageUrl,
          },
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }
      })

      // 🔍 Final debug before sending response
      console.log('\n🔍 [RESPONSE] Final actionItems in host response:', aiOutput.actionItems)

      return NextResponse.json({
        success: true,
        role: 'host',
        isHost: true,
        meeting: {
          // ── Basic Info ──
          id: meeting.id,
          streamCallId: meeting.streamCallId,
          title: meeting.title,
          description: meeting.description,
          status: meeting.status,

          // ── Scheduling ──
          scheduledFor: meeting.scheduledFor,
          duration: meeting.duration,
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,
          actualDuration: meeting.actualDuration,
          actualDurationFormatted: meeting.actualDuration
            ? `${meeting.actualDuration} minutes`
            : null,

          // ── Recordings ──
          recordingUrls: meeting.recordingUrls ?? [],
          recordingDuration: meeting.recordingDuration,
          recordingDurationFormatted: meeting.recordingDuration
            ? `${Math.floor(meeting.recordingDuration / 60)}m ${meeting.recordingDuration % 60}s`
            : null,
          hasRecordings: (meeting.recordingUrls?.length ?? 0) > 0,

          // ── Host ──
          host: {
            id: meeting.host.id,
            clerkId: meeting.host.clerkId,
            username:
              meeting.host.username ||
              meeting.host.email?.split('@')[0] ||
              'host',
            email: meeting.host.email,
            firstName: meeting.host.firstName,
            lastName: meeting.host.lastName,
            fullName:
              [meeting.host.firstName, meeting.host.lastName]
                .filter(Boolean)
                .join(' ') || 'Host',
            imageUrl: meeting.host.imageUrl,
          },

          // ── Participants ──
          totalParticipants: meeting.totalParticipants,
          participants: participantDetails,

          // ── Analytics ──
          analytics: {
            totalParticipants: meeting.totalParticipants,
            participantsWhoLeft: participantDetails.filter((p) => p.leftAt)
              .length,
            participantsStillActive: participantDetails.filter((p) => !p.leftAt)
              .length,
            averageDuration:
              participantDetails.filter((p) => p.duration).length > 0
                ? Math.round(
                    participantDetails
                      .filter((p) => p.duration)
                      .reduce((sum, p) => sum + (p.duration || 0), 0) /
                      participantDetails.filter((p) => p.duration).length
                  )
                : 0,
            participantsWithMicMuted: participantDetails.filter(
              (p) => p.isMicMuted
            ).length,
            participantsWithCameraOff: participantDetails.filter(
              (p) => p.isCameraOff
            ).length,
          },

          // ✅ AI OUTPUT with transformed actionItems
          ...aiOutput,

          // ── Metadata ──
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
        },
      })
    }

    /* ---------------------------------------------------------------------- */
    /*                      PARTICIPANT RESPONSE                               */
    /* ---------------------------------------------------------------------- */
    if (isParticipant) {
      console.log('👥 [GET] Returning PARTICIPANT limited details')

      const participantData = meeting.participants.find(
        (p) => p.userId === dbUser.id
      )

      // 🔍 Final debug before sending response
      console.log('\n🔍 [RESPONSE] Final actionItems in participant response:', aiOutput.actionItems)

      return NextResponse.json({
        success: true,
        role: 'participant',
        isHost: false,
        meeting: {
          // ── Basic Info ──
          streamCallId: meeting.streamCallId,
          title: meeting.title,
          description: meeting.description,
          scheduledFor: meeting.scheduledFor,
          duration: meeting.duration,
          status: meeting.status,
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,

          // ── Host (limited) ──
          host: {
            firstName: meeting.host.firstName,
            lastName: meeting.host.lastName,
            imageUrl: meeting.host.imageUrl,
          },

          // ── Participant count only ──
          totalParticipants: meeting.totalParticipants,

          // ── Own participation data ──
          myParticipation: participantData
            ? {
                joinedAt: participantData.joinedAt,
                leftAt: participantData.leftAt,
                duration: participantData.duration,
              }
            : null,

          // ✅ AI OUTPUT with transformed actionItems
          ...aiOutput,
        },
      })
    }

    /* ---------------------------------------------------------------------- */
    /*                         UNAUTHORIZED                                    */
    /* ---------------------------------------------------------------------- */
    return NextResponse.json(
      { error: 'You are not authorized to view this meeting' },
      { status: 403 }
    )
  } catch (error) {
    console.error('❌ [GET] Error fetching meeting details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting details' },
      { status: 500 }
    )
  }
}