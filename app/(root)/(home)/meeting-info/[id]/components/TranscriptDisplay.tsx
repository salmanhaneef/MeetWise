'use client'

// app/meeting-info/[id]/components/TranscriptDisplay.tsx
// Handles ALL transcript formats returned by your API:
//
// Format 1 (your current DB data):
//   [{ words: [{ word, start, end }], speaker?: string }]
//   — words array, start/end in SECONDS (not ms)
//
// Format 2 (AssemblyAI diarized):
//   [{ speaker, text, start, end }]
//   — text string, start/end in milliseconds
//
// Format 3 (plain string):
//   "Speaker A: Hello\nSpeaker B: Hi"

// ── Types ──────────────────────────────────────────────────────

interface WordToken {
    word: string
    start: number   // seconds
    end: number     // seconds
}

interface RawSegment {
    // Format 1 — words array (your actual DB data)
    words?: WordToken[]
    speaker?: string

    // Format 2 — AssemblyAI diarized
    text?: string
    start?: number
    end?: number
}

interface DisplaySegment {
    speaker: string
    text: string
    startSeconds?: number
    endSeconds?: number
}

interface TranscriptDisplayProps {
    transcript: RawSegment[] | string | unknown  // ✅ Fixed: any → unknown
}

// ── Helpers ────────────────────────────────────────────────────

// Format seconds → "1:23"
function formatSeconds(sec: number | undefined): string | null {
    if (sec === undefined || sec === null || isNaN(sec)) return null
    const minutes = Math.floor(sec / 60)
    const secs = Math.floor(sec % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Parse plain "Speaker: text\n..." string
function parseStringTranscript(raw: string): DisplaySegment[] {
    return raw
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            const colonIndex = line.indexOf(':')
            if (colonIndex > 0 && colonIndex < 60) {
                return {
                    speaker: line.substring(0, colonIndex).trim(),
                    text: line.substring(colonIndex + 1).trim(),
                }
            }
            return { speaker: 'Speaker', text: line.trim() }
        })
        .filter(seg => seg.text.length > 0)
}

// Normalize any format → DisplaySegment[]
function normalizeTranscript(transcript: unknown): DisplaySegment[] {  // ✅ Fixed: any → unknown
    if (!transcript) return []

    // ── Plain string ──
    if (typeof transcript === 'string') {
        return parseStringTranscript(transcript)
    }

    if (!Array.isArray(transcript) || transcript.length === 0) return []

    const first = transcript[0]

    // ── Format 1: words array (your actual DB format) ──
    // [{ words: [{ word, start, end }], speaker? }]
    if (first && Array.isArray(first.words)) {
        return transcript.map((seg: RawSegment, index: number) => {
            const words = seg.words ?? []
            const text = words.map((w: WordToken) => w.word).join(' ')
            const startSec = words[0]?.start
            const endSec = words[words.length - 1]?.end

            return {
                speaker: seg.speaker ?? `Speaker ${index + 1}`,
                text,
                startSeconds: startSec,
                endSeconds: endSec,
            }
        })
    }

    // ── Format 2: AssemblyAI diarized { speaker, text, start, end } ──
    // start/end are in milliseconds here
    if (first && typeof first.text === 'string') {
        return transcript.map((seg: RawSegment) => ({
            speaker: seg.speaker ?? 'Speaker',
            text: seg.text ?? '',
            // Convert ms → seconds
            startSeconds: seg.start !== undefined ? seg.start / 1000 : undefined,
            endSeconds: seg.end !== undefined ? seg.end / 1000 : undefined,
        }))
    }

    // ── Format 3: plain string array ──
    if (typeof first === 'string') {
        return parseStringTranscript(transcript.join('\n'))
    }

    return []
}

// ── Component ──────────────────────────────────────────────────

export default function TranscriptDisplay({ transcript }: TranscriptDisplayProps) {
    const segments = normalizeTranscript(transcript)

    if (segments.length === 0) {
        return (
            <div className='bg-card rounded-lg p-6 border border-border text-center'>
                <p className='text-muted-foreground'>No transcript available</p>
            </div>
        )
    }

    // Assign a color to each unique speaker
    const speakerColors: Record<string, string> = {}
    const colorClasses = [
        'text-blue-400',
        'text-emerald-400',
        'text-violet-400',
        'text-amber-400',
        'text-rose-400',
        'text-cyan-400',
    ]
    let colorIndex = 0
    segments.forEach(seg => {
        if (!speakerColors[seg.speaker]) {
            speakerColors[seg.speaker] = colorClasses[colorIndex % colorClasses.length]
            colorIndex++
        }
    })

    return (
        <div className='bg-card rounded-lg p-6 border border-border'>
            <h3 className='text-lg font-semibold text-foreground mb-4'>
                Meeting Transcript
            </h3>

            <div className='space-y-4 max-h-[600px] overflow-y-auto pr-2'>
                {segments.map((segment, index) => {
                    const start = formatSeconds(segment.startSeconds)
                    const end = formatSeconds(segment.endSeconds)
                    const hasTime = start !== null && end !== null
                    const color = speakerColors[segment.speaker] ?? 'text-foreground'

                    return (
                        <div key={index} className='pb-4 border-b border-border last:border-b-0'>
                            <div className='flex items-center gap-3 mb-1'>
                                <span className={`font-semibold text-sm ${color}`}>
                                    {segment.speaker}
                                </span>

                                {/* Only show if valid timestamps exist */}
                                {hasTime && (
                                    <span className='text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded'>
                                        {start} – {end}
                                    </span>
                                )}
                            </div>

                            <p className='text-muted-foreground leading-relaxed pl-3 text-sm border-l-2 border-muted'>
                                {segment.text}
                            </p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}