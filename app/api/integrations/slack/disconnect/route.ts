import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        slackConnected: false,
        slackUserId: null,
        slackTeamId: null,
        preferredChannelId: null,
        preferredChannelName: null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Slack disconnect error:", error)
    return NextResponse.json(
      { error: "Failed to disconnect Slack" },
      { status: 500 }
    )
  }
}