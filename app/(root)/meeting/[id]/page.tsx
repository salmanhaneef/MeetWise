'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { StreamCall, StreamTheme } from '@stream-io/video-react-sdk';
import { useParams } from 'next/navigation';
import { Loader } from 'lucide-react';

import { useGetCallById } from '@/hooks/useGetCallById';
import Alert from '@/components/ui/Alert';
import MeetingSetup from './component/MeetingSetup';
import MeetingRoom from './component/MeetingRoom';

const MeetingPage = () => {
  const params = useParams();                 
  const callIdRaw = params?.id;               

  // 1. Normalize to string | string[]
  const callId =
    typeof callIdRaw === 'string' ? callIdRaw :
    Array.isArray(callIdRaw) ? callIdRaw[0] : 
    null; 
  
  const { isLoaded, user } = useUser();
  const { call, isCallLoading } = useGetCallById(callId!);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  
  // Tracking refs to handle strict mode and race conditions
  const hasJoined = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  /* -------------------------------------------------------------------------- */
  /*                          TRACK JOIN (POST)                                  */
  /* -------------------------------------------------------------------------- */

  const trackJoin = useCallback(async () => {
    if (!user || !callId || hasJoined.current) {
      console.log('⏭️  [JOIN] Skipping join tracking:', {
        hasUser: !!user,
        hasCallId: !!callId,
        alreadyJoined: hasJoined.current
      });
      return;
    }
    
    hasJoined.current = true;
    abortController.current = new AbortController();
    
    try {
      console.log('📝 [JOIN] Tracking user join...');
      console.log('   - Call ID:', callId);
      console.log('   - User ID:', user.id);

      // ✅ CORRECT: Using /api/meetings/{streamCallId}/participant (plural "meetings")
      const response = await fetch(`/api/meetings/${callId}/participant?testUserId=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [JOIN] Failed to track join:', error);
        hasJoined.current = false; // Reset on failure
        return;
      }

      const data = await response.json();
      console.log('✅ [JOIN] Join tracked successfully:', data);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('❌ [JOIN] Error tracking join:', error);
        hasJoined.current = false; // Reset to allow retry on error
      }
    }
  }, [user, callId]);

  /* -------------------------------------------------------------------------- */
  /*                          TRACK LEAVE (PATCH)                                */
  /* -------------------------------------------------------------------------- */

  const trackLeave = useCallback(() => {
    if (!hasJoined.current || !callId || !user) {
      console.log('⏭️  [LEAVE] Skipping leave tracking:', {
        hasJoined: hasJoined.current,
        hasCallId: !!callId,
        hasUser: !!user
      });
      return;
    }
    
    console.log('📝 [LEAVE] Tracking user leave...');
    console.log('   - Call ID:', callId);
    console.log('   - User ID:', user.id);
    
    // Get actual device state from Stream call object
    const isMicMuted = call?.microphone?.state?.status !== 'enabled';
    const isCameraOff = call?.camera?.state?.status !== 'enabled';
    
    console.log('   - Mic muted:', isMicMuted);
    console.log('   - Camera off:', isCameraOff);
    
    const payload = JSON.stringify({ isMicMuted, isCameraOff });
    
    // ✅ CORRECT: Using /api/meeting/{streamCallId}/participant (singular "meeting")
    // Use sendBeacon for reliability during page close/unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(
        `/api/meeting/${callId}/participant?testUserId=${user.id}`, 
        blob
      );
      console.log(success ? '✅ [LEAVE] Beacon sent successfully' : '⚠️  [LEAVE] Beacon failed');
    } else {
      // Fallback for older browsers
      fetch(`/api/meeting/${callId}/participant?testUserId=${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true, // Ensures request completes even during page unload
      })
        .then(() => console.log('✅ [LEAVE] Leave tracked (fallback)'))
        .catch(err => console.error('❌ [LEAVE] Error tracking leave:', err));
    }
    
    hasJoined.current = false;
  }, [callId, call, user]);

  /* -------------------------------------------------------------------------- */
  /*                   HANDLE SETUP COMPLETE (JOIN/LEAVE)                        */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (isSetupComplete) {
      // User entered meeting room
      console.log('🚪 [SETUP] User entered meeting room');
      trackJoin();
    } else {
      // User went back from meeting room to setup screen
      if (hasJoined.current) {
        console.log('🚪 [SETUP] User returned to setup screen');
        trackLeave();
      }
    }

    // Cleanup: track leave if component unmounts while in meeting
    return () => {
      abortController.current?.abort();
      if (hasJoined.current) {
        console.log('🧹 [CLEANUP] Component unmounting, tracking leave');
        trackLeave();
      }
    };
  }, [isSetupComplete, trackJoin, trackLeave]);

  /* -------------------------------------------------------------------------- */
  /*                   HANDLE BROWSER/TAB CLOSE (BEFOREUNLOAD)                   */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasJoined.current && callId && user) {
        console.log('🚪 [BEFOREUNLOAD] Browser closing, tracking leave');
        
        const isMicMuted = call?.microphone?.state?.status !== 'enabled';
        const isCameraOff = call?.camera?.state?.status !== 'enabled';
        const blob = new Blob(
          [JSON.stringify({ isMicMuted, isCameraOff })], 
          { type: 'application/json' }
        );
        
        // ✅ CORRECT: Using /api/meeting/{streamCallId}/participant
        navigator.sendBeacon(
          `/api/meeting/${callId}/participant?testUserId=${user.id}`, 
          blob
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [callId, call, user]);

  /* -------------------------------------------------------------------------- */
  /*                              RENDER LOGIC                                   */
  /* -------------------------------------------------------------------------- */

  if (!callId || !isLoaded || isCallLoading) {
    console.log('⏳ [RENDER] Loading...', {
      hasCallId: !!callId,
      isLoaded,
      isCallLoading
    });
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="animate-spin" size={48} />
      </div>
    );
  }

  if (!call) {
    console.log('❌ [RENDER] Call not found');
    return (
      <p className="text-center text-3xl font-bold text-white">
        Call Not Found
      </p>
    );
  }

  // Get more info about custom call type: https://getstream.io/video/docs/react/guides/configuring-call-types/ 
  const notAllowed = call.type === 'invited' && (!user || !call.state.members.find((m) => m.user.id === user.id));

  if (notAllowed) {
    console.log('🚫 [RENDER] User not allowed to join');
    return <Alert title="You are not allowed to join this meeting" />;
  }

  console.log('✅ [RENDER] Rendering meeting interface');

  return (
    <main className="h-screen w-full">
      <StreamCall call={call}>
        <StreamTheme>
          {!isSetupComplete ? (
            <MeetingSetup setIsSetupComplete={setIsSetupComplete} />
          ) : (
            <MeetingRoom />
          )}
        </StreamTheme>
      </StreamCall>
    </main>
  );
};

export default MeetingPage;