
import React, { useEffect, useRef } from 'react';
import { Role } from '../App.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { CrownIcon } from './icons/CrownIcon.js';
import { KickIcon } from './icons/KickIcon.js';
import { MicIcon } from './icons/MicIcon.js';
import { VolumeIcon } from './icons/VolumeIcon.js';
import { HeadphonesIcon } from './icons/HeadphonesIcon.js';
import type { Location, Rotation } from '../types/signaling.js';

interface PlayerListProps {
  room: Room;
  currentRole: Role;
  currentUserSignalingId?: string;
  onKick: (player: Player) => void;
  onVolumeChange: (player: Player, volume: number) => void;
  selectedAudioOutput: string;
  isDeafened: boolean;
  playerPositions: Map<string, { position: Location; rotation: Rotation }>;
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
                <div className="flex items-center gap-2 flex-shrink-0">
                    <MicIcon className={`w-6 h-6 ${player.isMuted ? 'text-red-500' : 'text-gray-400'}`} muted={player.isMuted}/>
                    <HeadphonesIcon className={`w-6 h-6 ${player.isDeafened ? 'text-red-500' : 'text-gray-400'}`} muted={player.isDeafened}/>
                </div>
                {canKick && (
                    <button 
                      onClick={onKick} 
                      className={`text-gray-400 ${isOffline ? '' : 'hover:text-red-500'} disabled:cursor-not-allowed disabled:text-gray-600`} 
                      aria-label={`${player.name}をキック`}
                      disabled={isOffline || player.isOwner}
                    >
                        <KickIcon className="w-5 h-5 flex-shrink-0"/>
                    </button>
                )}
            </div>
        </div>
    );
}

export const PlayerList: React.FC<PlayerListProps> = ({
  room,
  currentRole,
  currentUserSignalingId,
  onKick,
  onVolumeChange,
  selectedAudioOutput,
  isDeafened,
  playerPositions,
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<Map<string, { source: MediaStreamAudioSourceNode; panner: PannerNode; gain: GainNode }>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        const masterGain = context.createGain();
        masterGain.connect(context.destination);
        masterGainRef.current = masterGain;
    }

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      audioNodesRef.current.forEach(({ source, panner, gain }) => {
        try {
            source?.disconnect();
            panner?.disconnect();
            gain?.disconnect();
        } catch(e) { /* ignore cleanup errors */ }
      });
      audioNodesRef.current.clear();
    };
  }, []);
  
  // Handle output device changes
  useEffect(() => {
    const audioContext = audioContextRef.current;
    if (audioContext && selectedAudioOutput && typeof (audioContext as any).setSinkId === 'function') {
        (audioContext as any).setSinkId(selectedAudioOutput)
            .catch((err: any) => console.error("Error setting sink ID for AudioContext:", err));
    }
  }, [selectedAudioOutput]);

  // Handle master gain (deafen)
  useEffect(() => {
      if(masterGainRef.current && audioContextRef.current) {
          masterGainRef.current.gain.setValueAtTime(isDeafened ? 0 : 1, audioContextRef.current.currentTime);
      }
  }, [isDeafened]);

  // Effect to manage audio nodes based on players with streams
  useEffect(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || !masterGainRef.current) return;
    
    const currentNodes = audioNodesRef.current;
    const playersWithStreams = new Set(room.otherPlayers.filter(p => p.stream && p.signalingId).map(p => p.signalingId!));

    // Add new players' audio nodes
    playersWithStreams.forEach(signalingId => {
      if (!currentNodes.has(signalingId)) {
        const player = room.getPlayerBySignalingId(signalingId);
        if (player?.stream) {
          try {
            const source = audioContext.createMediaStreamSource(player.stream);
            const panner = new PannerNode(audioContext, {
              panningModel: 'HRTF',
              distanceModel: 'inverse',
              refDistance: 1,
              maxDistance: 10000,
              rolloffFactor: 1,
              coneInnerAngle: 360,
              coneOuterAngle: 360,
              coneOuterGain: 0,
            });
            const gain = audioContext.createGain();
            
            source.connect(panner).connect(gain).connect(masterGainRef.current!);
            currentNodes.set(signalingId, { source, panner, gain });
          } catch (e) {
            console.error(`Error creating audio node for ${player.name}:`, e);
          }
        }
      }
    });

    // Remove old players' audio nodes
    currentNodes.forEach((nodes, signalingId) => {
      if (!playersWithStreams.has(signalingId)) {
        nodes.source.disconnect();
        nodes.panner.disconnect();
        nodes.gain.disconnect();
        currentNodes.delete(signalingId);
      }
    });

  }, [room]);

  // Effect to update positions and volumes
  useEffect(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state === 'suspended') {
      audioContext?.resume().catch(console.error);
    }
    if (!audioContext || playerPositions.size === 0 || audioContext.state !== 'running') return;

    // Update listener position and orientation
    const listenerData = currentUserSignalingId ? playerPositions.get(currentUserSignalingId) : undefined;
    if (listenerData) {
      const { position, rotation } = listenerData;
      const { listener } = audioContext;

      // New API for setting position
      if (listener.positionX) {
        listener.positionX.setValueAtTime(position.x, audioContext.currentTime);
        listener.positionY.setValueAtTime(position.y, audioContext.currentTime);
        listener.positionZ.setValueAtTime(position.z, audioContext.currentTime);
      } else { // Fallback for older browsers
        (listener as any).setPosition(position.x, position.y, position.z);
      }
      
      const yaw = rotation.y * (Math.PI / 180); // To radians
      const pitch = rotation.x * (Math.PI / 180); // To radians
      
      const fwdX = Math.sin(yaw) * Math.cos(pitch);
      const fwdY = -Math.sin(pitch);
      const fwdZ = -Math.cos(yaw) * Math.cos(pitch);

      const upX = Math.sin(yaw) * Math.sin(pitch);
      const upY = Math.cos(pitch);
      const upZ = -Math.cos(yaw) * Math.sin(pitch);
      
      // New API for setting orientation
      if (listener.forwardX) {
        listener.forwardX.setValueAtTime(fwdX, audioContext.currentTime);
        listener.forwardY.setValueAtTime(fwdY, audioContext.currentTime);
        listener.forwardZ.setValueAtTime(fwdZ, audioContext.currentTime);
        listener.upX.setValueAtTime(upX, audioContext.currentTime);
        listener.upY.setValueAtTime(upY, audioContext.currentTime);
        listener.upZ.setValueAtTime(upZ, audioContext.currentTime);
      } else { // Fallback for older browsers
        (listener as any).setOrientation(fwdX, fwdY, fwdZ, upX, upY, upZ);
      }
    }

    // Update player (panner) positions and volumes
    playerPositions.forEach(({ position }, signalingId) => {
        if (signalingId !== currentUserSignalingId) {
            const nodes = audioNodesRef.current.get(signalingId);
            const player = room.getPlayerBySignalingId(signalingId);
            if (nodes && player) {
                nodes.panner.positionX.setValueAtTime(position.x, audioContext.currentTime);
                nodes.panner.positionY.setValueAtTime(position.y, audioContext.currentTime);
                nodes.panner.positionZ.setValueAtTime(position.z, audioContext.currentTime);
                // Volume from player is 0-150. We map it to a gain value (100 -> 1.0).
                nodes.gain.gain.setValueAtTime(player.volume / 100, audioContext.currentTime);
            }
        }
    });

  }, [playerPositions, currentUserSignalingId, room]);
  
  return (
    <div className="space-y-3">
      {room.otherPlayers.map(player => (
        <PlayerItem 
          key={player.id}
          player={player}
          canKick={currentRole === 'owner'}
          onKick={() => onKick(player)}
          onVolumeChange={(volume) => onVolumeChange(player, volume)}
        />
      ))}
    </div>
  );
};
