import prisma from "./prisma";
import { chatWithAI, createEmbedding, createManyEmbeddings } from "./gemini";
import { saveManyVectors, searchVectors } from "./pinecone";
import { chunkTranscript, extractSpeaker } from "./text-chunker";

export async function processTranscript(
  meetingId: string,
//   userId: string,
  transcript: string,
  meetingTitle?: string,
) {
    const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
            host: {
                select: { clerkId: true }
            }
        }
    })
    if (!meeting) {
        throw new Error("Meeting not found")
    }

    const clerkId = meeting.host.clerkId
  const chunks = chunkTranscript(transcript);
  const texts = chunks.map((chunk) => chunk.content);

  console.log(
    `[RAG] Processing ${chunks.length} chunks for meeting: ${meetingTitle || meetingId}`,
  );

  const embeddings = await createManyEmbeddings(texts);

  const dbChunks = chunks.map((chunk) => ({
    meetingId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    speakerName: extractSpeaker(chunk.content),
    vectorId: `${meetingId}_chunk_${chunk.chunkIndex}`,
  }));

  await prisma.transcriptChunk.createMany({
    data: dbChunks,
    skipDuplicates: true,
  });

  // ✅ FIXED: speakerName never null, always string
  const vectors = chunks.map((chunk, index) => ({
    id: `${meetingId}_chunk_${chunk.chunkIndex}`,
    embedding: embeddings[index],
    metadata: {
      meetingId,
      userId: clerkId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      speakerName: extractSpeaker(chunk.content) || "Unknown", // ✅ Fixed: no null
      meetingTitle: meetingTitle || "Untitled Meeting",
    },
  }));console.log("🔥 Saving vector metadata:", {
  meetingId,
  userId: clerkId
})
  

  await saveManyVectors(vectors);
  console.log(`[RAG] Saved ${vectors.length} vectors to Pinecone`);
}

export async function chatWithMeeting(
  userId: string,
  meetingId: string,
  question: string,
) {
  console.log(
    `[RAG] Chat request for meeting: ${meetingId}, question: ${question}`,
  );

  const questionEmbedding = await createEmbedding(question);

  const results = await searchVectors(
    questionEmbedding,
    { userId, meetingId },
    5,
  );

  console.log(`[RAG] Found ${results.length} relevant chunks`);

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      summary: true,
      scheduledFor: true,
      createdAt: true,
      host: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  // ✅ FIXED: Use const instead of let
  const contextParts: string[] = [];

  if (meeting.summary) {
    contextParts.push(`MEETING SUMMARY:\n${meeting.summary}`);
  }

  if (results.length > 0) {
    const chunkContext = results
      .map((result) => {
        const speaker = result.metadata?.speakerName || "Unknown";
        const content = result.metadata?.content || "";
        return `${speaker}: ${content}`;
      })
      .join("\n\n");

    contextParts.push(`RELEVANT TRANSCRIPT SECTIONS:\n${chunkContext}`);
  }

  if (contextParts.length === 0) {
    contextParts.push("No meeting content available.");
  }

  const fullContext = contextParts.join("\n\n---\n\n");

  const systemPrompt = `You are a helpful assistant answering questions about a specific meeting.

MEETING INFORMATION:
Title: ${meeting.title || "Untitled Meeting"}
Date: ${
    meeting.scheduledFor
      ? new Date(meeting.scheduledFor).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown date"
  }

${fullContext}

INSTRUCTIONS:
- Answer based ONLY on the meeting content provided above
- The SUMMARY section contains key facts: participants, product names, decisions, action items
- The TRANSCRIPT SECTIONS contain specific quotes and detailed discussions
- If asked about participants, check the SUMMARY first
- If asked about product names, check the SUMMARY first
- If the answer is not in the content, say "I don't have that information in the meeting transcript"`;

  console.log(
    `[RAG] Sending to Gemini with context length: ${systemPrompt.length}`,
  );

  const answer = await chatWithAI(systemPrompt, question);

  return {
    answer,
    sources: results.map((result) => ({
      meetingId: result.metadata?.meetingId,
      content: result.metadata?.content,
      speakerName: result.metadata?.speakerName,
      confidence: result.score,
    })),
  };
}

export async function chatWithAllMeetings(
    userId: string,
    question: string
) {
    const questionEmbedding = await createEmbedding(question)

    const results = await searchVectors(
        questionEmbedding,
        { userId },
        8
    )

    const context = results
        .map(result => {
            const meetingTitle = result.metadata?.meetingTitle || 'Untitled Meeting'
            const speaker = result.metadata?.speakerName || 'Unknown'
            const content = result.metadata?.content || ''
            return `Meeting: ${meetingTitle}\n${speaker}: ${content}`
        })
        .join('\n\n---\n\n')

    const systemPrompt = `You are helping someone understand their meeting history.

Here's what was discussed across their meetings:
${context}

Answer the user's question based only on the meeting content above. When you reference something, mention which meeting it's from.`

    const answer = await chatWithAI(systemPrompt, question)

    return {
        answer,
        sources: results.map(result => ({
            meetingId: result.metadata?.meetingId,
            meetingTitle: result.metadata?.meetingTitle,
            content: result.metadata?.content,
            speakerName: result.metadata?.speakerName,
            confidence: result.score,
        })),
    }
}
























