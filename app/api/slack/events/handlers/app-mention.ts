import prisma from "@/lib/prisma"
import { isDuplicateEvent } from "../utils/deduplicate"
import { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt"

type AppMentionMiddleware = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs

export const handleAppMention = async ({ event, say, client }: AppMentionMiddleware) => {
    try {
        console.log('[app_mention] Triggered! user:', event.user, 'text:', event.text)

        const eventId = `app_mention-${event.channel}-${event.user}`
        const eventTs = event.event_ts || event.ts
        if (isDuplicateEvent(eventId, eventTs)) {
            console.log('[app_mention] Duplicate, skipping')
            return
        }

        const authTest = await client.auth.test()
        if (event.user === authTest.user_id) return

        const slackUserId = event.user
        if (!slackUserId) return

        const text = event.text || ''
        const cleanText = text.replace(/<@[^>]+>/g, '').trim()

        if (!cleanText) {
            await say("👋 Hi! Ask me anything about your meetings.")
            return
        }

        const userInfo = await client.users.info({ user: slackUserId })
        const userEmail = userInfo.user?.profile?.email
        console.log('[app_mention] User email:', userEmail)

        if (!userEmail) {
            await say("Sorry, I can't access your email. Please make sure your Slack email is visible in your profile settings.")
            return
        }

        const user = await prisma.user.findFirst({
            where: { email: userEmail }
        })
        console.log('[app_mention] DB user found:', !!user)

        if (!user) {
            await say(`👋 I can't find an account with email *${userEmail}*. Please sign up first!`)
            return
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                slackUserId,
                slackTeamId: authTest.team_id as string,
                slackConnected: true
            }
        })

        await say("🤖 Searching through your meetings...")

        console.log('[app_mention] Calling RAG API for userId:', user.id)
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rag/chat-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: cleanText, userId: user.id })
        })

        console.log('[app_mention] RAG response status:', response.status)

        if (!response.ok) throw new Error(`RAG API failed: ${response.status}`)

        const data = await response.json()

        if (data.answer) {
            await say({
                text: "Meeting Assistant",
                blocks: [
                    {
                        type: "section",
                        text: { type: "mrkdwn", text: `🤖 *Meeting Assistant*\n\n${data.answer}` }
                    },
                    { type: "divider" },
                    {
                        type: "context",
                        elements: [{ type: "mrkdwn", text: "💡 Ask me about meetings, decisions, action items or participants" }]
                    }
                ]
            })
        } else {
            await say("Sorry, I couldn't find anything. Try asking about a specific meeting.")
        }

    } catch (error) {
        console.error('[app_mention] Error:', error)
        await say("Sorry, something went wrong. Please try again.")
    }
}
