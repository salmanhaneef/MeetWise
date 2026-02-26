import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json({ error: 'not authed' }, { status: 401 })
        }

        let user = await prisma.user.findUnique({
            where: {
                clerkId: userId
            },
            select: {
                currentPlan: true,
                subscriptionStatus: true,
                meetingsThisMonth: true,
                chatMessagesToday: true,
                billingPeriodStart: true,
            }
        })

        // ✅ Fixed: auto-create user with free plan instead of returning 404
        // This prevents usage from staying null forever on first login
        if (!user) {
            user = await prisma.user.create({
                data: {
                    clerkId: userId,
                    currentPlan: 'free',
                    subscriptionStatus: 'inactive',
                    meetingsThisMonth: 0,
                    chatMessagesToday: 0,
                    billingPeriodStart: null,
                },
                select: {
                    currentPlan: true,
                    subscriptionStatus: true,
                    meetingsThisMonth: true,
                    chatMessagesToday: true,
                    billingPeriodStart: true,
                }
            })
        }

        return NextResponse.json(user)

    } catch (error) {
        console.error('Failed to fetch/create user usage:', error)
        return NextResponse.json({ error: 'failed to fetch usage' }, { status: 500 })
    }
}