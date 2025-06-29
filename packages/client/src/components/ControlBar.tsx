import React from 'react';
import { MicIcon } from './icons/MicIcon.js';
import { HeadphonesIcon } from './icons/HeadphonesIcon.js';
import { LeaveIcon } from './icons/LeaveIcon.js';
import type { Player } from '../models/Player.js';

interface ControlBarProps {
  currentUser: Player;
  isMuted: boolean;
  isDeafened: boolean;
  onMuteToggle: () => void;
  onDeafenToggle: () => void;
  onLeave: () => void;
}

const ControlButton: React.FC<{onClick: () => void, children: React.ReactNode, active?: boolean, variant?: 'default' | 'danger', 'aria-label': string}> = ({onClick, children, active, variant = 'default', 'aria-label': ariaLabel}) => {
    const baseClasses = "w-16 h-16 flex items-center justify-center border-2 text-white transition-all duration-100";
    const colorClasses = variant === 'danger'
        ? "bg-[#b83939] border-t-[#d67373] border-l-[#d67373] border-b-[#8a2c2c] border-r-[#8a2c2c] hover:bg-[#c94343] active:bg-[#b83939] active:border-t-[#8a2c2c] active:border-l-[#8a2c2c] active:border-b-[#d67373] active:border-r-[#d67373]"
        : "bg-[#A9A9A9] border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]";
    
    const activeClasses = active
        ? "bg-[#8a8a8a] !border-t-[#5A5A5A] !border-l-[#5A5A5A] !border-b-[#FFFFFF] !border-r-[#FFFFFF]"
        : "";
    
    return (
        <button onClick={onClick} className={`${baseClasses} ${colorClasses} ${activeClasses}`} aria-label={ariaLabel}>
            {children}
        </button>
    )
}

export const ControlBar: React.FC<ControlBarProps> = ({ currentUser, isMuted, isDeafened, onMuteToggle, onDeafenToggle, onLeave }) => {
  return (
    <footer className="bg-[#3C3C3C] border-t-4 border-[#272727] p-4 px-6 md:px-8 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-[#545454] border-2 border-t-[#777] border-l-[#777] border-b-[#222] border-r-[#222] flex-shrink-0">
            {/* Avatar Placeholder */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#3C3C3C] ${currentUser.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{currentUser.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
            <ControlButton onClick={onMuteToggle} active={isMuted} aria-label={isMuted ? 'ミュート解除' : 'ミュート'}>
                <MicIcon className="w-8 h-8" muted={isMuted} />
            </ControlButton>
            <ControlButton onClick={onDeafenToggle} active={isDeafened} aria-label={isDeafened ? 'スピーカーミュート解除' : 'スピーカーミュート'}>
                <HeadphonesIcon className="w-8 h-8" muted={isDeafened} />
            </ControlButton>
            <ControlButton onClick={onLeave} variant="danger" aria-label="ルームから退出">
                <LeaveIcon className="w-8 h-8" />
            </ControlButton>
        </div>
    </footer>
  );
};