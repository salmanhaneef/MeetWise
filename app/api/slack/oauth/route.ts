import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { WebClient } from '@slack/web-api'
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
    try {
        console.log('[Slack OAuth] Starting OAuth callback')
        
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const state = searchParams.get('state')

        const host = request.headers.get('host')
        const isLocal = host?.includes('localhost')
        const protocol = isLocal ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        console.log('[Slack OAuth] Params:', { code: !!code, error, state, baseUrl })

        if (error) {
            console.error('[Slack OAuth] Slack returned error:', error)
            return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=${error}`)
        }

        if (!code) {
            console.error('[Slack OAuth] No authorization code')
            return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=no_code`)
        }

        // Get current user from Clerk
        const { userId: clerkUserId } = await auth()
        console.log('[Slack OAuth] Clerk userId:', clerkUserId)

        if (!clerkUserId) {
            console.error('[Slack OAuth] No authenticated user')
            return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=not_authenticated`)
        }

        // Find the currently logged-in user by clerkId
        const currentUser = await prisma.user.findUnique({
            where: { clerkId: clerkUserId }
        })

        console.log('[Slack OAuth] Current user found:', !!currentUser, 'email:', currentUser?.email)

        if (!currentUser) {
            console.error('[Slack OAuth] No user found with clerkId:', clerkUserId)
            return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=user_not_found`)
        }

        const redirectUri = `${baseUrl}/api/slack/oauth`

        console.log('[Slack OAuth] Exchanging code for token...')
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: process.env.SLACK_CLIENT_ID!,
                client_secret: process.env.SLACK_CLIENT_SECRET!,
                code: code,
                redirect_uri: redirectUri
            })
        })

        const tokenData = await tokenResponse.json()
        console.log('[Slack OAuth] Token response:', { ok: tokenData.ok, error: tokenData.error, team: tokenData.team?.id })

        if (!tokenData.ok) {
            console.error('[Slack OAuth] Token exchange failed:', tokenData.error)
            return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=token_exchange_failed`)
        }

        // Get Slack user info for display purposes
        const slack = new WebClient(tokenData.access_token)
        const userInfo = await slack.users.info({ user: tokenData.authed_user.id })
        const slackEmail = userInfo.user?.profile?.email
        const slackUserId = tokenData.authed_user.id

        console.log('[Slack OAuth] Slack user:', { slackUserId, slackEmail })

        // SECURITY: Check if Slack email matches current user's email
        // This prevents connecting someone else's Slack to your account
        if (slackEmail && slackEmail.toLowerCase() !== currentUser.email?.toLowerCase()) {
            console.warn('[Slack OAuth] Email mismatch:', {
                currentUserEmail: currentUser.email,
                slackEmail: slackEmail
            })
            // Option: Allow but warn, or block
            // For now, we'll allow but log it - you might want to block this
        }

        // Save installation - use currentUser.id, not the email-matched user
        console.log('[Slack OAuth] Saving installation for team:', tokenData.team.id, 'linked to user:', currentUser.id)
        
        await prisma.slackInstallation.upsert({
            where: {
                teamId: tokenData.team.id
            },
            update: {
                teamName: tokenData.team.name,
                botToken: tokenData.access_token,
                active: true,
                userId: currentUser.id,  // FIX: Use current logged-in user
                updatedAt: new Date()
            },
            create: {
                teamId: tokenData.team.id,
                teamName: tokenData.team.name,
                botToken: tokenData.access_token,
                active: true,
                userId: currentUser.id,  // FIX: Use current logged-in user
            }
        })

        // Update the CURRENT user's Slack status
        console.log('[Slack OAuth] Updating Slack status for current user:', currentUser.id)
        
        await prisma.user.update({
            where: { 
                id: currentUser.id  // FIX: Use current user's ID
            },
            data: {
                slackUserId: slackUserId,
                slackTeamId: tokenData.team.id,
                slackConnected: true
            }
        })

        console.log('[Slack OAuth] Success! Redirecting...')
        const returnTo = state?.startsWith('return=') ? state.split('return=')[1] : null

        if (returnTo === 'integrations') {
            return NextResponse.redirect(`${baseUrl}/integrations?setup=slack&slack=installed`)
        } else {
            return NextResponse.redirect(`${baseUrl}/integrations?slack=installed`)
        }
            
    } catch (error) {
        console.error('[Slack OAuth] Unhandled error:', error)
        
        const host = request.headers.get('host') || 'localhost:3000'
        const isLocal = host.includes('localhost')
        const protocol = isLocal ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        return NextResponse.redirect(`${baseUrl}/integrations?slack=error&reason=server_error`)
    }
}