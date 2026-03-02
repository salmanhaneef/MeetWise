// lib/assemblyai.ts
// ─────────────────────────────────────────────────────────────
// FREE transcription + speaker diarization
// Uses: AssemblyAI REST API (no SDK needed — pure fetch)
//
// Setup:
//   1. No npm install needed — uses native fetch
//   2. Get free key → https://www.assemblyai.com/
//      Free credit: $50 on signup (~16 hours of audio)
//   3. Add to .env.local: ASSEMBLYAI_API_KEY=your_key_here
//
// Why not Gemini for this?
//   Gemini transcribes audio but has ZERO speaker diarization.
//   AssemblyAI gives you "Speaker A:", "Speaker B:" labels automatically.
// ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.assemblyai.com/v2'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface DiarizedSegment {
    speaker: string   // "Speaker A", "Speaker B", etc.
    text: string
    start: number     // milliseconds
    end: number       // milliseconds
}

export interface AssemblyAIUtterance {
    speaker: string | number
    text: string
    start: number
    end: number
    // accept any additional fields AssemblyAI may return
    [key: string]: unknown
}

export interface TranscriptionResult {
    // Plain full text (no speaker labels)
    transcript: string

    // Speaker-labeled segments array
    segments: DiarizedSegment[]

    // Formatted as "Speaker A: Hello\nSpeaker B: Hi there"
    // This is what gets saved to DB and used for AI processing
    formattedTranscript: string

    // Raw utterances from AssemblyAI (for DB speakers field)
    utterances: AssemblyAIUtterance[]
}

// ─────────────────────────────────────────────
// MAIN: Transcribe audio URL with speaker diarization
// ─────────────────────────────────────────────
export async function transcribeWithDiarization(
    audioUrl: string,
    speakersExpected?: number  // optional hint: how many speakers
): Promise<TranscriptionResult> {
    if (!process.env.ASSEMBLYAI_API_KEY) {
        throw new Error('Missing ASSEMBLYAI_API_KEY in environment variables')
    }

    const headers = {
        'Authorization': process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
    }

    // ── Step 1: Submit job ──
    const submitRes = await fetch(`${BASE_URL}/transcript`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            audio_url: audioUrl,
            speaker_labels: true,                          // enables diarization ✅
            speakers_expected: speakersExpected ?? 2,      // hint for accuracy
            punctuate: true,                               // adds punctuation
            format_text: true,                             // cleans up text
        }),
    })

    if (!submitRes.ok) {
        const err = await submitRes.text()
        throw new Error(`AssemblyAI submit failed: ${err}`)
    }

    const { id: transcriptId } = await submitRes.json()
    console.log(`[AssemblyAI] Job submitted: ${transcriptId}`)

    // ── Step 2: Poll until done (max 10 minutes) ──
    const MAX_POLLS = 120   // 120 × 5s = 10 minutes max
    let data: any = null

    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // wait 5s

        const pollRes = await fetch(`${BASE_URL}/transcript/${transcriptId}`, { headers })
        data = await pollRes.json()

        console.log(`[AssemblyAI] Status: ${data.status} (attempt ${i + 1})`)

        if (data.status === 'completed') break
        if (data.status === 'error') {
            throw new Error(`AssemblyAI error: ${data.error}`)
        }
    }

    if (!data || data.status !== 'completed') {
        throw new Error('AssemblyAI transcription timed out')
    }

    // ── Step 3: Build result ──
    const utterances: AssemblyAIUtterance[] = data.utterances || []

    const segments: DiarizedSegment[] = utterances.map(u => ({
        speaker: `Speaker ${u.speaker}`,
        text: u.text,
        start: u.start,
        end: u.end,
    }))

    // "Speaker A: Hello\nSpeaker B: Hi" format
    const formattedTranscript = segments
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n')

    return {
        transcript: data.text || '',
        segments,
        formattedTranscript,
        utterances,
    }
}