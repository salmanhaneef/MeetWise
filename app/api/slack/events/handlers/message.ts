import prisma from "@/lib/prisma"
import { isDuplicateEvent } from "../utils/deduplicate"
import {
  SlackEventMiddlewareArgs,
  AllMiddlewareArgs
} from "@slack/bolt"

type MessageMiddleware =
  SlackEventMiddlewareArgs<"message"> &
  AllMiddlewareArgs

export const handleMessage = async ({
  event,
  say,
  client,
}: MessageMiddleware) => {
  try {
    if (
      !("user" in event) ||
      !("text" in event) ||
      event.subtype === "bot_message"
    ) {
      return
    }

    const authTest = await client.auth.test()

    if (!authTest.user_id || event.user === authTest.user_id) {
      return
    }

    const eventId = `message-${event.ts}`
    if (isDuplicateEvent(eventId, event.ts)) {
      return
    }

    await say("Message received.")
  } catch (error) {
    console.error("message error:", error)
  }
}