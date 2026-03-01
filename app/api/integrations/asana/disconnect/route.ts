import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    try {
        // Get database user by clerkId
        const user = await prisma.user.findUnique({
            where: { clerkId: clerkId }
        });

        if (!user) {
            return NextResponse.json({ error: 'user not found' }, { status: 404 })
        }

        await prisma.userIntegration.delete({
            where: {
                userId_platform: {
                    userId: user.id,  // ✅ Use database UUID, not clerkId
                    platform: 'asana'
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error disconnecting asana:', error)
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }
}