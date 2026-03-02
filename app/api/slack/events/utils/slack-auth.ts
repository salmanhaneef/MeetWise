import { Authorize, AuthorizeResult } from '@slack/bolt'
import prisma from "@/lib/prisma"

export const authorizeSlack: Authorize<boolean> = async (source): Promise<AuthorizeResult> => {
    const { teamId, enterpriseId, userId } = source

    if (!teamId) {
        throw new Error('No team ID provided')
    }

    const installation = await prisma.slackInstallation.findUnique({
        where: { teamId }
    })

    if (!installation) {
        throw new Error(`No installation found for team: ${teamId}`)
    }

    if (!installation.active) {
        throw new Error(`Installation inactive for team: ${teamId}`)
    }

    if (!installation.botToken) {
        throw new Error(`No bot token for team: ${teamId}`)
    }

    return {
        botToken: installation.botToken,
        teamId: installation.teamId,
        botId: undefined,
        botUserId: undefined,
        enterpriseId: enterpriseId || undefined,
        userToken: undefined,
        userId: userId
    }
}