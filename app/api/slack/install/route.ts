import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const returnTo = searchParams.get('return')
const clientId = process.env.SLACK_CLIENT_ID
    const redirectUri = process.env.SLACK_REDIRECT_URI as string
    console.log("CLIENT:", clientId)
  console.log("REDIRECT:", redirectUri)

    const state = returnTo ? `return=${returnTo}` : ''

    const slackInstallUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=app_mentions:read,channels:read,channels:history,groups:history,groups:read,chat:write,im:history,im:read,im:write,mpim:history,mpim:read,mpim:write,users:read,users:read.email&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

    return NextResponse.redirect(slackInstallUrl)
}