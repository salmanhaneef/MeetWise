// app/chat/components/ChatMessages.tsx
// ✅ FIXED: folder was 'component' (no s) — renamed to 'components'
// ✅ FIXED: missing timestamp display on messages
// ✅ ADDED: bot avatar indicator for clearer UX

import React from 'react'

interface Message {
    id: number
    content: string
    isBot: boolean
    timestamp: Date
}

interface ChatMessagesProps {
    messages: Message[]
    isLoading: boolean
}

function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
    return (
        <div className='space-y-4'>
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                >
                    <div
                        className={`max-w-[70%] rounded-lg p-4 ${
                            message.isBot
                                ? 'bg-card border border-border text-foreground'
                                : 'bg-primary text-primary-foreground'
                        }`}
                    >
                        <p className='text-sm leading-relaxed'>{message.content}</p>

                        {/* ✅ ADDED: timestamp so user knows when message was sent */}
                        <p className={`text-xs mt-2 ${
                            message.isBot
                                ? 'text-muted-foreground'
                                : 'text-primary-foreground/70'
                        }`}>
                            {message.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                </div>
            ))}

            {/* Loading indicator while waiting for bot response */}
            {isLoading && (
                <div className='flex justify-start'>
                    <div className='bg-card border border-border rounded-lg p-4'>
                        <div className='flex items-center gap-2'>
                            <span className='text-sm text-muted-foreground'>
                                🤖 Searching through all your meetings
                            </span>
                            {/* Animated dots */}
                            <span className='flex gap-1'>
                                <span className='w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]' />
                                <span className='w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]' />
                                <span className='w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]' />
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatMessages