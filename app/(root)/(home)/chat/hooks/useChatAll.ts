// app/chat/hooks/useChatAll.ts
// ✅ FIXED: handleSuggestionClick only set chatInput but never sent the message
//    Now it sets input AND immediately sends it so clicking a suggestion
//    actually triggers the API call
// ✅ FIXED: file extension .tsx → .ts (no JSX in this file)

import { useChatCore } from "@/hooks/chat/useChatCore"

const chatSuggestions = [
    "What were the key decisions made in yesterday's product meeting?",
    "Summarize the action items from last week's standup",
    "Who attended the client presentation on Monday?",
    "What deadlines were discussed in recent meetings?",
    "Generate a follow-up email for the marketing meeting",
    "What feedback was given about the new feature?"
]

export default function useChatAll() {
    const chat = useChatCore({
        apiEndpoint: '/api/rag/chat-all',
        getRequestBody: (input) => ({ question: input })
    })

    // ✅ FIXED: Override handleSuggestionClick to also trigger send
    // Original only called setChatInput(suggestion) — never sent the message
    const handleSuggestionClick = async (suggestion: string) => {
        if (!chat.canChat) return

        chat.setShowSuggestions(false)

        // Directly call the API with the suggestion text
        // (can't rely on setChatInput + handleSendMessage since state updates are async)
        if (chat.isLoading) return

        chat.setIsLoading(true)

        const newMessage = {
            id: chat.messages.length + 1,
            content: suggestion,
            isBot: false,
            timestamp: new Date()
        }

        chat.setMessages(prev => [...prev, newMessage])

        try {
            const response = await fetch('/api/rag/chat-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: suggestion })
            })

            const data = await response.json()

            const botMessage = {
                id: chat.messages.length + 2,
                content: data.answer || data.response || 'Sorry, I could not find an answer.',
                isBot: true,
                timestamp: new Date()
            }

            chat.setMessages(prev => [...prev, botMessage])
        } catch (error) {
            console.error('[useChatAll] Suggestion fetch error:', error)
            chat.setMessages(prev => [
                ...prev,
                {
                    id: chat.messages.length + 2,
                    content: 'Sorry, I could not connect to the server. Please try again.',
                    isBot: true,
                    timestamp: new Date()
                }
            ])
        } finally {
            chat.setIsLoading(false)
        }
    }

    return {
        ...chat,
        chatSuggestions,
        handleSuggestionClick,  // override with fixed version
    }
}