import React from 'react';
import { Role } from '../App.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { CrownIcon } from './icons/CrownIcon.js';
import { KickIcon } from './icons/KickIcon.js';
import { MicIcon } from './icons/MicIcon.js';
import { VolumeIcon } from './icons/VolumeIcon.js';

interface PlayerListProps {
  room: Room;
  currentRole: Role;
  onKick: (player: Player) => void;
  onVolumeChange: (player: Player, volume: number) => void;
}

const PlayerItem: React.FC<{
  player: Player;
  canKick: boolean;
  onKick: () => void;
  onVolumeChange: (volume: number) => void;
}> = ({ player, canKick, onKick, onVolumeChange }) => {
    const isOffline = !player.isOnline;
    
    return (
        <div className={`flex flex-col bg-[#3C3C3C] p-3 gap-3 border-2 border-t-[#545454] border-l-[#545454] border-b-[#272727] border-r-[#272727] transition-opacity ${isOffline ? 'opacity-50' : ''}`}>
            {/* Top Row: Name and Owner Icon */}
            <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 border-2 border-black ${player.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <div className="w-6 mr-2 flex-shrink-0">
                    {player.isOwner && <CrownIcon className="w-6 h-6 text-yellow-400"/>}
                </div>
                <span className="text-lg text-white flex-grow truncate min-w-0">{player.name}</span>
            </div>
            
            {/* Bottom Row: Controls */}
            <div className="flex items-center gap-3 md:gap-4">
                <VolumeIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <input
                    type="range"
                    min="0"
                    max="150"
                    value={player.volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    className="flex-grow w-full"
                    aria-label={`${player.name}の音量`}
                    disabled={isOffline}
                />
                <MicIcon className={`w-6 h-6 flex-shrink-0 ${player.isMuted ? 'text-red-500' : 'text-gray-400'}`} muted={player.isMuted}/>
                {canKick && (
                    <button 
                      onClick={onKick} 
                      className={`text-gray-400 ${isOffline ? '' : 'hover:text-red-500'} disabled:cursor-not-allowed disabled:text-gray-600`} 
                      aria-label={`${player.name}をキック`}
                      disabled={isOffline}
                    >
                        <KickIcon className="w-5 h-5 flex-shrink-0"/>
                    </button>
                )}
            </div>
        </div>
    );
}

export const PlayerList: React.FC<PlayerListProps> = ({ room, currentRole, onKick, onVolumeChange }) => {
  return (
    <div className="space-y-3">
      {room.otherPlayers.map(player => (
        <PlayerItem 
            key={player.id}
            player={player}
            canKick={currentRole === 'owner' && !player.isOwner}
            onKick={() => onKick(player)}
            onVolumeChange={(volume) => onVolumeChange(player, volume)}
        />
      ))}
    </div>
  );
};