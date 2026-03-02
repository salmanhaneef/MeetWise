import  prisma  from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: {
                botName:     true,
                botImageUrl: true,
                currentPlan: true
            }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'user not found' }, { status: 404 })
        }

        return NextResponse.json({
            botName:     dbUser.botName     || 'Meeting Bot',
            botImageUrl: dbUser.botImageUrl || null,
            plan:        dbUser.currentPlan || 'free'
        })

    } catch (error) {
        console.error('error fetching bot settings:', error)
        return NextResponse.json({ error: 'internal server error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { botName, botImageUrl } = body

        // Validate botName length
        if (botName && typeof botName !== 'string') {
            return NextResponse.json({ error: 'invalid bot name' }, { status: 400 })
        }
        if (botName && botName.trim().length > 50) {
            return NextResponse.json({ error: 'bot name must be under 50 characters' }, { status: 400 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { id: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'user not found' }, { status: 404 })
        }

        await prisma.user.update({
            where: { clerkId: user.id },
            data: {
                botName:     botName?.trim() || 'Meeting Bot',
                // Only update botImageUrl if explicitly provided
                // (image saves itself via /api/upload/bot-avatar)
                ...(botImageUrl !== undefined && { botImageUrl })
            }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('error saving bot settings:', error)
        return NextResponse.json({ error: 'internal server error' }, { status: 500 })
    }
}