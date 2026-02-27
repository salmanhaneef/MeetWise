// app/api/meeting/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { StreamClient } from "@stream-io/node-sdk";
import prisma, { MeetingStatus } from "@/lib/prisma";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_SECRET_KEY;

/* -------------------------------------------------------------------------- */
/*                          AUTH HELPER                                        */
/* -------------------------------------------------------------------------- */

async function getUserFromRequest(req: NextRequest) {
  console.log("🔐 [AUTH] Authenticating user...");
  
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_TEST_AUTH === "true"
  ) {
    const testUserId = req.nextUrl.searchParams.get("testUserId");
    if (testUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: testUserId },
      });
      if (user) {
        console.log("🧪 [AUTH] Using validated test user:", testUserId);
        return { id: testUserId };
      }
    }
  }
  
  const user = await currentUser();
  console.log("✅ [AUTH] User authenticated:", user?.id || "None");
  return user;
}

/* -------------------------------------------------------------------------- */
/*                         GET: FETCH ALL MEETINGS                             */
/* -------------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [GET] Fetching all meetings");
  console.log("🚀 ================================================\n");

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      console.log("❌ [GET] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔍 [GET] Finding user in database...");
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log("❌ [GET] User not found in database");
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    console.log("✅ [GET] User found:", dbUser.id);
    console.log("🔍 [GET] Fetching meetings...");

    const allMeetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: dbUser.id },
          { participants: { some: { userId: dbUser.id } } },
        ],
      },
      include: {
        host: true,
        participants: { include: { user: true } },
      },
      orderBy: { scheduledFor: "desc" },
    });

    console.log("📊 [GET] Found", allMeetings.length, "meetings");
    console.log("   - As host:", allMeetings.filter(m => m.hostId === dbUser.id).length);
    console.log("   - As participant:", allMeetings.filter(m => m.hostId !== dbUser.id).length);
    console.log("✅ [GET] Fetch completed successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      meetings: allMeetings,
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [GET] Error fetching meetings");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                         POST: CREATE NEW MEETING                            */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [POST] Creating new meeting");
  console.log("🚀 ================================================\n");

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      console.log("❌ [POST] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!apiKey || !apiSecret) {
      console.log("❌ [POST] Stream credentials missing");
      return NextResponse.json(
        { error: "Stream credentials missing" },
        { status: 500 }
      );
    }

    console.log("🔍 [POST] Finding user in database...");
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log("❌ [POST] User not found in database");
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    console.log("✅ [POST] User found:", dbUser.id);

    const body = await req.json();
    const { title, description, scheduledFor, duration } = body;

    console.log("📋 [POST] Meeting details:");
    console.log("   - Title:", title);
    console.log("   - Description:", description || "None");
    console.log("   - Scheduled for:", scheduledFor);
    console.log("   - Duration:", duration, "minutes");

    // Validation
    if (!title || !scheduledFor || !duration) {
      console.log("❌ [POST] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: title, scheduledFor, duration" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      console.log("❌ [POST] Invalid date format:", scheduledFor);
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    console.log("📞 [POST] Creating Stream call...");
    const client = new StreamClient(apiKey, apiSecret);
    const callId = `meeting-${Date.now()}`;
    const call = client.video.call("default", callId);

    await call.getOrCreate({
      data: {
        created_by_id: user.id,
        starts_at: scheduledDate,
        custom: {
          title,
          description: description || "",
          duration,
          hostId: user.id,
          hostName:
            ("username" in user && user.username) ||
            ("firstName" in user && user.firstName) ||
            "User",
          status: MeetingStatus.SCHEDULED,
        },
      },
    });

    console.log("✅ [POST] Stream call created:", callId);

    console.log("💾 [POST] Saving meeting to database...");
    const meeting = await prisma.meeting.create({
      data: {
        streamCallId: callId,
        title,
        description,
        scheduledFor: scheduledDate,
        duration,
        hostId: dbUser.id,
        status: MeetingStatus.SCHEDULED,
      },
      include: {
        host: true,
        participants: { include: { user: true } },
      },
    });

    console.log("✅ [POST] Meeting created successfully:", meeting.id);
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      meeting,
      callId,
      message: "Meeting created successfully",
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [POST] Error creating meeting");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                         PATCH: UPDATE MEETING                               */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: NextRequest) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [PATCH] Updating meeting");
  console.log("🚀 ================================================\n");

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      console.log("❌ [PATCH] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { meetingId, title, description, scheduledFor, duration } = body;

    console.log("📋 [PATCH] Update request:");
    console.log("   - Meeting ID:", meetingId);
    console.log("   - New title:", title || "Not changing");
    console.log("   - New description:", description !== undefined ? description : "Not changing");
    console.log("   - New scheduled time:", scheduledFor || "Not changing");
    console.log("   - New duration:", duration || "Not changing");

    if (!meetingId) {
      console.log("❌ [PATCH] Missing meeting ID");
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    // Find user in database
    console.log("🔍 [PATCH] Finding user in database...");
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log("❌ [PATCH] User not found in database");
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    console.log("✅ [PATCH] User found:", dbUser.id);

    // Find meeting
    console.log("🔍 [PATCH] Finding meeting...");
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { host: true },
    });

    if (!meeting) {
      console.log("❌ [PATCH] Meeting not found");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ [PATCH] Meeting found:", meeting.id);
    console.log("👑 [PATCH] Meeting host:", meeting.host.clerkId);

    // Authorization check - only host can update
    if (meeting.hostId !== dbUser.id) {
      console.log("🚫 [PATCH] User is not the host");
      console.log("   - Host ID:", meeting.hostId);
      console.log("   - User ID:", dbUser.id);
      return NextResponse.json(
        { error: "Only the meeting host can update this meeting" },
        { status: 403 }
      );
    }

    console.log("✅ [PATCH] User is the host, proceeding...");

    // Check meeting status - can't update completed or cancelled meetings
    if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
      console.log("🚫 [PATCH] Cannot update", meeting.status.toLowerCase(), "meeting");
      return NextResponse.json(
        { error: `Cannot update ${meeting.status.toLowerCase()} meetings` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      title?: string;
      description?: string;
      scheduledFor?: Date;
      duration?: number;
    } = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (scheduledFor !== undefined) {
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        console.log("❌ [PATCH] Invalid date format:", scheduledFor);
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
      updateData.scheduledFor = scheduledDate;
    }

    if (duration !== undefined) {
      if (typeof duration !== 'number' || duration <= 0) {
        console.log("❌ [PATCH] Invalid duration:", duration);
        return NextResponse.json(
          { error: "Duration must be a positive number" },
          { status: 400 }
        );
      }
      updateData.duration = duration;
    }

    if (Object.keys(updateData).length === 0) {
      console.log("⚠️  [PATCH] No fields to update");
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    console.log("📝 [PATCH] Fields to update:", Object.keys(updateData));

    // Update Stream call FIRST to ensure consistency
    if (apiKey && apiSecret) {
      console.log("📞 [PATCH] Updating Stream call...");
      
      try {
        const client = new StreamClient(apiKey, apiSecret);
        const call = client.video.call("default", meeting.streamCallId);

        // Fetch current call data to preserve existing custom fields
        console.log("🔍 [PATCH] Fetching current Stream call data...");
        const callResponse = await call.get();
        const currentCustomData = callResponse.call.custom || {};

        console.log("📦 [PATCH] Current custom data:", currentCustomData);

        // Build Stream update data
        const streamUpdateData: {
          starts_at?: Date;
          custom?: Record<string, unknown>;
        } = {};

        // Update starts_at if scheduledFor is provided
        if (updateData.scheduledFor) {
          streamUpdateData.starts_at = updateData.scheduledFor;
          console.log("📅 [PATCH] Updating starts_at:", streamUpdateData.starts_at);
        }

        // Merge custom fields - preserve existing data and update only what's changed
        streamUpdateData.custom = {
          ...currentCustomData,
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(duration !== undefined && { duration }),
        };

        console.log("📦 [PATCH] Updated custom data:", streamUpdateData.custom);

        // Perform the update
        await call.update(streamUpdateData);
        console.log("✅ [PATCH] Stream call updated successfully");
      } catch (streamError) {
        console.error("❌ [PATCH] Failed to update Stream call:", streamError);
        console.error("   - Error details:", streamError instanceof Error ? streamError.message : streamError);
        
        // CRITICAL: If Stream update fails, don't update database
        // This ensures data consistency between Stream and database
        return NextResponse.json(
          { error: "Failed to sync with video provider. Please try again." },
          { status: 500 }
        );
      }
    } else {
      console.log("⚠️  [PATCH] Stream credentials not available, skipping Stream update");
    }

    // Update database AFTER Stream update succeeds
    console.log("💾 [PATCH] Updating database...");
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        host: true,
        participants: { include: { user: true } },
      },
    });

    console.log("✅ [PATCH] Meeting updated successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      meeting: updatedMeeting,
      message: "Meeting updated successfully",
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [PATCH] Error updating meeting");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                         DELETE: CANCEL MEETING                              */
/* -------------------------------------------------------------------------- */

export async function DELETE(req: NextRequest) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [DELETE] Cancelling meeting");
  console.log("🚀 ================================================\n");

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      console.log("❌ [DELETE] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const meetingId = searchParams.get("meetingId");

    console.log("📋 [DELETE] Meeting ID:", meetingId);

    if (!meetingId) {
      console.log("❌ [DELETE] Missing meeting ID");
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    // Find user in database
    console.log("🔍 [DELETE] Finding user in database...");
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      console.log("❌ [DELETE] User not found in database");
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    console.log("✅ [DELETE] User found:", dbUser.id);

    // Find meeting
    console.log("🔍 [DELETE] Finding meeting...");
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { 
        host: true,
        participants: true,
      },
    });

    if (!meeting) {
      console.log("❌ [DELETE] Meeting not found");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ [DELETE] Meeting found:", meeting.id);
    console.log("   - Title:", meeting.title);
    console.log("   - Status:", meeting.status);
    console.log("   - Host:", meeting.host.clerkId);
    console.log("   - Participants:", meeting.participants.length);

    // Authorization check - only host can delete
    if (meeting.hostId !== dbUser.id) {
      console.log("🚫 [DELETE] User is not the host");
      return NextResponse.json(
        { error: "Only the meeting host can cancel this meeting" },
        { status: 403 }
      );
    }

    console.log("✅ [DELETE] User is the host, proceeding...");

    // Check if already cancelled or completed
    if (meeting.status === MeetingStatus.CANCELLED) {
      console.log("⚠️  [DELETE] Meeting already cancelled");
      return NextResponse.json(
        { 
          success: true,
          message: "Meeting is already cancelled",
          meeting 
        },
        { status: 200 }
      );
    }

    if (meeting.status === MeetingStatus.COMPLETED) {
      console.log("🚫 [DELETE] Cannot cancel completed meeting");
      return NextResponse.json(
        { error: "Cannot cancel a completed meeting" },
        { status: 400 }
      );
    }

    // Update Stream call FIRST to ensure consistency
    if (apiKey && apiSecret) {
      console.log("📞 [DELETE] Updating Stream call...");
      
      try {
        const client = new StreamClient(apiKey, apiSecret);
        const call = client.video.call("default", meeting.streamCallId);
        
        // Fetch current call data
        console.log("🔍 [DELETE] Fetching current Stream call data...");
        const callResponse = await call.get();
        const currentCustomData = callResponse.call.custom || {};

        // If meeting is ongoing, end the call first
        if (meeting.status === MeetingStatus.ONGOING) {
          console.log("🛑 [DELETE] Ending ongoing call...");
          await call.end();
          console.log("✅ [DELETE] Call ended successfully");
        }

        // Update custom data to mark as cancelled
        console.log("📦 [DELETE] Marking call as cancelled in Stream...");
        await call.update({
          custom: {
            ...currentCustomData,
            status: MeetingStatus.CANCELLED,
            cancelledAt: new Date(),
          }
        });

        console.log("✅ [DELETE] Stream call updated successfully");
      } catch (streamError) {
        console.error("❌ [DELETE] Failed to update Stream call:", streamError);
        console.error("   - Error details:", streamError instanceof Error ? streamError.message : streamError);
        
        // CRITICAL: If Stream update fails, don't update database
        // This ensures data consistency
        return NextResponse.json(
          { error: "Failed to sync with video provider. Please try again." },
          { status: 500 }
        );
      }
    } else {
      console.log("⚠️  [DELETE] Stream credentials not available, skipping Stream update");
    }

    // Update meeting status to CANCELLED in database AFTER Stream update succeeds
    console.log("💾 [DELETE] Marking meeting as CANCELLED in database...");
    const cancelledMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.CANCELLED,
        endedAt: new Date(),
      },
      include: {
        host: true,
        participants: { include: { user: true } },
      },
    });

    console.log("✅ [DELETE] Meeting cancelled successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      meeting: cancelledMeeting,
      message: "Meeting cancelled successfully",
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [DELETE] Error cancelling meeting");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to cancel meeting" },
      { status: 500 }
    );
  }
}