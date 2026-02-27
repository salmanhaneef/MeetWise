'use client';

import { useNoiseCancellation } from '@/hooks/useNoiseCancellation';
import { Loader2 } from 'lucide-react';

const NoiseCancellationButton = () => {
  const {
    isNoiseCancellationEnabled,
    isLoading,
    error,
    toggleNoiseCancellation,
  } = useNoiseCancellation();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggleNoiseCancellation}
        disabled={isLoading}
        className={`relative flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
          isNoiseCancellationEnabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-600 hover:bg-gray-700 text-white'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isNoiseCancellationEnabled ? 'Disable Noise Cancellation' : 'Enable Noise Cancellation'}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isNoiseCancellationEnabled ? (
              <>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <polyline points="8 2 12 6 16 2" />
              </>
            ) : (
              <>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </>
            )}
          </svg>
        )}
        <span>
          {isNoiseCancellationEnabled ? 'NC On' : 'NC Off'}
        </span>
      </button>
      
      {error && (
        <span className="text-xs text-red-500 max-w-[150px] text-center">
          {error}
        </span>
      )}
    </div>
  );
};

export default NoiseCancellationButton;