import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma"; // Import Prisma namespace
import { transcribeWithDiarization } from "@/lib/assemblyai";
import { processMeetingTranscript } from "@/lib/ai-processor";
import { processTranscript } from "@/lib/rag";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { meetingId, recordingUrl } = await request.json();

  if (!meetingId || !recordingUrl) {
    return NextResponse.json(
      { error: "Missing meetingId or recordingUrl" },
      { status: 400 },
    );
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        title: true,
        processed: true,
        host: { select: { clerkId: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.host.clerkId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (meeting.processed) {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    console.log(`[Step 1/3] Transcribing: ${recordingUrl}`);
    const transcriptionResult = await transcribeWithDiarization(recordingUrl);

    console.log("[Step 2/3] Generating summary and action items...");
    const aiResult = await processMeetingTranscript(
      transcriptionResult.formattedTranscript,
    );

    console.log("[Step 3/3] Saving to database and Pinecone...");

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcript: transcriptionResult.formattedTranscript,
        speakers:
          transcriptionResult.utterances as unknown as Prisma.InputJsonValue,
        summary: aiResult.summary,
        actionItems: aiResult.actionItems as unknown as Prisma.InputJsonValue,
        processed: true,
        processedAt: new Date(),
      },
    });

    await processTranscript(
      meetingId,
      
      transcriptionResult.formattedTranscript,
      meeting.title,
    );

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ragProcessed: true,
        ragProcessedAt: new Date(),
      },
    });

    console.log(`✅ Meeting ${meetingId} fully processed`);

    return NextResponse.json({
      success: true,
      summary: aiResult.summary,
      actionItems: aiResult.actionItems,
      transcript: transcriptionResult.formattedTranscript,
      speakerCount:
        transcriptionResult.segments?.length ??
        transcriptionResult.utterances?.length,
    });
  } catch (error) {
    console.error("[process-recording] Error:", error);
    return NextResponse.json(
      { error: "Failed to process recording" },
      { status: 500 },
    );
  }
}
