// app/api/meetings/previous/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser, User } from "@clerk/nextjs/server";
import { StreamClient } from "@stream-io/node-sdk";
import prisma from "@/lib/prisma";

/* -------------------------------------------------------------------------- */
/*                               LOCAL TYPES                                  */
/* -------------------------------------------------------------------------- */

type MeetingStatus = "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";

interface Meeting {
  id: string;
  hostId: string;
  scheduledFor: Date;
  duration: number;
  status: MeetingStatus;
  streamCallId: string | null;
  endedAt: Date | null;
  actualDuration: number | null;
  recordingUrls: string[] | null;
}

/* -------------------------------------------------------------------------- */
/*                               ENV (SERVER)                                  */
/* -------------------------------------------------------------------------- */

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

/* -------------------------------------------------------------------------- */
/*                     AUTH HELPER (Matches /api/meeting pattern)             */
/* -------------------------------------------------------------------------- */

async function getUserFromRequest(
  req: NextRequest
): Promise<User | null> {
  console.log("🔐 [AUTH] Starting authentication...");
  
  // Test auth for development
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_TEST_AUTH === "true"
  ) {
    const testUserId = req.nextUrl.searchParams.get("testUserId");

    if (testUserId) {
      console.log("🧪 [AUTH] Test mode enabled, checking user:", testUserId);
      
      const user = await prisma.user.findUnique({
        where: { clerkId: testUserId },
      });

      if (user) {
        console.log("✅ [AUTH] Test user validated:", testUserId);
        return {
          id: testUserId,
          username: user.username || null,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          imageUrl: user.imageUrl || null,
          emailAddresses: user.email
            ? [{ emailAddress: user.email }]
            : [],
        } as User;
      } else {
        console.log("❌ [AUTH] Test user not found in database");
      }
    }
  }

  // Production: Use Clerk authentication
  const clerkUser = await currentUser();
  console.log("✅ [AUTH] Clerk user:", clerkUser ? clerkUser.id : "Not found");
  return clerkUser;
}

/* -------------------------------------------------------------------------- */
/*                     STREAM SYNC (SAFE + TYPED)                              */
/* -------------------------------------------------------------------------- */

async function syncPreviousMeetingWithStream(
  meeting: Meeting
): Promise<Meeting> {
  console.log("\n📡 [SYNC] ==========================================");
  console.log("📡 [SYNC] Starting sync for meeting:", meeting.id);
  console.log("📡 [SYNC] Stream Call ID:", meeting.streamCallId);
  console.log("📡 [SYNC] Current Status:", meeting.status);
  console.log("📡 [SYNC] Scheduled For:", meeting.scheduledFor);
  
  // Check environment variables
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.log("⚠️  [SYNC] Missing Stream credentials:");
    console.log("   - API Key:", STREAM_API_KEY ? "Present" : "MISSING");
    console.log("   - API Secret:", STREAM_API_SECRET ? "Present" : "MISSING");
    return meeting;
  }

  if (!meeting.streamCallId) {
    console.log("⚠️  [SYNC] No streamCallId for meeting:", meeting.id);
    return meeting;
  }

  try {
    console.log("🔌 [SYNC] Connecting to Stream...");
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const call = client.video.call("default", meeting.streamCallId);

    console.log("📞 [SYNC] Fetching call data from Stream...");
    const callData = await call.get();
    
    console.log("📊 [SYNC] Stream Call Data:");
    console.log("   - Call ID:", callData.call?.id);
    console.log("   - Call CID:", callData.call?.cid);
    console.log("   - Created At:", callData.call?.created_at);
    console.log("   - Started At:", callData.call?.session?.started_at);
    console.log("   - Ended At:", callData.call?.ended_at);
    console.log("   - Live:", );
    console.log("   - Participants Count:", callData.call?.session?.participants_count_by_role);

    const updateData: {
      status?: "COMPLETED";
      endedAt?: Date;
      actualDuration?: number;
      recordingUrls?: string[];
    } = {};
    let needsUpdate = false;

    /* ----------------------------- Completion ------------------------------ */
    if (callData.call?.ended_at && meeting.status !== "COMPLETED") {
      console.log("✅ [SYNC] Call ended, updating status to COMPLETED");
      console.log("   - Stream ended_at:", callData.call.ended_at);
      
      updateData.status = "COMPLETED";
      updateData.endedAt = new Date(callData.call.ended_at);
      needsUpdate = true;
    } else if (callData.call?.ended_at) {
      console.log("ℹ️  [SYNC] Call already marked as COMPLETED");
    } else {
      console.log("ℹ️  [SYNC] Call not yet ended on Stream");
    }

    /* --------------------------- Actual Duration --------------------------- */
    if (callData.call?.session?.started_at && callData.call?.ended_at) {
      const start = new Date(callData.call.session.started_at);
      const end = new Date(callData.call.ended_at);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);

      console.log("⏱️  [SYNC] Calculating actual duration:");
      console.log("   - Start:", start.toISOString());
      console.log("   - End:", end.toISOString());
      console.log("   - Duration:", duration, "minutes");

      updateData.actualDuration = duration;
      needsUpdate = true;
    } else {
      console.log("⚠️  [SYNC] Cannot calculate duration:");
      console.log("   - Has started_at:", !!callData.call?.session?.started_at);
      console.log("   - Has ended_at:", !!callData.call?.ended_at);
    }

    /* ----------------------------- Recordings ------------------------------ */
    console.log("🎥 [SYNC] Checking for recordings...");
    try {
      const recordings = await call.listRecordings();
      
      console.log("🎥 [SYNC] Recordings response:");
      console.log("   - Count:", recordings.recordings?.length ?? 0);
      
      if (recordings.recordings?.length) {
        updateData.recordingUrls = recordings.recordings.map(
          (r: { url: string; filename?: string }) => {
            console.log("   - Recording URL:", r.url);
            console.log("   - Filename:", r.filename || "N/A");
            return r.url;
          }
        );
        needsUpdate = true;
      } else {
        console.log("ℹ️  [SYNC] No recordings found");
      }
    } catch (recordingError) {
      console.log("⚠️  [SYNC] Failed to fetch recordings:");
      console.log("   - Error:", recordingError instanceof Error ? recordingError.message : String(recordingError));
    }

    if (!needsUpdate) {
      console.log("ℹ️  [SYNC] No updates needed for meeting:", meeting.id);
      console.log("📡 [SYNC] ==========================================\n");
      return meeting;
    }

    console.log("💾 [SYNC] Updating database with:");
    console.log(JSON.stringify(updateData, null, 2));

    const updatedMeeting = (await prisma.meeting.update({
      where: { id: meeting.id },
      data: updateData,
    })) as Meeting;

    console.log("✅ [SYNC] Successfully updated meeting:", meeting.id);
    console.log("📡 [SYNC] ==========================================\n");
    
    return updatedMeeting;
  } catch (error) {
    console.error("❌ [SYNC] Stream sync failed for meeting:", meeting.id);
    console.error("❌ [SYNC] Error details:");
    
    if (error instanceof Error) {
      console.error("   - Message:", error.message);
      console.error("   - Stack:", error.stack);
    } else {
      console.error("   - Error:", error);
    }
    
    console.log("📡 [SYNC] ==========================================\n");
    return meeting;
  }
}

/* -------------------------------------------------------------------------- */
/*                     AUTO COMPLETE PAST MEETINGS                             */
/* -------------------------------------------------------------------------- */

async function autoCompletePastMeetings(userId: string): Promise<number> {
  console.log("\n🕐 [AUTO-COMPLETE] Starting auto-completion check for user:", userId);
  
  const now = new Date();
  console.log("🕐 [AUTO-COMPLETE] Current time:", now.toISOString());

  const meetings = (await prisma.meeting.findMany({
    where: {
      OR: [{ hostId: userId }, { participants: { some: { userId } } }],
      status: { in: ["SCHEDULED", "ONGOING"] },
    },
  })) as Meeting[];

  console.log("🕐 [AUTO-COMPLETE] Found", meetings.length, "active meetings");

  const expired = meetings.filter((m) => {
    const endTime = new Date(m.scheduledFor).getTime() + m.duration * 60000;
    const isExpired = endTime < now.getTime();
    
    console.log("   - Meeting:", m.id);
    console.log("     Scheduled:", m.scheduledFor.toISOString());
    console.log("     Duration:", m.duration, "min");
    console.log("     End time:", new Date(endTime).toISOString());
    console.log("     Expired:", isExpired);
    
    return isExpired;
  });

  console.log("🕐 [AUTO-COMPLETE] Found", expired.length, "expired meetings");

  if (!expired.length) {
    console.log("🕐 [AUTO-COMPLETE] No meetings to auto-complete\n");
    return 0;
  }

  const expiredIds = expired.map((m) => m.id);
  console.log("🕐 [AUTO-COMPLETE] Auto-completing meetings:", expiredIds);

  await prisma.meeting.updateMany({
    where: { id: { in: expiredIds } },
    data: {
      status: "COMPLETED",
      endedAt: now,
    },
  });

  console.log("✅ [AUTO-COMPLETE] Successfully completed", expired.length, "meetings\n");
  return expired.length;
}

/* -------------------------------------------------------------------------- */
/*                                   GET                                      */
/* -------------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [API] GET /api/meetings/previous");
  console.log("🚀 [API] Timestamp:", new Date().toISOString());
  console.log("🚀 ================================================\n");

  try {
    // Authentication
    const user = await getUserFromRequest(req);
    if (!user) {
      console.log("❌ [API] Authentication failed - No user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ [API] User authenticated:", user.id);

    // Find user in database
    console.log("🔍 [API] Looking up user in database...");
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log("❌ [API] User not found in database");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("✅ [API] Database user found:", dbUser.id);

    // Auto-complete past meetings
    const completedCount = await autoCompletePastMeetings(dbUser.id);
    console.log("📊 [API] Auto-completed", completedCount, "meetings");

    // Fetch previous meetings
    console.log("🔍 [API] Fetching previous meetings...");
    const meetings = (await prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: dbUser.id },
          { participants: { some: { userId: dbUser.id } } },
        ],
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { scheduledFor: "desc" },
    })) as Meeting[];

    console.log("📊 [API] Found", meetings.length, "previous meetings");
    
    meetings.forEach((m, index) => {
      console.log(`   ${index + 1}. Meeting ${m.id}:`);
      console.log(`      - Status: ${m.status}`);
      console.log(`      - Stream Call ID: ${m.streamCallId || 'None'}`);
      console.log(`      - Scheduled: ${m.scheduledFor.toISOString()}`);
      console.log(`      - Has Recordings: ${(m.recordingUrls?.length ?? 0) > 0}`);
    });

    // Sync with Stream
    console.log("\n🔄 [API] Starting Stream sync for all meetings...");
    const synced = await Promise.all(
      meetings.map((m) => syncPreviousMeetingWithStream(m))
    );

    console.log("✅ [API] Stream sync completed for all meetings");

    // Prepare response
    const response = {
      success: true,
      meetings: synced.map((m) => ({
        ...m,
        computed: {
          hasRecording: (m.recordingUrls?.length ?? 0) > 0,
          actualDuration: m.actualDuration ?? m.duration,
        },
      })),
    };

    console.log("\n📤 [API] Sending response:");
    console.log("   - Total meetings:", response.meetings.length);
    console.log("   - With recordings:", response.meetings.filter(m => m.computed.hasRecording).length);

    console.log("\n🚀 ================================================");
    console.log("🚀 [API] Request completed successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json(response);
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [API] FATAL ERROR");
    console.error("❌ ================================================");
    
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Error:", error);
    }
    
    console.error("❌ ================================================\n\n");

    return NextResponse.json(
      { error: "Failed to load meetings" },
      { status: 500 }
    );
  }
}