// hooks/useNoiseCancellation.ts
import { useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { NoiseCancellation } from "@stream-io/audio-filters-web";
import { useEffect, useState, useCallback } from "react";

export const useNoiseCancellation = () => {
  const call = useCall();
  const { useMicrophoneState } = useCallStateHooks();
  const { mediaStream } = useMicrophoneState();
  
  const [noiseCancellation, setNoiseCancellation] =
    useState<NoiseCancellation | null>(null);
  const [isNoiseCancellationEnabled, setIsNoiseCancellationEnabled] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize noise cancellation
  useEffect(() => {
    let nc: NoiseCancellation | null = null;

    const initNoiseCancellation = async () => {
      console.log("🎤 [Noise Cancellation] Initializing...");
      try {
        setIsLoading(true);
        nc = new NoiseCancellation();
        
        console.log("🎤 [Noise Cancellation] Starting init process...");
        await nc.init();
        
        console.log("✅ [Noise Cancellation] Successfully initialized!");
        console.log("🎤 [Noise Cancellation] Instance:", nc);
        
        setNoiseCancellation(nc);
        setError(null);
      } catch (err) {
        console.error("❌ [Noise Cancellation] Failed to initialize:", err);
        console.error("❌ [Noise Cancellation] Error details:", {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        });
        setError("Failed to initialize noise cancellation");
      } finally {
        setIsLoading(false);
      }
    };

    initNoiseCancellation();

    return () => {
      if (nc) {
        console.log("🧹 [Noise Cancellation] Cleaning up and disposing...");
        nc.dispose();
      }
    };
  }, []);

  // Enable noise cancellation
  const enableNoiseCancellation = useCallback(async () => {
    console.log("🔊 [Noise Cancellation] Enable function called");
    console.log("🔊 [Noise Cancellation] Call available:", !!call);
    console.log("🔊 [Noise Cancellation] NC instance available:", !!noiseCancellation);
    console.log("🔊 [Noise Cancellation] Media stream available:", !!mediaStream);

    if (!call || !noiseCancellation || !mediaStream) {
      console.warn("⚠️ [Noise Cancellation] Cannot enable - missing dependencies:", {
        hasCall: !!call,
        hasNoiseCancellation: !!noiseCancellation,
        hasMediaStream: !!mediaStream
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔊 [Noise Cancellation] Applying filter to audio input...");

      // Register the noise cancellation as an audio processor
      // This modifies the audio stream directly
      await noiseCancellation.enable();

      console.log("✅ [Noise Cancellation] ENABLED successfully!");
      
      setIsNoiseCancellationEnabled(true);
      setError(null);
      
      // Show visual confirmation
      console.log("%c🎉 NOISE CANCELLATION IS NOW ACTIVE! 🎉", "color: green; font-size: 16px; font-weight: bold;");
    } catch (err) {
      console.error("❌ [Noise Cancellation] Failed to enable:", err);
      console.error("❌ [Noise Cancellation] Error details:", {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError("Failed to enable noise cancellation");
    } finally {
      setIsLoading(false);
    }
  }, [call, noiseCancellation, mediaStream]);

  // Disable noise cancellation
  const disableNoiseCancellation = useCallback(async () => {
    console.log("🔇 [Noise Cancellation] Disable function called");
    
    if (!noiseCancellation) {
      console.warn("⚠️ [Noise Cancellation] Cannot disable - NC instance not available");
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔇 [Noise Cancellation] Removing audio filter...");

      // Disable the noise cancellation processor
      noiseCancellation.disable();

      console.log("✅ [Noise Cancellation] DISABLED successfully!");
      
      setIsNoiseCancellationEnabled(false);
      setError(null);
      
      // Show visual confirmation
      console.log("%c🔇 NOISE CANCELLATION IS NOW OFF", "color: orange; font-size: 16px; font-weight: bold;");
    } catch (err) {
      console.error("❌ [Noise Cancellation] Failed to disable:", err);
      console.error("❌ [Noise Cancellation] Error details:", {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError("Failed to disable noise cancellation");
    } finally {
      setIsLoading(false);
    }
  }, [noiseCancellation]);

  // Toggle noise cancellation
  const toggleNoiseCancellation = useCallback(async () => {
    console.log("🔄 [Noise Cancellation] Toggle called, current state:", isNoiseCancellationEnabled);
    
    if (isNoiseCancellationEnabled) {
      await disableNoiseCancellation();
    } else {
      await enableNoiseCancellation();
    }
  }, [
    isNoiseCancellationEnabled,
    enableNoiseCancellation,
    disableNoiseCancellation,
  ]);

  // Log current state whenever it changes
  useEffect(() => {
    console.log("📊 [Noise Cancellation] State Update:", {
      isEnabled: isNoiseCancellationEnabled,
      isLoading,
      hasError: !!error,
      errorMessage: error,
      hasNoiseCancellationInstance: !!noiseCancellation,
      hasCall: !!call,
      hasMediaStream: !!mediaStream
    });
  }, [isNoiseCancellationEnabled, isLoading, error, noiseCancellation, call, mediaStream]);

  return {
    isNoiseCancellationEnabled,
    isLoading,
    error,
    toggleNoiseCancellation,
    enableNoiseCancellation,
    disableNoiseCancellation,
  };
};