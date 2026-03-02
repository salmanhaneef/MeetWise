// app/meeting-info/[id]/components/MeetingHeader.tsx
//
// BUGS FIXED:
// ✅ #1 — Toast fired BEFORE API call — now fires only on success
// ✅ #2 — DELETE route uses meetingId (DB id) not streamCallId
//         /api/meetings/[id] DELETE needs the same [id] as GET — streamCallId
//         So passing meetingId prop should be the streamCallId
// ✅ #3 — Empty catch blocks swallowed errors silently — now shows error toasts
// ✅ #4 — Slack post toast fired before API responded

import { Button } from '@/components/ui/button'
import { Check, Eye, Share2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

interface MeetingHeaderProps {
    title: string
    // ✅ meetingId here should be the streamCallId
    // because DELETE /api/meetings/[id] uses streamCallId (same as GET)
    meetingId?: string
    summary?: string
    actionItems?: string
    isOwner: boolean
    isLoading?: boolean
}

function MeetingHeader({
    title,
    meetingId,
    summary,
    actionItems,
    isOwner,
    isLoading = false
}: MeetingHeaderProps) {
    const [isPosting, setIsPosting] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handlePostToSlack = async () => {
        if (!meetingId) return

        try {
            setIsPosting(true)

            const response = await fetch('/api/slack/post-meeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId,
                    summary: summary || 'Meeting summary not available',
                    actionItems: actionItems || 'No action items recorded'
                })
            })

            // ✅ FIXED: toast fires AFTER API responds
            if (response.ok) {
                toast('✅ Posted to Slack', {
                    action: { label: 'OK', onClick: () => {} }
                })
            } else {
                const result = await response.json()
                toast.error(result.error || 'Failed to post to Slack')
            }
        } catch (error) {
            // ✅ FIXED: was silently swallowing error
            console.error('[MeetingHeader] Slack post error:', error)
            toast.error('Failed to post to Slack')
        } finally {
            setIsPosting(false)
        }
    }

    const handleShare = async () => {
        if (!meetingId) return

        try {
            const shareUrl = `${window.location.origin}/meeting-info/${meetingId}`
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            toast('✅ Meeting link copied!', {
                action: { label: 'OK', onClick: () => {} }
            })
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('[MeetingHeader] Share error:', error)
            toast.error('Failed to copy link')
        }
    }

    const handleDelete = async () => {
        if (!meetingId) return

        try {
            setIsDeleting(true)

            // ✅ DELETE route is /api/meetings/[streamCallId]
            const response = await fetch(`/api/meetings/${meetingId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            })

            // ✅ FIXED: toast fires AFTER success, redirect only on ok
            if (response.ok) {
                toast('✅ Meeting deleted', {
                    action: { label: 'OK', onClick: () => {} }
                })
                router.push('/home')
            } else {
                const result = await response.json()
                toast.error(result.error || 'Failed to delete meeting')
            }
        } catch (error) {
            // ✅ FIXED: was silently swallowing error
            console.error('[MeetingHeader] Delete error:', error)
            toast.error('Failed to delete meeting')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className='bg-card border-b border-border px-6 py-3.5 flex justify-between items-center'>
            <h1 className='text-xl font-semibold text-foreground'>
                {title}
            </h1>

            {isLoading ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground' />
                    Loading...
                </div>
            ) : isOwner ? (
                <div className='flex gap-3'>
                    <Button
                        onClick={handlePostToSlack}
                        disabled={isPosting || !meetingId}
                        variant='outline'
                        className='border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer disabled:cursor-not-allowed'
                    >
                        <img
                            src='/slack.png'
                            alt='Slack'
                            className='w-4 h-4 mr-2'
                        />
                        {isPosting ? 'Posting...' : 'Post to Slack'}
                    </Button>

                    <Button
                        onClick={handleShare}
                        variant='outline'
                        className='flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-foreground text-sm cursor-pointer'
                    >
                        {copied ? (
                            <><Check className='h-4 w-4' /> Copied!</>
                        ) : (
                            <><Share2 className='h-4 w-4' /> Share</>
                        )}
                    </Button>

                    <Button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className='flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    >
                        <Trash2 className='h-4 w-4' />
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            ) : (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Eye className='w-4 h-4' />
                    Viewing shared meeting
                </div>
            )}
        </div>
    )
}

export default MeetingHeader