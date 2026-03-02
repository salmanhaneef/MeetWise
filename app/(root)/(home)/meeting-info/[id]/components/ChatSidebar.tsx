// app/meeting-info/[id]/components/ChatSidebar.tsx
//
// BUGS FIXED:
// ✅ #1 — "Thinking..." showed whenever last message was from user,
//         even when NOT loading. Now controlled by isLoading prop
// ✅ #2 — Missing isLoading prop — sidebar had no loading state passed in
// ✅ #3 — Suggestions still clickable while loading
// ✅ #4 — Input not disabled while loading

import { useUsage } from '@/app/contexts/UsageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send } from 'lucide-react'
import React from 'react'

interface Message {
    id: number
    content: string
    isBot: boolean
    timestamp: Date
}

interface ChatSidebarProps {
    messages: Message[]
    chatInput: string
    showSuggestions: boolean
    isLoading: boolean         // ✅ ADDED: was missing
    onInputChange: (value: string) => void
    onSendMessage: () => void
    onSuggestionClick: (suggestion: string) => void
}

function ChatSidebar({
    messages,
    chatInput,
    showSuggestions,
    isLoading,                  // ✅ ADDED
    onInputChange,
    onSendMessage,
    onSuggestionClick
}: ChatSidebarProps) {
    const { canChat } = useUsage()

    const chatSuggestions = [
        "What deadlines were discussed in this meeting?",
        "Write a follow-up email for the team",
        "What suggestions was I given during the discussion?",
        "Summarize the key action items from this meeting"
    ]

    return (
        <div className='w-96 border-l border-border bg-card flex flex-col'>

            <div className='p-4 border-b border-border'>
                <h3 className='font-semibold text-foreground'>Meeting Assistant</h3>
                <p className='text-sm text-muted-foreground'>
                    Ask me anything about this meeting
                </p>
            </div>

            <div className='flex-1 p-4 overflow-y-auto space-y-4'>
                {/* Messages */}
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.isBot
                                    ? 'bg-muted text-foreground'
                                    : 'bg-primary text-primary-foreground'
                            }`}
                        >
                            <p className='text-sm'>{message.content}</p>
                        </div>
                    </div>
                ))}

                {/* ✅ FIXED: was showing "Thinking..." based on message order
                    Now correctly tied to isLoading prop */}
                {isLoading && (
                    <div className='flex justify-start'>
                        <div className='bg-muted text-foreground rounded-lg p-3'>
                            <div className='flex items-center gap-2'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                <p className='text-sm'>Thinking...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Suggestions — shown when no messages yet */}
                {showSuggestions && messages.length === 0 && (
                    <div className='flex flex-col items-center space-y-3 mt-8'>
                        {chatSuggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => onSuggestionClick(suggestion)}
                                // ✅ FIXED: also disabled while loading
                                disabled={!canChat || isLoading}
                                className={`w-4/5 rounded-lg p-4 border transition-colors text-center ${
                                    canChat && !isLoading
                                        ? 'bg-primary/10 text-foreground border-primary/20 hover:bg-primary/20'
                                        : 'bg-muted/50 text-muted-foreground border-muted cursor-not-allowed'
                                }`}
                            >
                                <p className='text-sm'>⚡️ {suggestion}</p>
                            </button>
                        ))}
                    </div>
                )}

                {!canChat && (
                    <div className='text-center p-4'>
                        <p className='text-xs text-muted-foreground mb-2'>Daily chat limit reached</p>
                        <a href='/pricing' className='text-xs text-primary underline'>
                            Upgrade to continue chatting
                        </a>
                    </div>
                )}
            </div>

            <div className='p-4 border-t border-border'>
                <div className='flex gap-2'>
                    <Input
                        type='text'
                        value={chatInput}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                onSendMessage()
                            }
                        }}
                        placeholder={canChat ? 'Ask about this meeting...' : 'Daily limit reached'}
                        className='flex-1'
                        // ✅ FIXED: also disabled while loading
                        disabled={!canChat || isLoading}
                    />

                    <Button
                        type='button'
                        onClick={onSendMessage}
                        disabled={!chatInput.trim() || !canChat || isLoading}
                    >
                        {/* ✅ ADDED: loading spinner */}
                        {isLoading
                            ? <Loader2 className='h-4 w-4 animate-spin' />
                            : <Send className='h-4 w-4' />
                        }
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default ChatSidebar