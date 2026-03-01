import prisma from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

interface IntegrationResult {
    platform: string;
    name: string;
    logo: string;
    connected: boolean;
    boardName?: string;
    projectName?: string;
    channelName?: string;
}

export async function GET() {
    try {
        const clerkUser = await currentUser()

        if (!clerkUser) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        console.log('Clerk User ID:', clerkUser.id)
        console.log('Clerk User Email:', clerkUser.emailAddresses[0]?.emailAddress)

        // Get database user by clerkId FIRST
        const dbUser = await prisma.user.findUnique({
            where: {
                clerkId: clerkUser.id
            }
        })

        console.log('Database User:', dbUser ? {
            id: dbUser.id,
            clerkId: dbUser.clerkId,
            email: dbUser.email
        } : 'NOT FOUND')

        if (!dbUser) {
            return NextResponse.json({ error: 'user not found' }, { status: 404 })
        }

        // Now use dbUser.id (database UUID) to fetch integrations
        const integrations = await prisma.userIntegration.findMany({
            where: {
                userId: dbUser.id
            }
        })

        console.log('Found Integrations:', integrations.length)
        console.log('Integration Details:', integrations.map(i => ({
            platform: i.platform,
            userId: i.userId,
            hasToken: !!i.accessToken
        })))

        const allPlatforms = [
            { platform: 'trello', name: 'Trello', logo: '🔷', connected: false },
            { platform: 'jira', name: 'Jira', logo: '🔵', connected: false },
            { platform: 'asana', name: 'Asana', logo: '🟠', connected: false }
        ]

        const result: IntegrationResult[] = allPlatforms.map(platform => {
            const integration = integrations.find(i => i.platform === platform.platform)
            return {
                ...platform,
                connected: !!integration,
                boardName: integration?.boardName || undefined,
                projectName: integration?.projectName || undefined
            }
        })

        // Use dbUser.slackConnected (already have dbUser from above)
        if (dbUser.slackConnected) {
            result.push({
                platform: 'slack',
                name: 'Slack',
                logo: '💬',
                connected: true,
                channelName: dbUser.preferredChannelName || 'Not Set'
            })
        } else {
            result.push({
                platform: 'slack',
                name: 'Slack',
                logo: '💬',
                connected: false,
            })
        }

        console.log('Result:', result)

        return NextResponse.json(result)
    } catch (error) {
        console.error('error fetching integration status:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}