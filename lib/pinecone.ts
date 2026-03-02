// lib/pinecone.ts
import { Pinecone, RecordMetadata, RecordMetadataValue } from '@pinecone-database/pinecone'

if (!process.env.PINECONE_API_KEY) {
    throw new Error('Missing PINECONE_API_KEY in environment variables')
}

if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('Missing PINECONE_INDEX_NAME in environment variables')
}

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
})

// ✅ Define metadata type compatible with Pinecone's RecordMetadataValue
// Supported types: string | number | boolean | string[]
export type AppMetadata = Record<string, string | number | boolean | string[]>

// ✅ Type the index explicitly
const index = pinecone.index<AppMetadata>(process.env.PINECONE_INDEX_NAME)

export async function saveManyVectors(vectors: Array<{
    id: string
    embedding: number[]
    metadata: AppMetadata
}>) {
    const upsertData = vectors.map(v => ({
        id: v.id,
        values: v.embedding,
        metadata: v.metadata,
    }))

    // ✅ Pinecone SDK v3+: requires { records: [...] }
    await index.upsert({ records: upsertData })
}

export async function searchVectors(
    embedding: number[],
    filter: Record<string, string | number | boolean | string[]> = {},
    topK: number = 5
) {
    const result = await index.query({
        vector: embedding,
        filter,
        topK,
        includeMetadata: true,
    })

    return result.matches || []
}