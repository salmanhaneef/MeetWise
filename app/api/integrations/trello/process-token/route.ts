import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const { userId: clerkId } = await auth();  // This is Clerk ID (starts with "user_")
    const { token } = await request.json();

    if (!clerkId || !token) {
        return NextResponse.json({ error: "missing user id or token" }, { status: 400 });
    }

    try {
        // First, find the user in your database by clerkId
        let user = await prisma.user.findUnique({
            where: { clerkId: clerkId }
        });

        // If user doesn't exist in database, create them
        if (!user) {
            // Get user details from Clerk
            const clerkUser = await currentUser();
            
            user = await prisma.user.create({
                data: {
                    clerkId: clerkId,
                    email: clerkUser?.emailAddresses[0]?.emailAddress || 'unknown@example.com',
                    name: clerkUser?.fullName || null,
                    firstName: clerkUser?.firstName || null,
                    lastName: clerkUser?.lastName || null,
                    imageUrl: clerkUser?.imageUrl || null,
                }
            });
        }

        // Now use the database user.id (UUID) for the integration
        await prisma.userIntegration.upsert({
            where: {
                userId_platform: {
                    userId: user.id,  // Use database UUID, NOT clerkId
                    platform: 'trello'
                }
            },
            update: {
                accessToken: token,
                updatedAt: new Date()
            },
            create: {
                userId: user.id,      // Use database UUID, NOT clerkId
                platform: 'trello',
                accessToken: token
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('error saving trello integration:', error);
        return NextResponse.json({ error: 'failed to save', details: (error as Error).message }, { status: 500 });
    }
}