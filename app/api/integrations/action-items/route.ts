// app/api/integrations/action-items/route.ts
// ✅ FIXED: userId in findUnique where clause
//    Your schema UserIntegration uses userId (internal DB id), not Clerk id
//    So we must first look up the DB user by clerkId, then use dbUser.id
// ✅ REMOVED: unused 'channel' import from diagnostics_channel
// ✅ FIXED: Slack uses boardId for channel — added note explaining this

import prisma from "@/lib/prisma"
import { AsanaAPI } from "@/lib/integrations/asana/asana"
import { JiraAPI } from "@/lib/integrations/jira/jira"
import { refreshTokenIfNeeded } from "@/lib/integrations/refreshTokenIfNeeded"
import { TrelloAPI } from "@/lib/integrations/trello/trello"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { platform, actionItem, meetingId } = await request.json()

    if (!platform || !actionItem) {
        return NextResponse.json({ error: 'Missing platform or actionItem' }, { status: 400 })
    }

    // ✅ FIXED: UserIntegration.userId is the internal DB user id (not Clerk id)
    // Schema: UserIntegration @@unique([userId, platform])
    // Must resolve Clerk id → internal DB user id first
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
    })

    if (!dbUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let integration = await prisma.userIntegration.findUnique({
        where: {
            userId_platform: {
                userId: dbUser.id,   // ✅ internal DB id, not Clerk id
                platform
            }
        }
    })

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 400 })
    }

    // Refresh OAuth token for Jira and Asana if expired
    if (platform === 'jira' || platform === 'asana') {
        try {
            integration = await refreshTokenIfNeeded(integration)
        } catch (error) {
            console.error(`Token refresh failed for ${platform}:`, error)
            return NextResponse.json(
                { error: `Please reconnect your ${platform} integration` },
                { status: 401 }
            )
        }
    }

    try {
        /* ------------------------------------------------------------------ */
        /*                            TRELLO                                   */
        /* ------------------------------------------------------------------ */
        if (platform === 'trello') {
            if (!integration.boardId) {
                return NextResponse.json({ error: 'Trello board not configured' }, { status: 400 })
            }

            const trello = new TrelloAPI()
            const lists = await trello.getBoardLists(integration.accessToken, integration.boardId)

            interface TrelloList {
                id: string
                name: string
            }

            const todoList =
                lists.find((list: TrelloList) =>
                    list.name.toLowerCase().includes('to do') ||
                    list.name.toLowerCase().includes('todo')
                ) || lists[0]

            if (!todoList) {
                return NextResponse.json({ error: 'No suitable list found in board' }, { status: 400 })
            }

            await trello.createCard(integration.accessToken, todoList.id, {
                title: actionItem,
                description: `Action item from meeting ${meetingId || 'Unknown'}`
            })
        }

        /* ------------------------------------------------------------------ */
        /*                             JIRA                                    */
        /* ------------------------------------------------------------------ */
        else if (platform === 'jira') {
            // ✅ Schema has both projectId and workspaceId on UserIntegration
            if (!integration.projectId || !integration.workspaceId) {
                return NextResponse.json({ error: 'Jira project not configured' }, { status: 400 })
            }

            const jira = new JiraAPI()

            await jira.createIssue(
                integration.accessToken,
                integration.workspaceId,
                integration.projectId,
                {
                    title: actionItem || 'Untitled action item',
                    description: `Action item from meeting ${meetingId || 'Unknown'}`
                }
            )
        }

        /* ------------------------------------------------------------------ */
        /*                            ASANA                                    */
        /* ------------------------------------------------------------------ */
        else if (platform === 'asana') {
            // ✅ Schema has projectId on UserIntegration
            if (!integration.projectId) {
                return NextResponse.json({ error: 'Asana project not configured' }, { status: 400 })
            }

            const asana = new AsanaAPI()

            await asana.createTask(integration.accessToken, integration.projectId, {
                title: actionItem,
                description: `Action item from meeting ${meetingId || 'Unknown'}`
            })
        }

        /* ------------------------------------------------------------------ */
        /*                            SLACK                                    */
        /* ------------------------------------------------------------------ */
        else if (platform === 'slack') {
            // ✅ Schema has preferredChannelId on User — but UserIntegration
            //    uses boardId to store the channel id for Slack.
            //    This matches your original code — keeping boardId for channel.
            if (!integration.boardId) {
                return NextResponse.json({ error: 'Slack channel not configured' }, { status: 400 })
            }

            const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${integration.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channel: integration.boardId,
                    text: `📋 *Action Item from Meeting ${meetingId || 'Unknown'}*\n${actionItem}`
                })
            })

            const slackResult = await slackResponse.json()
            if (!slackResponse.ok || !slackResult.ok) {
                throw new Error(`Slack API error: ${slackResult.error}`)
            }
        }

        /* ------------------------------------------------------------------ */
        /*                        UNKNOWN PLATFORM                             */
        /* ------------------------------------------------------------------ */
        else {
            return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error(`[integrations] Error creating action item in ${platform}:`, error)
        return NextResponse.json(
            { error: `Failed to create action item in ${platform}` },
            { status: 500 }
        )
    }
}