// lib/integrations/trello/trello.ts
import type { ActionItemData } from "../type"
import https from 'https'

// Define proper type for fetch options with agent
type FetchOptions = RequestInit & {
  agent?: https.Agent | undefined
}

export class TrelloAPI {
    private apiKey = process.env.TRELLO_API_KEY!
    private baseUrl = 'https://api.trello.com/1'

    private getHttpsAgent(): https.Agent | undefined {
        if (process.env.NODE_ENV === 'development' && process.env.IGNORE_SSL_ERRORS === 'true') {
            return new https.Agent({ rejectUnauthorized: false })
        }
        return undefined
    }

    async getBoards(token: string) {
        const options: FetchOptions = {
            agent: this.getHttpsAgent(),
        }

        const response = await fetch(
            `${this.baseUrl}/members/me/boards?key=${this.apiKey}&token=${token}`,
            options
        )

        if (!response.ok) {
            throw new Error('failed to fetch boards')
        }
        return response.json()
    }

    async createBoard(token: string, name: string) {
        const options: FetchOptions = {
            method: 'POST',
            agent: this.getHttpsAgent(),
        }

        const response = await fetch(
            `${this.baseUrl}/boards?key=${this.apiKey}&token=${token}&name=${encodeURIComponent(name)}&defaultLists=true`,
            options
        )

        if (!response.ok) {
            throw new Error('failed to create boards')
        }
        return response.json()
    }

    async getBoardLists(token: string, boardId: string) {
        const options: FetchOptions = {
            agent: this.getHttpsAgent(),
        }

        const response = await fetch(
            `${this.baseUrl}/boards/${boardId}/lists?key=${this.apiKey}&token=${token}`,
            options
        )

        if (!response.ok) {
            throw new Error('failed to fetch lists')
        }
        return response.json()
    }

    async createCard(token: string, listId: string, data: ActionItemData) {
        const options: FetchOptions = {
            method: 'POST',
            agent: this.getHttpsAgent(),
        }

        const response = await fetch(
            `${this.baseUrl}/cards?key=${this.apiKey}&token=${token}&idList=${listId}&name=${encodeURIComponent(data.title)}&desc=${encodeURIComponent(data.description || '')}`,
            options
        )

        if (!response.ok) {
            throw new Error('failed to create card')
        }
        return response.json()
    }
}