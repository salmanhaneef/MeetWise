import { App, SlackEventMiddlewareArgs, AllMiddlewareArgs, Middleware } from '@slack/bolt'
import { authorizeSlack } from './utils/slack-auth'
import { handleAppMention } from './handlers/app-mention'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature } from './utils/verifySlackSignature'

// Define a generic handler type that works for both message and app_mention
type AppMentionHandler = Middleware<SlackEventMiddlewareArgs<'app_mention'> & AllMiddlewareArgs>

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    authorize: authorizeSlack
})

// Handle message events that contain bot mentions (e.g. in DMs or when app_mention doesn't fire)
app.event('message', async (args) => {
    const { event, say, client } = args
    const msgEvent = event as { 
        text?: string; 
        bot_id?: string; 
        subtype?: string;
        user?: string;
        ts: string;
        event_ts?: string;
        channel?: string;
    }

    // Ignore bot messages and subtypes (edits, deletes etc)
    if (msgEvent.bot_id || msgEvent.subtype) return

    const text = msgEvent.text || ''
    const botMentionPattern = /<@[A-Z0-9]+>/

    if (botMentionPattern.test(text)) {
        console.log('[Slack Events] Message contains mention, routing to handleAppMention')
        
        // Create compatible event object without type casting
        const mentionEvent = {
            user: msgEvent.user,
            text: msgEvent.text,
            ts: msgEvent.ts,
            event_ts: msgEvent.event_ts,
            channel: msgEvent.channel,
            bot_id: msgEvent.bot_id
        }
        
        // Call handleAppMention with individual args, not cast
        await handleAppMention({ 
            event: mentionEvent, 
            say, 
            client 
        } as unknown as Parameters<typeof handleAppMention>[0])
    }
})

app.event('app_mention', handleAppMention as AppMentionHandler)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            return NextResponse.json({ error: 'invalid content type' }, { status: 400 })
        }

        const body = await req.text()
        if (!body || body.trim() === '') {
            return NextResponse.json({ error: 'empty body' }, { status: 400 })
        }

        let bodyJson
        try {
            bodyJson = JSON.parse(body)
        } catch {
            return NextResponse.json({ error: 'invalid json' }, { status: 400 })
        }

        console.log('[Slack Events] type:', bodyJson.type, '| event:', bodyJson.event?.type)

        if (bodyJson.type === 'url_verification') {
            return NextResponse.json({ challenge: bodyJson.challenge })
        }

        const signature = req.headers.get('x-slack-signature')
        const timestamp = req.headers.get('x-slack-request-timestamp')

        if (!signature || !timestamp) {
            return NextResponse.json({ error: 'missing signature headers' }, { status: 401 })
        }

        if (!verifySlackSignature(body, signature, timestamp)) {
            return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
        }

        try {
            await app.processEvent({ body: bodyJson, ack: async () => {} })
        } catch (processError: unknown) {
            const error = processError as { code?: string; message?: string }
            if (error.code === 'slack_bolt_authorization_error') {
                console.error('[Slack Events] Auth error:', error.message)
                return NextResponse.json({ ok: false, error: 'installation_required' }, { status: 200 })
            }
            throw processError
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[Slack Events] POST error:', error)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}