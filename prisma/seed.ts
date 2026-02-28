import * as dotenv from 'dotenv';
dotenv.config();
console.log('DATABASE_URL:', process.env.DATABASE_URL); 
import * as path from "path";
import * as fs from 'fs';
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

async function seedMeetings() {
    try {
        const dataPath = path.join(__dirname, '..', 'constants', 'data');

        const transcript1 = JSON.parse(fs.readFileSync(path.join(dataPath, 'transcripts', 'transcript1.json'), 'utf8'));
        const transcript2 = JSON.parse(fs.readFileSync(path.join(dataPath, 'transcripts', 'transcript2.json'), 'utf8'));
        const transcript3 = JSON.parse(fs.readFileSync(path.join(dataPath, 'transcripts', 'transcript3.json'), 'utf8'));

        const summaries = JSON.parse(fs.readFileSync(path.join(dataPath, 'summaries.json'), 'utf8'));
        const actionItems = JSON.parse(fs.readFileSync(path.join(dataPath, 'action-items.json'), 'utf8'));
        const titles = JSON.parse(fs.readFileSync(path.join(dataPath, 'title.json'), 'utf8'));

        // User IDs
        const hostId = '638dc27d-adbd-4873-ad50-ac8e6c74fb6d';
        const participant1Id = '71c9c669-e375-4d67-b159-9f7cc88d7417';
        const participant2Id = 'bd161ddc-9b71-4839-a906-93e4f1eef59a';
        
        const recordingUrls = [
            'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        ];

        const invitationEmails = [
            'salmanhanif80450@gmail.com',
            's0a0h01@gmail.com'
        ];

        const now = new Date();
        
        // Update host to Pro plan
        await prisma.user.update({
            where: { id: hostId },
            data: {
                currentPlan: 'pro',
                subscriptionStatus: 'active'
            }
        });
        console.log('✓ Updated host to Pro plan');

        const meetings = [
            {
                transcript: transcript1,
                title: titles[0].title,
                description: titles[0].description,
                summary: summaries[0]?.summary || summaries.summary,
                actionItems: actionItems[0] || actionItems,
                recordingUrl: recordingUrls[0],
                duration: 45,
                actualDuration: 42,
                status: "COMPLETED" as const
            },
            {
                transcript: transcript2,
                title: titles[1].title,
                description: titles[1].description,
                summary: summaries[1]?.summary || summaries.summary,
                actionItems: actionItems[1] || actionItems,
                recordingUrl: recordingUrls[1],
                duration: 60,
                actualDuration: 55,
                status: "COMPLETED" as const
            },
            {
                transcript: transcript3,
                title: titles[2].title,
                description: titles[2].description,
                summary: summaries[2]?.summary || summaries.summary,
                actionItems: actionItems[2] || actionItems,
                recordingUrl: recordingUrls[2],
                duration: 30,
                actualDuration: 28,
                status: "COMPLETED" as const
            }
        ];

        for (let i = 0; i < meetings.length; i++) {
            const meeting = meetings[i];
            const meetingId = randomUUID();
            const streamCallId = `call-${randomUUID().slice(0, 8)}`;
            
            const scheduledFor = new Date(now.getTime() - (7 - i) * 24 * 60 * 60 * 1000);
            const startedAt = new Date(scheduledFor.getTime() + 2 * 60 * 1000);
            const endedAt = new Date(startedAt.getTime() + meeting.actualDuration * 60 * 1000);

            const createdMeeting = await prisma.meeting.create({
                data: {
                    id: meetingId,
                    streamCallId: streamCallId,
                    hostId: hostId,
                    title: meeting.title,
                    description: meeting.description,
                    scheduledFor: scheduledFor,
                    duration: meeting.duration,
                    startedAt: startedAt,
                    endedAt: endedAt,
                    actualDuration: meeting.actualDuration,
                    status: meeting.status,
                    recordingUrls: [meeting.recordingUrl],
                    recordingDuration: meeting.actualDuration * 60,
                    transcriptReady: true,
                    transcript: meeting.transcript,
                    speakers: {
                        speakers: [
                            { name: "Host", speakingTime: 1200 },
                            { name: "Participant 1", speakingTime: 800 },
                            { name: "Participant 2", speakingTime: 600 }
                        ]
                    },
                    summary: meeting.summary,
                    actionItems: meeting.actionItems,
                    processed: true,
                    processedAt: endedAt,
                    ragProcessed: true,
                    ragProcessedAt: new Date(endedAt.getTime() + 5 * 60 * 1000),
                    emailSent: true,
                    emailSentAt: new Date(endedAt.getTime() + 10 * 60 * 1000),
                    totalParticipants: 3
                }
            });
            
            console.log(`✓ Created meeting: ${createdMeeting.title} (${meetingId})`);

            for (const email of invitationEmails) {
                await prisma.invitation.create({
                    data: {
                        meetingId: meetingId,
                        email: email,
                        name: email.split('@')[0],
                        status: "ACCEPTED" as const,
                        sentAt: new Date(scheduledFor.getTime() - 24 * 60 * 60 * 1000),
                        acceptedAt: new Date(scheduledFor.getTime() - 2 * 60 * 60 * 1000)
                    }
                });
                console.log(`  ✓ Invitation sent to ${email}`);
            }

            const participantData = [
                {
                    userId: hostId,
                    joinedAt: startedAt,
                    leftAt: endedAt,
                    duration: meeting.actualDuration * 60,
                    isMicMuted: false,
                    isCameraOff: false
                },
                {
                    userId: participant1Id,
                    joinedAt: new Date(startedAt.getTime() + 30 * 1000),
                    leftAt: new Date(endedAt.getTime() - 5 * 60 * 1000),
                    duration: (meeting.actualDuration - 5) * 60 - 30,
                    isMicMuted: true,
                    isCameraOff: false
                },
                {
                    userId: participant2Id,
                    joinedAt: new Date(startedAt.getTime() + 60 * 1000),
                    leftAt: endedAt,
                    duration: (meeting.actualDuration - 1) * 60,
                    isMicMuted: false,
                    isCameraOff: true
                }
            ];

            for (const participant of participantData) {
                await prisma.meetingParticipant.create({
                    data: {
                        meetingId: meetingId,
                        userId: participant.userId,
                        joinedAt: participant.joinedAt,
                        leftAt: participant.leftAt,
                        duration: participant.duration,
                        isMicMuted: participant.isMicMuted,
                        isCameraOff: participant.isCameraOff
                    }
                });
            }
            console.log(`  ✓ Created 3 participants`);

            const chunks = [
                {
                    chunkIndex: 0,
                    content: `Welcome everyone to ${meeting.title}. Let's discuss the agenda items.`,
                    speakerName: "Host"
                },
                {
                    chunkIndex: 1,
                    content: "I have some input on the current progress and potential blockers.",
                    speakerName: "Participant 1"
                },
                {
                    chunkIndex: 2,
                    content: "Let's align on the next steps and action items before we wrap up.",
                    speakerName: "Participant 2"
                }
            ];

            for (const chunk of chunks) {
                await prisma.transcriptChunk.create({
                    data: {
                        meetingId: meetingId,
                        chunkIndex: chunk.chunkIndex,
                        content: chunk.content,
                        speakerName: chunk.speakerName,
                        vectorId: `vec_${randomUUID().slice(0, 12)}`
                    }
                });
            }
            console.log(`  ✓ Created ${chunks.length} transcript chunks`);
        }

        console.log('\n🎉 Seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error seeding meetings:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seedMeetings();