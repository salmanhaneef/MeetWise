// app/chat/components/ChatInput.tsx
// ✅ FIXED: Enter key handler was missing preventDefault — could cause form submit
// ✅ FIXED: folder was 'component' (no s) — renamed to 'components'
// ✅ FIXED: send button had no loading spinner — user had no feedback while waiting

import { useUsage } from '@/app/contexts/UsageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send } from 'lucide-react'
import React from 'react'

interface ChatInputProps {
    chatInput: string
    onInputChange: (value: string) => void
    onSendMessage: () => void
    isLoading: boolean
}

function ChatInput({
    chatInput,
    onInputChange,
    onSendMessage,
    isLoading
}: ChatInputProps) {
    const { canChat, usage, limits } = useUsage()

    // ✅ FIXED: added preventDefault so Enter doesn't accidentally submit a form
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSendMessage()
        }
    }

    return (
        <div className='p-6 border-t border-border'>
            {/* Limit warning */}
            {!canChat && usage && (
                <div className='max-w-4xl mx-auto mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg'>
                    <p className='text-sm text-orange-600 dark:text-orange-400 text-center'>
                        Daily limit reached ({usage.chatMessagesToday}/{limits.chatMessages} messages used).{' '}
                        <a href='/pricing' className='underline ml-1'>
                            Upgrade your plan
                        </a>{' '}
                        to continue chatting.
                    </p>
                </div>
            )}

            <div className='flex gap-3 max-w-4xl mx-auto'>
                <Input
                    type='text'
                    value={chatInput}
                    onChange={e => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        canChat
                            ? 'Ask about any meeting — deadlines, decisions, action items...'
                            : 'Daily chat limit reached — upgrade to continue'
                    }
                    className='flex-1'
                    disabled={isLoading || !canChat}
                    autoComplete='off'
                />

                <Button
                    onClick={onSendMessage}
                    // ✅ FIXED: also disable when input is empty
                    disabled={isLoading || !canChat || !chatInput.trim()}
                    className='px-4'
                >
                    {/* ✅ ADDED: spinner while loading so user knows request is in-flight */}
                    {isLoading
                        ? <Loader2 className='h-4 w-4 animate-spin' />
                        : <Send className='h-4 w-4' />
                    }
                </Button>
            </div>
        </div>
    )
}

export default ChatInput