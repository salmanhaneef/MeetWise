import prisma from "./prisma"

interface PlanLimits {
    meetings: number
    chatMessages: number
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
    free: { meetings: 0, chatMessages: 0 },
    starter: { meetings: 10, chatMessages: 30 },
    pro: { meetings: 30, chatMessages: 100 },
    premium: { meetings: -1, chatMessages: -1 }
}

export async function canUserSendBot(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user) {
        return { allowed: false, reason: 'User not found' }
    }

    if (user.currentPlan === 'free' || user.subscriptionStatus !== 'active') {
        return { allowed: false, reason: 'Upgrade your plan to send bots to meetings' }
    }

    const limits = PLAN_LIMITS[user.currentPlan]

    if (!limits) {
        console.error(`❌ Unknown plan: ${user.currentPlan}`)
        return { allowed: false, reason: 'Invalid subscription plan' }
    }

    if (limits.meetings !== -1 && user.meetingsThisMonth >= limits.meetings) {
        return { allowed: false, reason: `You've reached your monthly limit of ${limits.meetings} meetings` }
    }

    return { allowed: true }
}

// ✅ NEW: Check if user can schedule meeting
export async function canScheduleMeeting(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user) {
        return { allowed: false, reason: 'User not found' }
    }

    if (user.currentPlan === 'free' || user.subscriptionStatus !== 'active') {
        return { allowed: false, reason: 'Upgrade your plan to schedule meetings' }
    }

    const limits = PLAN_LIMITS[user.currentPlan]

    if (!limits) {
        return { allowed: false, reason: 'Invalid subscription plan' }
    }

    if (limits.meetings !== -1 && user.meetingsThisMonth >= limits.meetings) {
        return { allowed: false, reason: `You've reached your monthly limit of ${limits.meetings} meetings` }
    }

    return { allowed: true }
}

export async function canUserChat(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user) {
        return { allowed: false, reason: 'User not found' }
    }

    if (user.currentPlan === 'free' || user.subscriptionStatus !== 'active') {
        return { allowed: false, reason: 'Upgrade your plan to chat with our AI bot' }
    }

    const limits = PLAN_LIMITS[user.currentPlan]

    if (!limits) {
        return { allowed: false, reason: 'Invalid subscription plan' }
    }

    if (limits.chatMessages !== -1 && user.chatMessagesToday >= limits.chatMessages) {
        return { allowed: false, reason: `You've reached your daily limit of ${limits.chatMessages} messages` }
    }

    return { allowed: true }
}

// ✅ FIXED: Check limits before incrementing
export async function incrementMeetingUsage(userId: string) {
    const check = await canScheduleMeeting(userId)
    if (!check.allowed) {
        throw new Error(check.reason)
    }

    await prisma.user.update({
        where: { id: userId },
        data: { meetingsThisMonth: { increment: 1 } }
    })
}

// ✅ FIXED: Check limits before incrementing
export async function incrementChatUsage(userId: string) {
    const check = await canUserChat(userId)
    if (!check.allowed) {
        throw new Error(check.reason)
    }

    await prisma.user.update({
        where: { id: userId },
        data: { chatMessagesToday: { increment: 1 } }
    })
}

export function getPlanLimits(plan: string): PlanLimits {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}