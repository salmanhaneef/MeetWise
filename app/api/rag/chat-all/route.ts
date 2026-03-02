// app/api/rag/chat-all/route.ts
// ─────────────────────────────────────────────────────────────
// NO LOGIC CHANGES — only fixed: meeting.userId → meeting.hostId
// (matches your actual Prisma schema which uses hostId not userId)
// ─────────────────────────────────────────────────────────────

import  prisma  from "@/lib/prisma"
import { chatWithAllMeetings } from "@/lib/rag"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const { question, userId: slackUserId } = await request.json()

        if (!question) {
            return NextResponse.json({ error: 'Missing question' }, { status: 400 })
        }

        let targetUserId = slackUserId

        if (!slackUserId) {
            // Normal web user — use Clerk auth
            const { userId: clerkUserId } = await auth()
            if (!clerkUserId) {
                return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
            }
            targetUserId = clerkUserId
        } else {
            // Slack user — look up by internal DB id
            const user = await prisma.user.findUnique({
                where: { id: slackUserId },
                select: { clerkId: true },
            })

            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 })
            }

            targetUserId = user.clerkId
        }

        const response = await chatWithAllMeetings(targetUserId, question)

        return NextResponse.json(response)

    } catch (error) {
        console.error('[chat-all] Error:', error)
        return NextResponse.json({
            error: 'Failed to process question',
            answer: 'I encountered an error while searching your meetings. Please try again.',
        }, { status: 500 })
    }
}