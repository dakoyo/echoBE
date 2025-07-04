
import React, { useEffect, useRef, useState } from 'react';
import { Role } from '../App.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { CrownIcon } from './icons/CrownIcon.js';
import { KickIcon } from './icons/KickIcon.js';
import { MicIcon } from './icons/MicIcon.js';
import { VolumeIcon } from './icons/VolumeIcon.js';
import { HeadphonesIcon } from './icons/HeadphonesIcon.js';
import { Location, PlayerAudioUpdatePayload } from '../types/signaling.js';

interface PlayerListProps {
  room: Room;
  currentRole: Role;
  onKick: (player: Player) => void;
  onVolumeChange: (player: Player, volume: number) => void;
  selectedAudioOutput: string;
  isDeafened: boolean;
  audioContext: AudioContext | null;
  audioPositions: PlayerAudioUpdatePayload | null;
  audibleRange: number;
}

const PlayerItem: React.FC<{
  player: Player;
  canKick: boolean;
  onKick: () => void;
  onVolumeChange: (volume: number) => void;
  isSpeaking: boolean;
}> = ({ player, canKick, onKick, onVolumeChange, isSpeaking }) => {
    const isOffline = !player.isOnline;
    const speakingClasses = isSpeaking ? 'ring-2 ring-green-400' : '';
    
    return (
        <div className={`flex flex-col bg-[#3C3C3C] p-3 gap-3 border-2 border-t-[#545454] border-l-[#545454] border-b-[#272727] border-r-[#272727] transition-all duration-200 ${isOffline ? 'opacity-50' : ''} ${speakingClasses}`}>
            {/* Top Row: Name and Owner Icon */}
            <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 border-2 border-black ${player.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <div className="w-6 mr-2 flex-shrink-0">
                    {player.isOwner && <CrownIcon className="w-6 h-6 text-yellow-400"/>}
                </div>
                <span className="text-lg text-white flex-grow truncate min-w-0">{player.name}</span>
            </div>
            
            {/* Bottom Row: Controls */}
            <div className="flex items-center gap-2 md:gap-3">
                <VolumeIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <input
                    type="range"
                    min="0"
                    max="200"
                    value={player.volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    className="flex-grow w-full"
                    aria-label={`${player.name}の音量`}
                    disabled={isOffline}
                />
                <span className={`text-sm font-mono w-12 text-right ${isOffline ? 'text-gray-400' : 'text-white'}`}>{player.volume}%</span>
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

const PlayerAudio: React.FC<{ 
  stream: MediaStream; 
  outputId: string;
  volume: number;
  isDeafened: boolean;
  audioContext: AudioContext | null;
  sourceLocation?: Location;
  onSpeakingChange: (isSpeaking: boolean) => void;
  audibleRange: number;
}> = ({ stream, outputId, volume, isDeafened, audioContext, sourceLocation, onSpeakingChange, audibleRange }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pannerNodeRef = useRef<PannerNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const isSetup = useRef(false);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  useEffect(() => {
    onSpeakingChangeRef.current = onSpeakingChange;
  });

  useEffect(() => {
    if (!audioContext || !stream || isSetup.current) return;

    const source = audioContext.createMediaStreamSource(stream);
    const panner = audioContext.createPanner();
    const gain = audioContext.createGain();
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 0;

    source.connect(analyser).connect(panner).connect(gain).connect(audioContext.destination);

    sourceNodeRef.current = source;
    pannerNodeRef.current = panner;
    gainNodeRef.current = gain;
    analyserNodeRef.current = analyser;
    isSetup.current = true;
    
    // The audio element is needed as a fallback for setSinkId on older browsers
    // We play it but keep it muted, as the sound comes from the Web Audio API graph.
    if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(e => console.warn("Audio play failed, user may need to interact.", e));
        audioRef.current.muted = true;
    }

    return () => {
        source?.disconnect();
        analyser?.disconnect();
        panner?.disconnect();
        gain?.disconnect();
        isSetup.current = false;
        sourceNodeRef.current = null;
        pannerNodeRef.current = null;
        gainNodeRef.current = null;
        analyserNodeRef.current = null;
    }
  }, [audioContext, stream]);

  useEffect(() => {
      if (!audioContext || !pannerNodeRef.current || !gainNodeRef.current) return;
      
      const panner = pannerNodeRef.current;
      const gain = gainNodeRef.current;

      const targetGain = isDeafened ? 0 : volume / 100;
      gain.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.01);

      // We want volume to be ~5% at the edge of the audibleRange.
      // This is achieved by tuning the rolloffFactor of the inverse distance model.
      // rolloffFactor = 19 / (audibleRange - 1)
      const safeAudibleRange = Math.max(1.1, audibleRange);
      panner.rolloffFactor = 19 / (safeAudibleRange - 1);

      if (sourceLocation) {
          panner.setPosition(sourceLocation.x, sourceLocation.y, sourceLocation.z);
      }
  }, [audioContext, isDeafened, volume, sourceLocation, audibleRange]);

  useEffect(() => {
    if (!analyserNodeRef.current || isDeafened) {
        return;
    }

    const analyser = analyserNodeRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeaking = false;
    let lastSpokeTime = 0;
    let animationFrameId: number;
    
    const speakingThreshold = 20; // Heuristic value
    const silenceDelay = 300; // ms

    const checkSpeaking = () => {
        if (!analyserNodeRef.current) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        
        if (average > speakingThreshold) {
            lastSpokeTime = Date.now();
            if (!isSpeaking) {
                isSpeaking = true;
                onSpeakingChangeRef.current(true);
            }
        } else {
            if (isSpeaking && (Date.now() - lastSpokeTime) > silenceDelay) {
                isSpeaking = false;
                onSpeakingChangeRef.current(false);
            }
        }
        animationFrameId = requestAnimationFrame(checkSpeaking);
    };
    
    checkSpeaking();
    
    return () => {
        cancelAnimationFrame(animationFrameId);
        if (isSpeaking) {
            onSpeakingChangeRef.current(false);
        }
    };

  }, [analyserNodeRef, isDeafened]);

  useEffect(() => {
    // Fallback for browsers that don't support audioContext.setSinkId
    if (audioRef.current && outputId && typeof (audioRef.current as any).setSinkId === 'function') {
      (audioRef.current as any).setSinkId(outputId)
        .catch((err: any) => {
          console.warn('Error setting sink ID on audio element:', err);
        });
    }
  }, [outputId]);

  return <audio ref={audioRef} playsInline muted style={{ display: 'none' }} />;
};

export const PlayerList: React.FC<PlayerListProps> = ({ room, currentRole, onKick, onVolumeChange, selectedAudioOutput, isDeafened, audioContext, audioPositions, audibleRange }) => {
  const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-3">
      {room.otherPlayers.map(player => {
        const sourceData = audioPositions?.sources.find(s => s.name === player.name);
        
        let isAudibleForGlow = false;
        if (audioPositions?.listener?.location && sourceData?.location) {
          const listenerPos = audioPositions.listener.location;
          const sourcePos = sourceData.location;
          const distance = Math.sqrt(
              Math.pow(sourcePos.x - listenerPos.x, 2) +
              Math.pow(sourcePos.y - listenerPos.y, 2) +
              Math.pow(sourcePos.z - listenerPos.z, 2)
          );
          isAudibleForGlow = distance <= audibleRange;
        }

        const isSpeaking = speakingPlayers.has(player.name);

        return (
            <React.Fragment key={player.id}>
                <PlayerItem 
                    player={player}
                    canKick={currentRole === 'owner'}
                    onKick={() => onKick(player)}
                    onVolumeChange={(volume) => onVolumeChange(player, volume)}
                    isSpeaking={isSpeaking && isAudibleForGlow}
                />
                {player.stream && audioContext && (
                  <PlayerAudio
                    stream={player.stream} 
                    outputId={selectedAudioOutput} 
                    volume={player.volume}
                    isDeafened={isDeafened}
                    audioContext={audioContext}
                    sourceLocation={sourceData?.location}
                    onSpeakingChange={(speaking) => {
                        setSpeakingPlayers(prev => {
                            const isCurrentlySpeaking = prev.has(player.name);
                            if (isCurrentlySpeaking === speaking) {
                                return prev;
                            }
                            const newSet = new Set(prev);
                            if (speaking) {
                                newSet.add(player.name);
                            } else {
                                newSet.delete(player.name);
                            }
                            return newSet;
                        })
                    }}
                    audibleRange={audibleRange}
                  />
                )}
            </React.Fragment>
        );
      })}
    </div>
  );
};
