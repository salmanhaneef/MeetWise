// app/api/meetings/upcoming/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser, User } from '@clerk/nextjs/server';
import { StreamClient } from '@stream-io/node-sdk';
// import prisma, { MeetingStatus } from '@/lib/prisma';
import prisma from '@/lib/prisma';
import { Prisma } from '@/app/generated/prisma';


/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_SECRET_KEY;

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type MeetingWithRelations = Prisma.MeetingGetPayload<{
  include: {
    host: true;
    participants: { include: { user: true } };
  };
}>;


// CANCELLED is intentionally excluded for sync logic
type MeetingStatusType = MeetingWithRelations['status'];
type ActiveMeetingStatus = Exclude<MeetingStatusType, 'CANCELLED'>;


/* ------------------------------------------------------------------ */
/* Test / Auth Helper                                                  */
/* ------------------------------------------------------------------ */

async function getUserFromRequest(
  req: NextRequest
): Promise<User | null> {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_TEST_AUTH === 'true'
  ) {
    const testUserId = req.nextUrl.searchParams.get('testUserId');

    if (testUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: testUserId },
      });

      if (user) {
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
      }
    }
  }

  return currentUser();
}

/* ------------------------------------------------------------------ */
/* Stream Sync Logic (Fully Type-Safe)                                 */
/* ------------------------------------------------------------------ */

async function syncMeetingWithStream(
  meeting: MeetingWithRelations
): Promise<MeetingWithRelations> {
  // Do not sync cancelled meetings
  if (meeting.status === 'CANCELLED') {
    return meeting;
  }

  if (!apiKey || !apiSecret || !meeting.streamCallId) {
    return meeting;
  }

  try {
    const client = new StreamClient(apiKey, apiSecret);
    const call = client.video.call('default', meeting.streamCallId);
    const callData = await call.get();

    const now = new Date();
    const scheduledFor = new Date(meeting.scheduledFor);
    const endTime = new Date(
      scheduledFor.getTime() + meeting.duration * 60 * 1000
    );

    let actualStatus: ActiveMeetingStatus;

    if (callData.call?.ended_at) {
      actualStatus = 'COMPLETED';
    } else if (callData.call?.session) {
      actualStatus = 'ONGOING';
    } else if (now >= scheduledFor && now < endTime) {
      actualStatus = 'ONGOING';
    } else if (now >= endTime) {
      actualStatus = 'COMPLETED';
    } else {
      actualStatus = 'SCHEDULED';
    }

    if (actualStatus !== meeting.status) {
      return await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: actualStatus,
          ...(actualStatus === 'COMPLETED' && !meeting.endedAt
            ? { endedAt: callData.call?.ended_at ?? new Date() }
            : {}),
        },
        include: {
          host: true,
          participants: { include: { user: true } },
        },
      });
    }

    return meeting;
  } catch (error) {
    console.error(
      `Stream sync failed for meeting ${meeting.id}`,
      error
    );
    return meeting;
  }
}

/* ------------------------------------------------------------------ */
/* GET: Upcoming Meetings                                             */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Math.min(
      Number(url.searchParams.get('limit') || 20),
      100
    );
    const skip = (page - 1) * limit;
    const now = new Date();

    const dbMeetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: dbUser.id },
          {
            participants: {
              some: { userId: dbUser.id },
            },
          },
        ],
        scheduledFor: { gte: now },
        status: { in: ['SCHEDULED', 'ONGOING'] },
      },
      include: {
        host: true,
        participants: { include: { user: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      skip,
      take: limit,
    });

    const totalCount = await prisma.meeting.count({
      where: {
        OR: [
          { hostId: dbUser.id },
          {
            participants: {
              some: { userId: dbUser.id },
            },
          },
        ],
        scheduledFor: { gte: now },
        status: { in: ['SCHEDULED', 'ONGOING'] },
      },
    });

    const syncedMeetings = await Promise.all(
      dbMeetings.map((meeting) =>
        syncMeetingWithStream(meeting)
      )
    );

    const upcomingMeetings = syncedMeetings.filter(
      (m: MeetingWithRelations) => m.status === 'SCHEDULED' || m.status === 'ONGOING'
    );

    return NextResponse.json({
      success: true,
      meetings: upcomingMeetings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
      meta: {
        synced: true,
        count: upcomingMeetings.length,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Upcoming meetings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}
