// app/api/meetings/[id]/action-items/route.ts
// ✅ FIXED: meeting.userId → hostId + host.clerkId (matches your Prisma schema)

import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text } = await request.json()

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return NextResponse.json({ error: 'Missing action item text' }, { status: 400 })
        }

        const { id: meetingId } = await params

        // ✅ FIXED: schema has hostId → host(clerkId), not userId
        const meeting = await prisma.meeting.findFirst({
            where: {
                id: meetingId,
                host: {
                    clerkId: userId
                }
            }
        })

        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
        }

        // actionItems is Json? in schema — safely cast
        const existingItems = Array.isArray(meeting.actionItems)
            ? (meeting.actionItems as { id: number; text: string }[])
            : []

        const nextId =
            existingItems.length > 0
                ? Math.max(...existingItems.map((item) => item.id ?? 0)) + 1
                : 1

        const newActionItem = { id: nextId, text: text.trim() }
        const updatedActionItems = [...existingItems, newActionItem]

        await prisma.meeting.update({
            where: { id: meetingId },
            data: { actionItems: updatedActionItems },
        })

        return NextResponse.json(newActionItem)

    } catch (error) {
        console.error('[action-items POST] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}