// app/api/meeting/[id]/participant/route.ts
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
  console.log("🔐 [AUTH] Authenticating user...");
  
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
/*                    SYNC PARTICIPANT DATA FROM STREAM                        */
/* -------------------------------------------------------------------------- */

async function syncParticipantDataFromStream(
  streamCallId: string,
  clerkId: string,
  hostClerkId: string // ✅ NEW: Pass host ID to check
) {
  console.log("\n📡 [STREAM-SYNC] ==========================================");
  console.log("📡 [STREAM-SYNC] Syncing participant data from GetStream.io");
  console.log("📡 [STREAM-SYNC] Call ID:", streamCallId);
  console.log("📡 [STREAM-SYNC] Clerk ID:", clerkId);
  console.log("📡 [STREAM-SYNC] Host Clerk ID:", hostClerkId);

  // ✅ CHECK: Don't sync if this is the host
  if (clerkId === hostClerkId) {
    console.log("🚫 [STREAM-SYNC] User is HOST - skipping participant sync");
    console.log("📡 [STREAM-SYNC] ==========================================\n");
    return null;
  }

  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.log("⚠️  [STREAM-SYNC] Missing Stream credentials, skipping sync");
    return null;
  }

  try {
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const call = client.video.call("default", streamCallId);

    console.log("📞 [STREAM-SYNC] Fetching call data...");
    const callData = await call.get();

    console.log("📊 [STREAM-SYNC] Call Session Data:");
    console.log("   - Started At:", callData.call?.session?.started_at);
    console.log("   - Ended At:", callData.call?.ended_at);
    console.log("   - Participants:", callData.call?.session?.participants?.length || 0);

    // Find participant in Stream session
    const participants = callData.call?.session?.participants || [];
    const streamParticipant = participants.find(
      (p) => p.user.id === clerkId
    );

    if (streamParticipant) {
      console.log("✅ [STREAM-SYNC] Found participant in Stream:");
      console.log("   - User ID:", streamParticipant.user.id);
      console.log("   - Name:", streamParticipant.user.name);
      console.log("   - Image:", streamParticipant.user.image);
      console.log("   - Joined At:", streamParticipant.joined_at);
      
      console.log("📡 [STREAM-SYNC] ==========================================\n");
      
      return {
        joinedAt: streamParticipant.joined_at ? new Date(streamParticipant.joined_at) : new Date(),
        isMicMuted: false, // Stream doesn't expose this in call.get()
        isCameraOff: false, // Stream doesn't expose this in call.get()
        userData: {
          name: streamParticipant.user.name || undefined,
          image: streamParticipant.user.image || undefined,
        }
      };
    } else {
      console.log("⚠️  [STREAM-SYNC] Participant not found in Stream session");
      console.log("📡 [STREAM-SYNC] ==========================================\n");
      return null;
    }
  } catch (error) {
    console.error("❌ [STREAM-SYNC] Failed to sync from Stream:");
    console.error("   - Error:", error instanceof Error ? error.message : String(error));
    console.log("📡 [STREAM-SYNC] ==========================================\n");
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                    SYNC ALL PARTICIPANTS FROM STREAM                        */
/* -------------------------------------------------------------------------- */

async function syncAllParticipantsFromStream(
  streamCallId: string,
  meetingId: string,
  hostClerkId: string // ✅ NEW: Pass host ID to filter
) {
  console.log("\n🔄 [BULK-SYNC] ==========================================");
  console.log("🔄 [BULK-SYNC] Syncing all participants from Stream");
  console.log("🔄 [BULK-SYNC] Call ID:", streamCallId);
  console.log("🔄 [BULK-SYNC] Host Clerk ID:", hostClerkId);

  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.log("⚠️  [BULK-SYNC] Missing Stream credentials");
    return;
  }

  try {
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const call = client.video.call("default", streamCallId);

    const callData = await call.get();
    const allParticipants = callData.call?.session?.participants || [];

    console.log("📊 [BULK-SYNC] Total participants in Stream:", allParticipants.length);

    // ✅ FILTER: Remove host from participants list
    const participantsOnly = allParticipants.filter(
      (p) => p.user.id !== hostClerkId
    );

    console.log("📊 [BULK-SYNC] After filtering out host:", participantsOnly.length, "participants");
    console.log("🚫 [BULK-SYNC] Excluded host:", hostClerkId);

    for (const streamParticipant of participantsOnly) {
      const clerkId = streamParticipant.user.id;
      
      console.log("\n   👤 Processing participant:", clerkId);
      console.log("   ✅ Confirmed: NOT the host");

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        console.log("   📝 Creating new user in database");
        
        const userName = streamParticipant.user.name || 'User';
        const [firstName, ...lastNameParts] = userName.split(' ');
        
        user = await prisma.user.create({
          data: {
            clerkId,
            email: `${clerkId}@placeholder.local`,
            firstName: firstName || 'User',
            lastName: lastNameParts.join(' ') || '',
            imageUrl: streamParticipant.user.image || null,
          },
        });
        
        console.log("   ✅ User created:", user.id);
      } else {
        // Update user info if Stream has newer data
        const updates: {
          imageUrl?: string | null;
          firstName?: string;
          lastName?: string;
        } = {};
        
        if (streamParticipant.user.image && streamParticipant.user.image !== user.imageUrl) {
          updates.imageUrl = streamParticipant.user.image;
        }
        
        if (streamParticipant.user.name) {
          const [firstName, ...lastNameParts] = streamParticipant.user.name.split(' ');
          if (firstName && firstName !== user.firstName) {
            updates.firstName = firstName;
          }
          const lastName = lastNameParts.join(' ');
          if (lastName && lastName !== user.lastName) {
            updates.lastName = lastName;
          }
        }

        if (Object.keys(updates).length > 0) {
          console.log("   📝 Updating user info:", Object.keys(updates));
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      }

      // Check if participant record exists
      const existingParticipant = await prisma.meetingParticipant.findUnique({
        where: {
          meetingId_userId: {
            meetingId,
            userId: user.id,
          },
        },
      });

      if (!existingParticipant) {
        console.log("   📝 Creating participant record");
        
        await prisma.meetingParticipant.create({
          data: {
            meetingId,
            userId: user.id,
            joinedAt: streamParticipant.joined_at ? new Date(streamParticipant.joined_at) : new Date(),
            isMicMuted: false,
            isCameraOff: false,
          },
        });
        
        console.log("   ✅ Participant record created");
      } else {
        console.log("   ℹ️  Participant already exists, skipping");
      }
    }

    console.log("\n📊 [BULK-SYNC] Summary:");
    console.log("   - Total in Stream:", allParticipants.length);
    console.log("   - Host (excluded):", 1);
    console.log("   - Participants saved:", participantsOnly.length);
    console.log("🔄 [BULK-SYNC] ==========================================\n");
  } catch (error) {
    console.error("❌ [BULK-SYNC] Failed:", error instanceof Error ? error.message : String(error));
    console.log("🔄 [BULK-SYNC] ==========================================\n");
  }
}

/* -------------------------------------------------------------------------- */
/*                         POST: ADD PARTICIPANT                               */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [POST] Adding participant to meeting");
  console.log("🚀 ================================================\n");

  try {
    // 1️⃣ Await route params
    const { id: streamCallId } = await params;
    console.log("📋 [POST] Stream Call ID:", streamCallId);

    if (!streamCallId) {
      return NextResponse.json(
        { error: "Meeting ID missing" },
        { status: 400 }
      );
    }

    // 2️⃣ Get Clerk user ID (test or real)
    const { searchParams } = new URL(req.url);
    const clerkId = searchParams.get("testUserId");
    console.log("👤 [POST] Clerk ID:", clerkId);

    if (!clerkId) {
      return NextResponse.json(
        { error: "Clerk user ID missing" },
        { status: 400 }
      );
    }

    // 3️⃣ Find meeting
    console.log("🔍 [POST] Finding meeting...");
    const meeting = await prisma.meeting.findUnique({
      where: { streamCallId },
      include: {
        host: {
          select: {
            clerkId: true,
          },
        },
      },
    });

    if (!meeting) {
      console.log("❌ [POST] Meeting not found");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ [POST] Meeting found:", meeting.id);
    console.log("👑 [POST] Host Clerk ID:", meeting.host.clerkId);

    // ✅ 4️⃣ CHECK: Is this user the host?
    if (clerkId === meeting.host.clerkId) {
      console.log("🚫 [POST] User is the HOST - not adding to participants table");
      console.log("ℹ️  [POST] Hosts are tracked in the meetings table, not participants table");
      console.log("🚀 ================================================\n\n");
      
      return NextResponse.json(
        { 
          message: "Host does not need participant tracking",
          isHost: true,
        },
        { status: 200 }
      );
    }

    console.log("✅ [POST] User is a PARTICIPANT (not host), proceeding...");

    // 5️⃣ Sync participant data from Stream (with host check)
    const streamData = await syncParticipantDataFromStream(
      streamCallId, 
      clerkId,
      meeting.host.clerkId // Pass host ID
    );

    // 6️⃣ Find or create User with Stream data
    console.log("🔍 [POST] Finding or creating user...");
    let user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      console.log("📝 [POST] Creating new user");
      
      const userName = streamData?.userData?.name || 'User';
      const [firstName, ...lastNameParts] = userName.split(' ');
      
      user = await prisma.user.create({
        data: {
          clerkId,
          email: `${clerkId}@placeholder.local`,
          firstName: firstName || "User",
          lastName: lastNameParts.join(' ') || "",
          imageUrl: streamData?.userData?.image || null,
        },
      });
      
      console.log("✅ [POST] User created:", user.id);
    } else {
      console.log("✅ [POST] User found:", user.id);
      
      // Update user with Stream data if available
      if (streamData?.userData) {
        const updates: {
          imageUrl?: string | null;
          firstName?: string;
          lastName?: string;
        } = {};
        
        if (streamData.userData.image && streamData.userData.image !== user.imageUrl) {
          updates.imageUrl = streamData.userData.image;
        }
        
        if (streamData.userData.name) {
          const [firstName, ...lastNameParts] = streamData.userData.name.split(' ');
          if (firstName && firstName !== user.firstName) {
            updates.firstName = firstName;
          }
          const lastName = lastNameParts.join(' ');
          if (lastName && lastName !== user.lastName) {
            updates.lastName = lastName;
          }
        }

        if (Object.keys(updates).length > 0) {
          console.log("📝 [POST] Updating user with Stream data:", Object.keys(updates));
          user = await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      }
    }

    // 7️⃣ Prevent duplicate participant
    console.log("🔍 [POST] Checking for existing participation...");
    const alreadyJoined = await prisma.meetingParticipant.findUnique({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId: user.id,
        },
      },
    });

    if (alreadyJoined) {
      console.log("ℹ️  [POST] User already joined meeting");
      return NextResponse.json(
        { 
          message: "User already joined meeting",
          participant: alreadyJoined 
        },
        { status: 200 }
      );
    }

    // 8️⃣ Transaction-safe join with Stream data
    console.log("💾 [POST] Creating participant record...");
    const participant = await prisma.$transaction(async (tx) => {
      const created = await tx.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId: user.id,
          joinedAt: streamData?.joinedAt || new Date(),
          isMicMuted: streamData?.isMicMuted ?? false,
          isCameraOff: streamData?.isCameraOff ?? false,
        },
        include: {
          user: {
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
      });

      // Update total participants count (excluding host)
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          totalParticipants: { increment: 1 },
          status: meeting.status === "SCHEDULED" ? "ONGOING" : meeting.status,
        },
      });

      return created;
    });

    console.log("✅ [POST] Participant added successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [POST] Error adding participant");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                       PATCH: UPDATE PARTICIPANT (LEAVE)                     */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [PATCH] Updating participant (leave)");
  console.log("🚀 ================================================\n");

  try {
    // ✅ Await params
    const { id: streamCallId } = await params;
    console.log("📋 [PATCH] Stream Call ID:", streamCallId);

    const user = await getUserFromRequest(req);
    if (!user) {
      console.log("❌ [PATCH] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Find meeting
    console.log("🔍 [PATCH] Finding meeting...");
    const meeting = await prisma.meeting.findUnique({
      where: { streamCallId },
      include: {
        host: {
          select: {
            clerkId: true,
          },
        },
      },
    });

    if (!meeting) {
      console.log("❌ [PATCH] Meeting not found");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ [PATCH] Meeting found:", meeting.id);
    console.log("👑 [PATCH] Host Clerk ID:", meeting.host.clerkId);

    // ✅ CHECK: Is this user the host?
    if (user.id === meeting.host.clerkId) {
      console.log("🚫 [PATCH] User is the HOST - not updating participants table");
      console.log("🚀 ================================================\n\n");
      
      return NextResponse.json(
        { 
          message: "Host does not need participant tracking",
          isHost: true,
        },
        { status: 200 }
      );
    }

    console.log("✅ [PATCH] User is a PARTICIPANT (not host), proceeding...");

    // ✅ Find DB user via Clerk ID
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

    // ✅ Find participant
    console.log("🔍 [PATCH] Finding participant record...");
    const participant = await prisma.meetingParticipant.findUnique({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId: dbUser.id,
        },
      },
    });

    if (!participant) {
      console.log("❌ [PATCH] Participant not found");
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    console.log("✅ [PATCH] Participant found:", participant.id);
    console.log("   - Joined at:", participant.joinedAt);

    // ⏱️ Calculate leave time & duration
    const leftAt = new Date();
    const duration = Math.floor(
      (leftAt.getTime() - participant.joinedAt.getTime()) / 1000
    );

    console.log("⏱️  [PATCH] Calculating duration:");
    console.log("   - Left at:", leftAt.toISOString());
    console.log("   - Duration:", duration, "seconds (", Math.floor(duration / 60), "minutes)");

    const body = await req.json();
    const { isMicMuted, isCameraOff } = body;

    console.log("📊 [PATCH] Media state:");
    console.log("   - Mic muted:", isMicMuted);
    console.log("   - Camera off:", isCameraOff);

    // ✅ Build update object safely
    const data = {
      leftAt,
      duration,
      ...(isMicMuted !== undefined ? { isMicMuted } : {}),
      ...(isCameraOff !== undefined ? { isCameraOff } : {}),
    };

    console.log("💾 [PATCH] Updating participant...");
    const updatedParticipant = await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data,
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    console.log("✅ [PATCH] Participant updated successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      participant: updatedParticipant,
      message: "Participant updated successfully",
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [PATCH] Error updating participant");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                    GET: SYNC ALL PARTICIPANTS FROM STREAM                   */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("\n\n🚀 ================================================");
  console.log("🚀 [GET] Syncing all participants from Stream");
  console.log("🚀 ================================================\n");

  try {
    const { id: streamCallId } = await params;
    console.log("📋 [GET] Stream Call ID:", streamCallId);

    // Find meeting with host info
    const meeting = await prisma.meeting.findUnique({
      where: { streamCallId },
      include: {
        host: {
          select: {
            clerkId: true,
          },
        },
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!meeting) {
      console.log("❌ [GET] Meeting not found");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("✅ [GET] Meeting found:", meeting.id);
    console.log("👑 [GET] Host Clerk ID:", meeting.host.clerkId);
    console.log("📊 [GET] Current participants in DB:", meeting.participants.length);

    // Sync all participants from Stream (excluding host)
    await syncAllParticipantsFromStream(
      streamCallId, 
      meeting.id,
      meeting.host.clerkId // Pass host ID to filter
    );

    // Fetch updated participant list
    const updatedMeeting = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    console.log("📊 [GET] Updated participants in DB:", updatedMeeting?.participants.length || 0);
    console.log("✅ [GET] Sync completed successfully");
    console.log("🚀 ================================================\n\n");

    return NextResponse.json({
      success: true,
      meeting: updatedMeeting,
      participants: updatedMeeting?.participants || [],
    });
  } catch (error) {
    console.error("\n❌ ================================================");
    console.error("❌ [GET] Error syncing participants");
    console.error("❌ ================================================");
    console.error(error);
    console.error("❌ ================================================\n\n");
    
    return NextResponse.json(
      { error: "Failed to sync participants" },
      { status: 500 }
    );
  }
}