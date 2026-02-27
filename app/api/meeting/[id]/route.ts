// app/api/meetings/[id]/route.ts
// GET specific meeting details by ID (role-based response with Stream sync)

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { StreamClient } from '@stream-io/node-sdk';
import prisma from '@/lib/prisma';

/* -------------------------------------------------------------------------- */
/*                               STREAM CONFIG                                 */
/* -------------------------------------------------------------------------- */

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

/* -------------------------------------------------------------------------- */
/*                          AUTH HELPER                                        */
/* -------------------------------------------------------------------------- */

async function getUserFromRequest(req: NextRequest) {
  console.log('🔐 [AUTH] Authenticating user...');
  
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_TEST_AUTH === 'true') {
    const testUserId = req.nextUrl.searchParams.get('testUserId');
    if (testUserId) {
      console.log('🧪 [AUTH] Using test user:', testUserId);
      return { id: testUserId };
    }
  }
  
  const user = await currentUser();
  console.log('✅ [AUTH] User authenticated:', user?.id || 'None');
  return user;
}

/* -------------------------------------------------------------------------- */
/*                    SYNC MEETING DATA FROM STREAM                            */
/* -------------------------------------------------------------------------- */

async function syncMeetingFromStream(meetingId: string, streamCallId: string) {
  console.log('\n📡 [STREAM-SYNC] ==========================================');
  console.log('📡 [STREAM-SYNC] Syncing meeting data from GetStream.io');
  console.log('📡 [STREAM-SYNC] Meeting ID:', meetingId);
  console.log('📡 [STREAM-SYNC] Stream Call ID:', streamCallId);

  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.log('⚠️  [STREAM-SYNC] Missing Stream credentials, skipping sync');
    return null;
  }

  try {
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const call = client.video.call('default', streamCallId);

    console.log('📞 [STREAM-SYNC] Fetching call data...');
    const callData = await call.get();

    console.log('📊 [STREAM-SYNC] Call Data:');
    console.log('   - Call ID:', callData.call?.id);
    console.log('   - Created At:', callData.call?.created_at);
    console.log('   - Started At:', callData.call?.session?.started_at);
    console.log('   - Ended At:', callData.call?.ended_at);
    console.log('   - Participants:', callData.call?.session?.participants?.length || 0);

    // Build update data
    const updateData: {
      startedAt?: Date;
      endedAt?: Date;
      actualDuration?: number;
      recordingUrls?: string[];
      recordingDuration?: number;
      status?: 'ONGOING' | 'COMPLETED';
    } = {};
    let needsUpdate = false;

    /* ----------------------------- Started At ------------------------------ */
    if (callData.call?.session?.started_at) {
      const startedAt = new Date(callData.call.session.started_at);
      console.log('⏱️  [STREAM-SYNC] Meeting started at:', startedAt.toISOString());
      updateData.startedAt = startedAt;
      needsUpdate = true;
    }

    /* ----------------------------- Ended At -------------------------------- */
    if (callData.call?.ended_at) {
      const endedAt = new Date(callData.call.ended_at);
      console.log('⏱️  [STREAM-SYNC] Meeting ended at:', endedAt.toISOString());
      updateData.endedAt = endedAt;
      updateData.status = 'COMPLETED';
      needsUpdate = true;
    } else if (callData.call?.session?.started_at) {
      // Meeting started but not ended yet
      updateData.status = 'ONGOING';
      needsUpdate = true;
    }

    /* --------------------------- Actual Duration --------------------------- */
    if (callData.call?.session?.started_at && callData.call?.ended_at) {
      const start = new Date(callData.call.session.started_at);
      const end = new Date(callData.call.ended_at);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      console.log('⏱️  [STREAM-SYNC] Calculating actual duration:');
      console.log('   - Start:', start.toISOString());
      console.log('   - End:', end.toISOString());
      console.log('   - Duration:', durationMinutes, 'minutes');

      updateData.actualDuration = durationMinutes;
      needsUpdate = true;
    }

    /* ----------------------------- Recordings ------------------------------ */
    console.log('🎥 [STREAM-SYNC] Checking for recordings...');
    try {
      const recordings = await call.listRecordings();

      if (recordings.recordings && recordings.recordings.length > 0) {
        const recordingUrls = recordings.recordings.map((r) => r.url);
        console.log('🎥 [STREAM-SYNC] Found', recordingUrls.length, 'recording(s)');

        // Log recording information
        recordings.recordings.forEach((r, index) => {
          console.log(`   - Recording ${index + 1}:`, r.url);
          console.log(`     Filename:`, r.filename);
        });

        updateData.recordingUrls = recordingUrls;
        needsUpdate = true;
      } else {
        console.log('ℹ️  [STREAM-SYNC] No recordings found');
      }
    } catch (recordingError) {
      console.log('⚠️  [STREAM-SYNC] Failed to fetch recordings:');
      console.log('   - Error:', recordingError instanceof Error ? recordingError.message : String(recordingError));
      console.log('   - Continuing without recording data...');
    }

    if (!needsUpdate) {
      console.log('ℹ️  [STREAM-SYNC] No updates needed');
      console.log('📡 [STREAM-SYNC] ==========================================\n');
      return null;
    }

    console.log('💾 [STREAM-SYNC] Updating database with:');
    console.log(JSON.stringify(updateData, null, 2));

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        host: true,
        participants: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    console.log('✅ [STREAM-SYNC] Successfully synced meeting data');
    console.log('📡 [STREAM-SYNC] ==========================================\n');

    return updatedMeeting;
  } catch (error) {
    console.error('❌ [STREAM-SYNC] Failed to sync from Stream:');
    console.error('   - Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('   - Stack:', error.stack);
    }
    console.log('📡 [STREAM-SYNC] ==========================================\n');
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                    GET: FETCH MEETING DETAILS (ROLE-BASED)                 */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('\n\n🚀 ================================================');
  console.log('🚀 [GET] Fetching meeting details');
  console.log('🚀 ================================================\n');

  try {
    const { id: streamCallId } = await params;
    console.log('📋 [GET] Stream Call ID:', streamCallId);

    const user = await getUserFromRequest(req);

    if (!user) {
      console.log('❌ [GET] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [GET] Finding user in database...');
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log('❌ [GET] User not found in database');
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    console.log('✅ [GET] User found:', dbUser.id);

    console.log('🔍 [GET] Finding meeting...');
    let meeting = await prisma.meeting.findUnique({
      where: { streamCallId },
      include: {
        host: true,
        participants: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!meeting) {
      console.log('❌ [GET] Meeting not found');
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    console.log('✅ [GET] Meeting found:', meeting.id);
    console.log('   - Title:', meeting.title);
    console.log('   - Status:', meeting.status);
    console.log('   - Host:', meeting.host.clerkId);

    // Determine user role
    const isHost = meeting.hostId === dbUser.id;
    const isParticipant = meeting.participants.some(p => p.userId === dbUser.id);

    console.log('👤 [GET] User role:');
    console.log('   - Is Host:', isHost);
    console.log('   - Is Participant:', isParticipant);

    // Sync data from GetStream.io
    console.log('🔄 [GET] Syncing latest data from Stream...');
    const syncedMeeting = await syncMeetingFromStream(meeting.id, streamCallId);

    // Use synced meeting if available, otherwise use original
    if (syncedMeeting) {
      console.log('✅ [GET] Using synced data from Stream');
      meeting = syncedMeeting;
    } else {
      console.log('ℹ️  [GET] Using existing database data');
    }

    // Role-based response
    if (isHost) {
      console.log('👑 [GET] User is HOST - returning full details');
      console.log('📊 [GET] Preparing detailed participant information...');

      // Format participant details with complete user information
      const participantDetails = meeting.participants.map((p, index) => {
        const fullName = [p.user.firstName, p.user.lastName]
          .filter(Boolean)
          .join(' ') || 'Unknown User';
        
        const username = p.user.username || p.user.email?.split('@')[0] || 'user';
        
        // Calculate duration in minutes and seconds
        const durationMinutes = p.duration ? Math.floor(p.duration / 60) : 0;
        const durationSeconds = p.duration ? p.duration % 60 : 0;
        const durationFormatted = p.duration 
          ? `${durationMinutes}m ${durationSeconds}s`
          : 'Still in meeting';

        console.log(`   ${index + 1}. ${fullName} (${p.user.email})`);
        console.log(`      - Username: ${username}`);
        console.log(`      - Joined: ${p.joinedAt.toISOString()}`);
        console.log(`      - Left: ${p.leftAt ? p.leftAt.toISOString() : 'Still in meeting'}`);
        console.log(`      - Duration: ${durationFormatted}`);
        console.log(`      - Mic: ${p.isMicMuted ? 'Muted' : 'Active'}`);
        console.log(`      - Camera: ${p.isCameraOff ? 'Off' : 'On'}`);

        return {
          // Participant record info
          participantId: p.id,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.duration,
          durationFormatted,
          
          // Device state
          isMicMuted: p.isMicMuted,
          isCameraOff: p.isCameraOff,
          
          // Complete user information
          user: {
            id: p.user.id,
            clerkId: p.user.clerkId,
            username: username,
            email: p.user.email,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            fullName: fullName,
            imageUrl: p.user.imageUrl,
          },
          
          // Metadata
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });

      console.log('📊 [GET] Response includes:');
      console.log('   - Complete meeting details');
      console.log('   - All timing information');
      console.log('   - Recording URLs and durations');
      console.log('   - Full participant list:', participantDetails.length);
      console.log('   - Complete user profiles (username, email, image)');
      console.log('   - Join/leave timestamps for each participant');
      console.log('   - Device states (mic/camera) for each participant');
      console.log('🚀 ================================================\n\n');

      return NextResponse.json({
        success: true,
        meeting: {
          // Basic Info
          id: meeting.id,
          streamCallId: meeting.streamCallId,
          title: meeting.title,
          description: meeting.description,
          scheduledFor: meeting.scheduledFor,
          duration: meeting.duration,
          status: meeting.status,

          // Timing
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,
          actualDuration: meeting.actualDuration,
          
          // Calculated time info
          scheduledDuration: meeting.duration,
          actualDurationFormatted: meeting.actualDuration 
            ? `${meeting.actualDuration} minutes` 
            : null,

          // Recordings
          recordingUrls: meeting.recordingUrls,
          recordingDuration: meeting.recordingDuration,
          recordingDurationFormatted: meeting.recordingDuration
            ? `${Math.floor(meeting.recordingDuration / 60)}m ${meeting.recordingDuration % 60}s`
            : null,
          hasRecordings: (meeting.recordingUrls?.length || 0) > 0,

          // Participants - Complete Details
          totalParticipants: meeting.totalParticipants,
          participants: participantDetails,

          // Host Info (Complete)
          host: {
            id: meeting.host.id,
            clerkId: meeting.host.clerkId,
            username: meeting.host.username || meeting.host.email?.split('@')[0] || 'host',
            email: meeting.host.email,
            firstName: meeting.host.firstName,
            lastName: meeting.host.lastName,
            fullName: [meeting.host.firstName, meeting.host.lastName]
              .filter(Boolean)
              .join(' ') || 'Host',
            imageUrl: meeting.host.imageUrl,
          },

          // Analytics Summary
          analytics: {
            totalParticipants: meeting.totalParticipants,
            participantsWhoLeft: participantDetails.filter(p => p.leftAt).length,
            participantsStillActive: participantDetails.filter(p => !p.leftAt).length,
            averageDuration: participantDetails.length > 0
              ? Math.round(
                  participantDetails
                    .filter(p => p.duration)
                    .reduce((sum, p) => sum + (p.duration || 0), 0) / 
                  participantDetails.filter(p => p.duration).length
                ) || 0
              : 0,
            participantsWithMicMuted: participantDetails.filter(p => p.isMicMuted).length,
            participantsWithCameraOff: participantDetails.filter(p => p.isCameraOff).length,
          },

          // Metadata
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
        },
        isHost: true,
        role: 'host',
      });
    } else if (isParticipant) {
      // Find participant's own data
      const participantData = meeting.participants.find(p => p.userId === dbUser.id);

      console.log('👥 [GET] User is PARTICIPANT - returning minimal details');
      console.log('📊 [GET] Response includes:');
      console.log('   - Basic meeting info only');
      console.log('   - Own participation data');
      console.log('   - Host name (not email)');
      console.log('🚀 ================================================\n\n');

      return NextResponse.json({
        success: true,
        meeting: {
          // Basic Info Only
          streamCallId: meeting.streamCallId,
          title: meeting.title,
          description: meeting.description,
          scheduledFor: meeting.scheduledFor,
          duration: meeting.duration,
          status: meeting.status,

          // Limited Timing Info
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,

          // Host Info (Limited)
          host: {
            firstName: meeting.host.firstName,
            lastName: meeting.host.lastName,
            imageUrl: meeting.host.imageUrl,
          },

          // Participant count only (not full list)
          totalParticipants: meeting.totalParticipants,

          // Own participation data
          myParticipation: participantData ? {
            joinedAt: participantData.joinedAt,
            leftAt: participantData.leftAt,
            duration: participantData.duration,
          } : null,
        },
        isHost: false,
        role: 'participant',
      });
    } else {
      console.log('🚫 [GET] User not authorized to view this meeting');
      console.log('🚀 ================================================\n\n');

      return NextResponse.json(
        { error: 'You are not authorized to view this meeting' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('\n❌ ================================================');
    console.error('❌ [GET] Error fetching meeting details');
    console.error('❌ ================================================');
    console.error(error);
    console.error('❌ ================================================\n\n');

    return NextResponse.json(
      { error: 'Failed to fetch meeting details' },
      { status: 500 }
    );
  }
}