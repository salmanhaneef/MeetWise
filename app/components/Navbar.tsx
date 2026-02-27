'use client';

import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Menu, Plus, UserPlus, Clock, Sparkles } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
  onCreateMeeting: () => void;
  onInviteParticipant: () => void;
  hasSelectedMeeting?: boolean;
}

export default function Navbar({ 
  onMenuClick, 
  onCreateMeeting, 
  onInviteParticipant,
  hasSelectedMeeting = false,
}: NavbarProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const dateString = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      setCurrentTime(`${dateString} • ${timeString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav 
      className={`sticky top-0 z-50 w-full transition-all duration-500 ease-out ${
        isScrolled 
          ? 'bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-blue-900/20 border-b border-blue-800/50' 
          : 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-blue-900/30'
      }`}
    >
      {/* Container - Full width on mobile/medium, constrained on large screens */}
      <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 md:px-6 lg:px-8 lg:max-w-[1920px] lg:mx-auto w-full">
        
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Button - Enhanced for touch */}
          <button
            onClick={onMenuClick}
            className="lg:hidden group relative p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
            aria-label="Toggle menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-180 transition-transform duration-500" />
          </button>

          {/* Time Display - Hidden on small mobile, compact on medium */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-blue-950/50 border border-blue-800/50 shadow-inner backdrop-blur-sm">
            <div className="relative">
              <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-400 animate-pulse" />
              <div className="absolute inset-0 bg-blue-400/30 rounded-full blur-sm animate-ping" />
            </div>
            <span className="text-xs lg:text-sm font-semibold text-blue-100">
              {currentTime}
            </span>
          </div>
        </div>

        {/* Right Section - Responsive gap and button sizes */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          {/* Create Meeting - Responsive sizing */}
          <button
            onClick={onCreateMeeting}
            className="group relative flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 text-white px-2.5 sm:px-4 py-2 sm:py-2.5 lg:px-5 rounded-lg sm:rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-xs sm:text-sm font-semibold overflow-hidden whitespace-nowrap"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:rotate-90 transition-transform duration-300" />
            <span className="hidden sm:inline relative z-10">Create Meeting</span>
            <span className="sm:hidden relative z-10">Create</span>
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-bounce hidden sm:block" />
          </button>

          {/* Invite Participant - Responsive sizing */}
          <button
            onClick={onInviteParticipant}
            disabled={!hasSelectedMeeting}
            title={!hasSelectedMeeting ? "Select a meeting first" : "Invite participants"}
            className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 lg:px-5 rounded-lg sm:rounded-xl transition-all duration-300 text-xs sm:text-sm font-semibold overflow-hidden whitespace-nowrap ${
              hasSelectedMeeting
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {hasSelectedMeeting && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            )}
            <UserPlus className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${hasSelectedMeeting ? 'group-hover:scale-110' : ''}`} />
            <span className="hidden sm:inline relative z-10">Invite</span>
            <span className="sm:hidden relative z-10">Invite</span>
          </button>

          {/* User Button - Responsive sizing */}
          <div className="ml-1 sm:ml-2 p-0.5 sm:p-1 rounded-full bg-gradient-to-br from-blue-600/30 to-indigo-600/30 hover:from-blue-500/50 hover:to-indigo-500/50 transition-all duration-300 hover:scale-105 border border-blue-700/50">
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 ring-2 ring-blue-950 shadow-lg hover:ring-blue-400 transition-all duration-300"
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Time Display - Compact version */}
      <div className="md:hidden px-3 pb-2 sm:pb-3">
        <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-blue-200/80 bg-blue-950/30 py-1.5 sm:py-2 rounded-lg border border-blue-800/30">
          <Clock className="w-3 h-3 text-blue-400" />
          <span className="font-medium truncate">{currentTime}</span>
        </div>
      </div>
    </nav>
  );
}