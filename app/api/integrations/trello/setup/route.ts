import prisma from "@/lib/prisma";
import { TrelloAPI } from "@/lib/integrations/trello/trello";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Helper function to get database user from Clerk ID
async function getDatabaseUser(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId: clerkId }
    });
    return user;
}

export async function GET() {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Get database user
    const user = await getDatabaseUser(clerkId);
    
    if (!user) {
        return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    const integration = await prisma.userIntegration.findUnique({
        where: {
            userId_platform: {
                userId: user.id,  // ✅ Use database UUID, not clerkId
                platform: 'trello'
            }
        }
    });

    if (!integration) {
        return NextResponse.json({ error: 'not connected' }, { status: 400 });
    }

    try {
        const trello = new TrelloAPI();
        const boards = await trello.getBoards(integration.accessToken);

        return NextResponse.json({ boards });
    } catch (error) {
        console.error('error fetching trello boards:', error);
        return NextResponse.json({ error: 'failed to fetch boards' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { userId: clerkId } = await auth();
    const { boardId, boardName, createNew } = await request.json();

    if (!clerkId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Get database user
    const user = await getDatabaseUser(clerkId);
    
    if (!user) {
        return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    const integration = await prisma.userIntegration.findUnique({
        where: {
            userId_platform: {
                userId: user.id,  // ✅ Use database UUID, not clerkId
                platform: 'trello'
            }
        }
    });

    if (!integration) {
        return NextResponse.json({ error: 'not connected' }, { status: 400 });
    }

    try {
        const trello = new TrelloAPI();

        let finalBoardId = boardId;
        let finalBoardName = boardName;

        if (createNew && boardName) {
            const newBoard = await trello.createBoard(integration.accessToken, boardName);
            finalBoardId = newBoard.id;
            finalBoardName = newBoard.name;
        }

        await prisma.userIntegration.update({
            where: {
                id: integration.id
            },
            data: {
                boardId: finalBoardId,
                boardName: finalBoardName
            }
        });

        return NextResponse.json({
            success: true,
            boardId: finalBoardId,
            boardName: finalBoardName
        });
    } catch (error) {
        console.error('Error setting up trello board:', error);
        return NextResponse.json({ error: 'Failed to setup board' }, { status: 500 });
    }
}