// lib/gemini.ts
// ─────────────────────────────────────────────────────────────
// Uses Gemini REST API directly — no SDK
//
// CRITICAL FIXES:
//   ✅ Embedding: Use correct endpoint format (models/MODEL_NAME:embedContent)
//   ✅ Chat: Use gemini-2.5-flash (available in your API)
//   ✅ Removed trailing space in BASE URL
// ─────────────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY!
// ✅ FIXED: No trailing space
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

const HEADERS = {
    'Content-Type': 'application/json',
    'x-goog-api-key': API_KEY,
}

export { BASE, HEADERS }

// ✅ CORRECT: Embedding endpoint format
export async function createEmbedding(text: string): Promise<number[]> {
    const res = await fetch(
        `${BASE}/models/gemini-embedding-001:embedContent`,
        {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                model: 'models/gemini-embedding-001', // Must include 'models/' prefix
                content: {
                    parts: [{ text }]
                },
                outputDimensionality: 768 // Optional: reduce dimensions
            })
        }
    )

    if (!res.ok) {
        const err = await res.text()
        console.error('[createEmbedding] Error response:', err)
        
        if (res.status === 404) {
            throw new Error('Embedding model not found. Your API key may not have access to gemini-embedding-001. Try text-embedding-004 or enable billing.')
        }
        if (res.status === 429) {
            throw new Error('Rate limit exceeded. Please wait 60 seconds or upgrade your plan.')
        }
        throw new Error(`Gemini embedding error: ${res.status} ${err}`)
    }

    const data = await res.json()
    return data.embedding.values
}

// Batch embeddings with rate limiting
export async function createManyEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i]
        try {
            console.log(`[Embedding] Processing ${i + 1}/${texts.length}...`)
            const embedding = await createEmbedding(text)
            embeddings.push(embedding)
            
            // Rate limit: 60 requests/minute on free tier
            if (i < texts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1100))
            }
        } catch (error) {
            console.error(`[createManyEmbeddings] Failed at item ${i}:`, error)
            throw error
        }
    }

    return embeddings
}

// ✅ CORRECT: Use gemini-2.5-flash (confirmed available in your API)
export async function chatWithAI(
    systemPrompt: string,
    userQuestion: string
): Promise<string> {
    const res = await fetch(
        `${BASE}/models/gemini-2.5-flash:generateContent`, // ✅ Using model from your API list
        {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: userQuestion }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        }
    )

    if (!res.ok) {
        const err = await res.text()
        console.error('[chatWithAI] Error:', err)
        
        if (res.status === 429) {
            return 'I apologize, but I am currently busy. Please try again in a moment.'
        }
        throw new Error(`Gemini chat error: ${res.status} ${err}`)
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text
        ?? 'Sorry, I could not generate a response.'
}