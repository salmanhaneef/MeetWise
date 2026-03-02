// lib/ai-processor.ts

import { BASE, HEADERS } from './gemini'

export interface TranscriptWord {
    word: string
    start?: number
    end?: number
    confidence?: number
}

export interface TranscriptItem {
    speaker?: string | number
    text?: string
    words?: TranscriptWord[]
}

export interface TranscriptObject {
    formattedTranscript?: string
    text?: string
}

export type TranscriptInput = string | TranscriptItem[] | TranscriptObject

export interface ActionItem { 
    id: number
    text: string 
}

export interface ProcessedMeeting { 
    summary: string
    actionItems: ActionItem[] 
}

export async function processMeetingTranscript(transcript: TranscriptInput): Promise<ProcessedMeeting> {
    try {
        let transcriptText = ''
        
        if (Array.isArray(transcript)) {
            transcriptText = transcript.map((item: TranscriptItem) => {
                if (item.speaker && item.text) return `Speaker ${item.speaker}: ${item.text}`
                if (item.speaker && item.words) {
                    return `${item.speaker}: ${item.words.map((w: TranscriptWord) => w.word).join(' ')}`
                }
                return item.text || ''
            }).join('\n')
        } else if (typeof transcript === 'string') {
            transcriptText = transcript
        } else if (transcript?.formattedTranscript) {
            transcriptText = transcript.formattedTranscript
        } else if (transcript?.text) {
            transcriptText = transcript.text
        }

        if (!transcriptText.trim()) {
            throw new Error('No transcript content found')
        }

        const res = await fetch(
            `${BASE}/models/gemini-2.5-flash:generateContent`, // ✅ Use available model
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: `Analyze meeting transcripts. Return ONLY raw JSON, no markdown, no backticks:
{"summary": "2-3 sentence summary", "actionItems": ["item1", "item2"]}` }]
                    },
                    contents: [{ 
                        role: 'user', 
                        parts: [{ text: `Analyze this transcript:\n\n${transcriptText}` }] 
                    }],
                    generationConfig: { 
                        temperature: 0.3, 
                        maxOutputTokens: 1000 
                    }
                })
            }
        )

        if (!res.ok) {
            const err = await res.text()
            if (res.status === 429) {
                return {
                    summary: 'Rate limit exceeded. Please try again later.',
                    actionItems: []
                }
            }
            throw new Error(`Gemini error: ${res.status} ${err}`)
        }

        interface GeminiResponse {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>
                }
            }>
        }
        
        const data: GeminiResponse = await res.json()
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const cleaned = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
        
        let parsed: { summary?: string; actionItems?: string[] }
        try {
            parsed = JSON.parse(cleaned)
        } catch {
            parsed = { summary: responseText, actionItems: [] }
        }

        return {
            summary: parsed.summary || 'Summary could not be generated',
            actionItems: Array.isArray(parsed.actionItems)
                ? parsed.actionItems.map((text: string, i: number) => ({ 
                    id: i + 1, 
                    text: String(text) 
                }))
                : []
        }
    } catch (error) {
        console.error('[ai-processor] Error:', error)
        return { 
            summary: 'Meeting transcript processed. Please check the full transcript for details.', 
            actionItems: [] 
        }
    }
}