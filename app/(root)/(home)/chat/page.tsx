'use client'

// app/chat/page.tsx
// ✅ FIXED: import paths were wrong — 'components' not 'component' (no 's')
// ✅ FIXED: auto-scroll to bottom when new messages arrive
// ✅ FIXED: showSuggestions should hide once message is sent, not just on input

import React, { useEffect, useRef } from 'react'
import useChatAll from './hooks/useChatAll'
import ChatSuggestions from './components/ChatSuggestions'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'

function Chat() {
    const {
        chatInput,
        messages,
        showSuggestions,
        isLoading,
        chatSuggestions,
        handleSendMessage,
        handleSuggestionClick,
        handleInputChange,
    } = useChatAll()

    // ✅ Auto-scroll to bottom when new messages arrive
    const messagesEndRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isLoading])

    return (
        <div className='h-screen bg-background flex flex-col'>
            <div className='flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0'>

                <div className='flex-1 p-6 overflow-y-auto'>
                    {messages.length === 0 && showSuggestions ? (
                        <ChatSuggestions
                            suggestions={chatSuggestions}
                            onSuggestionClick={handleSuggestionClick}
                        />
                    ) : (
                        <>
                            <ChatMessages
                                messages={messages}
                                isLoading={isLoading}
                            />
                            {/* Anchor for auto-scroll */}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                <ChatInput
                    chatInput={chatInput}
                    onInputChange={handleInputChange}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                />

            </div>
        </div>
    )
}

export default Chat