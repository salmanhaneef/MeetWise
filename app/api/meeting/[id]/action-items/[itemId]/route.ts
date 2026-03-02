// app/api/meeting/[id]/action-items/[itemId]/route.ts
// ✅ FIXED: Prisma JsonNull + proper typing + ESLint compliant

import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@/app/generated/prisma"

// ✅ Define proper ActionItem type (no `any`)
type ActionItem = {
  id: number
  text: string
  completed?: boolean
  assignee?: string
  [key: string]: string | number | boolean | undefined
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: meetingId, itemId } = await params
        const itemIdNumber = parseInt(itemId, 10)

        if (isNaN(itemIdNumber)) {
            return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })
        }

        const meeting = await prisma.meeting.findUnique({
            where: { id: meetingId },
            select: {
                id: true,
                hostId: true,
                actionItems: true,
            },
        })

        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
        }

        const host = await prisma.user.findUnique({
            where: { id: meeting.hostId },
            select: { clerkId: true },
        })

        if (!host || host.clerkId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const rawItems = meeting.actionItems
        const actionItems: ActionItem[] = Array.isArray(rawItems) 
            ? rawItems as ActionItem[] 
            : []

        const itemExists = actionItems.some((item) => item.id === itemIdNumber)

        if (!itemExists) {
            return NextResponse.json({ error: 'Action item not found' }, { status: 404 })
        }

        const updatedActionItems = actionItems.filter(
            (item) => item.id !== itemIdNumber
        )

        // ✅ FIX: Use Prisma.JsonNull for explicit null, or cast array safely
        const actionItemsValue: Prisma.InputJsonValue | typeof Prisma.JsonNull = 
            updatedActionItems.length > 0 
                ? updatedActionItems as Prisma.InputJsonValue 
                : Prisma.JsonNull

        await prisma.meeting.update({
            where: { id: meetingId },
            data: { 
                actionItems: actionItemsValue,
                updatedAt: new Date(),
            },
        })

        return NextResponse.json({ 
            success: true,
            message: 'Action item deleted',
            count: updatedActionItems.length 
        })

    } catch (error) {
        console.error('[action-items DELETE] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' }, 
            { status: 500 }
        )
    }
}