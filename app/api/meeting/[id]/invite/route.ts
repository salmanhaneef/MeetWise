// app/api/meetings/[id]/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { sendMeetingInvitation } from '@/lib/email';

// Type for Prisma errors
interface PrismaError extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Changed to Promise
) {
  // ✅ MUST await params in Next.js 15
  const { id: meetingId } = await params;
  
  console.log('🚀 [INVITE] Starting invitation process...');
  console.log('📋 [INVITE] Meeting ID:', meetingId);
  
  try {
    const { searchParams } = new URL(req.url);
    const testUserId = searchParams.get('testUserId');
    
    let userId: string;
    
    if (testUserId) {
      console.log('🧪 [INVITE] Using test user ID:', testUserId);
      userId = testUserId;
    } else {
      console.log('🔐 [INVITE] Authenticating with Clerk...');
      const user = await currentUser();
      if (!user) {
        console.error('❌ [INVITE] No authenticated user found');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
      console.log('✅ [INVITE] Authenticated user:', userId);
    }

    // Get user from DB
    console.log('🔍 [INVITE] Looking up user in database...');
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      console.error('❌ [INVITE] User not found in database:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log('✅ [INVITE] Found user:', dbUser.email);

    // Get meeting - ✅ Now uses meetingId instead of params.id
    console.log('🔍 [INVITE] Looking up meeting...');
    const meeting = await prisma.meeting.findUnique({
      where: { streamCallId: meetingId },
      include: { host: true },
    });

    if (!meeting) {
      console.error('❌ [INVITE] Meeting not found:', meetingId);
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    console.log('✅ [INVITE] Found meeting:', meeting.title);
    console.log('📊 [INVITE] Meeting details:', {
      id: meeting.id,
      title: meeting.title,
      hostId: meeting.hostId,
      scheduledFor: meeting.scheduledFor
    });

    // Verify host
    if (meeting.hostId !== dbUser.id) {
      console.error('❌ [INVITE] Authorization failed. User is not the host.');
      console.error('   Meeting host ID:', meeting.hostId);
      console.error('   Current user ID:', dbUser.id);
      return NextResponse.json(
        { error: 'Only the host can send invitations' },
        { status: 403 }
      );
    }
    console.log('✅ [INVITE] User is the meeting host');

    // Parse request body
    console.log('📥 [INVITE] Parsing request body...');
    const body = await req.json();
    const { participants } = body;
    console.log('📧 [INVITE] Participants to invite:', participants);

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      console.error('❌ [INVITE] Invalid participants array');
      return NextResponse.json(
        { error: 'Participants array is required' },
        { status: 400 }
      );
    }
    console.log(`📊 [INVITE] Processing ${participants.length} participant(s)`);

    const results = [];
    const errors = [];

    // STEP 1: Create all invitations in DB
    console.log('💾 [INVITE] Creating invitation records in database...');
    for (const participant of participants) {
      try {
        console.log(`   Creating invitation for: ${participant.email}`);
        const invitation = await prisma.invitation.create({
          data: {
            meetingId: meeting.id,
            email: participant.email,
            name: participant.name || participant.email.split('@')[0],
            status: 'PENDING',
          },
        });

        console.log(`   ✅ Created invitation ID: ${invitation.id}`);
        results.push({
          email: participant.email,
          invitationId: invitation.id,
          status: 'pending'
        });
      } catch (error) {
        console.error(`   ❌ Failed to create invitation for ${participant.email}:`, error);
        
        const prismaError = error as PrismaError;
        
        if (prismaError.code === 'P2002') {
          console.log(`   ℹ️  Duplicate invitation detected for ${participant.email}`);
          errors.push({
            email: participant.email,
            error: 'Already invited',
          });
        } else if (prismaError.message) {
          console.error(`   ❌ Database error:`, prismaError.message);
          errors.push({
            email: participant.email,
            error: prismaError.message,
          });
        } else {
          console.error(`   ❌ Unknown error:`, error);
          errors.push({
            email: participant.email,
            error: 'Unknown database error',
          });
        }
      }
    }

    console.log(`✅ [INVITE] Created ${results.length} invitation(s) in database`);
    if (errors.length > 0) {
      console.log(`⚠️  [INVITE] ${errors.length} error(s) occurred:`, errors);
    }

    // STEP 2: Send emails in background
    const meetingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/meeting/${meeting.streamCallId}`;
    console.log('📤 [INVITE] Queueing emails for background sending...');
    console.log('🔗 [INVITE] Meeting link:', meetingLink);
    
    // Fire and forget
    setImmediate(async () => {
      console.log('🔄 [BACKGROUND] Starting email sending process...');
      
      for (const participant of participants) {
        try {
          console.log(`📧 [BACKGROUND] Sending email to ${participant.email}...`);
          
          const emailResult = await sendMeetingInvitation({
            to: participant.email,
            participantName: participant.name || participant.email.split('@')[0],
            meetingTitle: meeting.title,
            meetingDate: meeting.scheduledFor,
            meetingDuration: meeting.duration,
            meetingLink,
            hostName: meeting.host.firstName || meeting.host.email,
          });

          console.log(`📊 [BACKGROUND] Email result for ${participant.email}:`, emailResult);

          if (emailResult.success) {
            const updateResult = await prisma.invitation.updateMany({
              where: { 
                meetingId: meeting.id,
                email: participant.email 
              },
              data: { 
                status: 'SENT',
                sentAt: new Date()
              }
            });
            console.log(`✅ [BACKGROUND] Email sent successfully to ${participant.email}`);
            console.log(`   Updated ${updateResult.count} invitation record(s)`);
          } else {
            await prisma.invitation.updateMany({
              where: { 
                meetingId: meeting.id,
                email: participant.email 
              },
              data: { status: 'FAILED' }
            });
            console.error(`❌ [BACKGROUND] Email failed for ${participant.email}`);
          }
        } catch (emailError) {
          const error = emailError as Error;
          console.error(`❌ [BACKGROUND] Exception sending to ${participant.email}:`, error);
          console.error(`   Error message:`, error.message);
          console.error(`   Error stack:`, error.stack);
          
          try {
            await prisma.invitation.updateMany({
              where: { 
                meetingId: meeting.id,
                email: participant.email 
              },
              data: { status: 'FAILED' }
            });
            console.log(`   Updated status to FAILED for ${participant.email}`);
          } catch (dbError) {
            console.error(`   ❌ Failed to update status:`, dbError);
          }
        }
      }
      
      console.log('🏁 [BACKGROUND] Email sending process completed');
    });

    // STEP 3: Return immediately
    const response = {
      success: true,
      message: `${results.length} invitation(s) created. Emails are being sent in the background.`,
      invitationsCreated: results.length,
      results,
      errors,
    };
    
    console.log('✅ [INVITE] Returning response:', response);
    console.log('⏱️  [INVITE] Request completed successfully');
    
    return NextResponse.json(response);

  } catch (error) {
    const err = error as Error;
    console.error('💥 [INVITE] FATAL ERROR:', err);
    console.error('   Error type:', err.constructor?.name);
    console.error('   Error message:', err.message);
    console.error('   Error stack:', err.stack);
    
    return NextResponse.json(
      { 
        error: 'Failed to create invitations',
        details: err.message || 'An unknown error occurred',
        type: err.constructor?.name || 'Unknown'
      },
      { status: 500 }
    );
  }
}