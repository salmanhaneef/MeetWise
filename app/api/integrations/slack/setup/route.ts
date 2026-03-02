import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { WebClient } from "@slack/web-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: {
                slackTeamId: true,
                preferredChannelId: true,
                preferredChannelName: true,
            }
        })
        console.log('[Slack Setup GET] User state:', JSON.stringify(user, null, 2))

        if (!user?.slackTeamId) {
            return NextResponse.json({ 
                channels: [], 
                connected: false, 
                needsSetup: true 
            })
        }

        const installation = await prisma.slackInstallation.findUnique({
            where: { teamId: user.slackTeamId }
        })

        if (!installation?.botToken) {
            return NextResponse.json({ 
                channels: [], 
                connected: false,
                error: 'installation not found' 
            }, { status: 400 })
        }

        const slack = new WebClient(installation.botToken)
        const result = await slack.conversations.list({
            types: 'public_channel,private_channel',
            limit: 100
        })

        const channels = result.channels
            ?.filter(ch => !ch.is_archived)
            ?.map(ch => ({
                id: ch.id,
                name: ch.name,
                isPrivate: ch.is_private
            })) ?? []

        return NextResponse.json({
            channels,
            connected: true,
            teamName: installation.teamName,
            preferredChannelId: user.preferredChannelId,
            preferredChannelName: user.preferredChannelName,
        })

    } catch (error) {
        console.error('slack setup GET error:', error)
        return NextResponse.json({ error: 'failed to fetch channels' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const { channelId, channelName } = await request.json()

        if (!channelId) {
            return NextResponse.json({ error: 'channelId required' }, { status: 400 })
        }

        await prisma.user.update({
            where: { clerkId: userId },
            data: {
                preferredChannelId: channelId,
                preferredChannelName: channelName ?? null
            }
        })

        return NextResponse.json({ success: true, channelId, channelName })

    } catch (error) {
        console.error('slack setup POST error:', error)
        return NextResponse.json({ error: 'failed to save channel' }, { status: 500 })
    }
}