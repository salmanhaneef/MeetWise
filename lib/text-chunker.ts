// lib/text-chunker.ts
// ─────────────────────────────────────────────────────────────
// NO CHANGES NEEDED — pure utility, no AI dependency
// ─────────────────────────────────────────────────────────────

export function chunkTranscript(transcript: string) {
    const maxChunkSize = 500
    const chunks = []
    const speakerLines = transcript.split('\n').filter(line => line.trim())
    let currentChunk = ''
    let chunkIndex = 0

    for (const line of speakerLines) {
        if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.trim(),
                chunkIndex,
            })
            chunkIndex++
            currentChunk = line + '\n'
        } else {
            currentChunk += line + '\n'
        }
    }

    if (currentChunk.trim()) {
        chunks.push({
            content: currentChunk.trim(),
            chunkIndex,
        })
    }

    return chunks
}

export function extractSpeaker(text: string): string | null {
    const match = text.match(/^([A-Za-z\s]+):\s*/)
    return match ? match[1].trim() : null
}