

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './Sidebar.js';
import { PlayerList } from './PlayerList.js';
import { ControlBar } from './ControlBar.js';
import { Modal } from './Modal.js';
import { Role, PlayerData } from '../App.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { HamburgerIcon } from './icons/HamburgerIcon.js';
import { world } from '../ipc/Minecraft.js';
import { SignalingService } from '../services/SignalingService.js';
import { AuthSuccessMessage, disconnectMessage, PlayerAudioUpdatePayload, PlayerStatusUpdateBroadcastDataMessage } from '../types/signaling.js';
import { CopyIcon } from './icons/CopyIcon.js';
import { CheckIcon } from './icons/CheckIcon.js';
import { ChatBox, ChatMessage } from './ChatBox.js';

interface ChatRoomProps {
  role: Role;
  currentUser: Player;
  onLeave: () => void;
  signalingService: SignalingService;
  roomCode: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ role, currentUser, onLeave, signalingService, roomCode }) => {
  const [room, setRoom] = useState(() => new Room(currentUser, []));
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<Player | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [audibleRange, setAudibleRange] = useState(48);
  const [spectatorVoice, setSpectatorVoice] = useState(true);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioPositions, setAudioPositions] = useState<PlayerAudioUpdatePayload | null>(null);
  const [peerStatuses, setPeerStatuses] = useState<Map<string, RTCPeerConnectionState>>(new Map());

  // Create and manage the single AudioContext for the application
  useEffect(() => {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(context);
    
    return () => {
      context.close();
    };
  }, []);

  // Update audio output device for the entire context
  useEffect(() => {
    if (audioContext && selectedAudioOutput && (audioContext as any).setSinkId) {
      (audioContext as any).setSinkId(selectedAudioOutput)
        .catch((err: any) => console.error("Failed to set audio context sink", err));
    }
  }, [audioContext, selectedAudioOutput]);


  useEffect(() => {
    // This effect handles both the initial room setup and all subsequent
    // real-time updates from the signaling service.
    const initialSync = async () => {
      // For the owner, we get the initial list of players expected from Minecraft.
      if (role === 'owner') {
          const allPlayerNames = world.getPlayerNames();
          const initialPlayersData = allPlayerNames
            .filter(name => name !== currentUser.name)
            .map(name => ({
              id: Math.random(),
              name,
              isMuted: false,
              isDeafened: false,
              isOwner: false,
              volume: 100,
              isOnline: false, // Default to false until they connect
            }));
          setRoom(new Room(currentUser, initialPlayersData));
      } else {
        // For players, we initially only know about the owner.
        // The owner's name and other players will be synced via data channel.
        const ownerData: PlayerData = {
          id: Math.random(),
          name: "オーナー", // Placeholder name for owner
          isMuted: false,
          isDeafened: false,
          isOwner: true,
          volume: 100,
          isOnline: true,
          signalingId: signalingService.ownerId!,
        };
        setRoom(new Room(currentUser, [ownerData]));
      }
    };
    initialSync();

    const handlePlayerAudioUpdate = (payload: PlayerAudioUpdatePayload) => {
        setAudioPositions(payload);
        if (audioContext && payload.listener) {
            const listener = audioContext.listener;
            const { location, rotation } = payload.listener;

            // Update Listener Position - REFACTORED
            // Use modern API directly for consistency and reliability.
            listener.setPosition(location.x, location.y, location.z);

            // Update Listener Orientation
            // Convert Minecraft's rotation system to the Web Audio API's system.
            // Minecraft Yaw: 0 is South, -90 is East, -180 is North, 90 is West.
            // Web Audio Yaw: Standard counter-clockwise angle where 0 is North (+Z).
            // Minecraft Pitch: -90 is up, 90 is down.
            // Web Audio Pitch: Standard angle where positive is up.
            const yaw = (rotation.y + 180) * (Math.PI / 180); // Convert MC yaw to Web Audio yaw in radians
            const pitch = -rotation.x * (Math.PI / 180);      // Convert MC pitch to Web Audio pitch in radians

            // Calculate forward vector components using spherical to Cartesian conversion
            const fwdX = Math.cos(pitch) * Math.sin(yaw);
            const fwdY = Math.sin(pitch);
            const fwdZ = -Math.cos(pitch) * Math.cos(yaw);
            
            // The 'up' vector is generally fixed at (0, 1, 0) for a Y-up coordinate system.
            const upX = 0;
            const upY = 1;
            const upZ = 0;
            
            // REFACTORED
            // Use modern API directly.
            listener.setOrientation(fwdX, fwdY, fwdZ, upX, upY, upZ);
        }
    };

    // Owner learns about a new player connecting
    const handleAuthSuccess = ({ clientId, playerName }: AuthSuccessMessage['payload']) => {
        setRoom(prevRoom => prevRoom.updatePlayerByAuth(clientId, playerName));
    };

    // Any client's websocket is disconnected.
    const handleDisconnect = ({ clientId }: disconnectMessage['payload']) => {
      console.log('Client disconnected via signaling:', clientId);
      setRoom(prevRoom => prevRoom.setPlayerOnlineStatus(clientId, false));
    };

    const handleStreamAdded = (clientId: string, stream: MediaStream) => {
      setRoom(prevRoom => prevRoom.addStreamToPlayer(clientId, stream));
    };
    
    // WebRTC connection fails, mark as offline.
    const handleStreamRemoved = (clientId: string) => {
      setRoom(prevRoom => prevRoom.removeStreamFromPlayer(clientId));
      setPeerStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.delete(clientId);
          return newStatuses;
      });
    };

    const handleChatMessage = ({ senderName, text }: { senderName: string; text: string }) => {
      // A message received from the service is never from the current user,
      // as the service no longer echoes messages back to the sender.
      // The optimistic update in `handleSendMessage` is the single source of truth for the sender.
      setMessages(prev => [...prev, { senderName, text, isMe: false }]);
    };

    // A player receives the full list of connected peers from the owner.
    const handleRoomState = (players: { id: string, name: string }[]) => {
      setRoom(prevRoom => prevRoom.syncPlayers(players, signalingService.ownerId!));
    };

    // A player learns about a single new peer who joined after them.
    const handleNewPeer = ({id, name}: {id: string, name: string}) => {
       const newPlayerData: PlayerData = {
        id: Math.random(),
        name,
        isMuted: false,
        isDeafened: false,
        isOwner: false,
        volume: 100,
        isOnline: true,
        signalingId: id,
      };
      setRoom(prevRoom => prevRoom.addPlayer(newPlayerData));
    };
    
    const handleError = (error: { message: string }) => {
      alert(`エラー: ${error.message}`);
    };

    const handleRoomClosed = () => {
      // The alert is already shown in SignalingService.
      // This handler just needs to trigger the UI change.
      onLeave();
    };

    const handleGameSettingUpdate = ({ audioRange, spectatorVoice }: { audioRange: number, spectatorVoice: boolean }) => {
        if (role === 'player') {
            setAudibleRange(audioRange);
            setSpectatorVoice(spectatorVoice);
        }
    };

    const handlePlayerStatusUpdate = (payload: PlayerStatusUpdateBroadcastDataMessage['payload']) => {
      setRoom(prevRoom => prevRoom.updatePlayerStatus(payload.clientId, payload.isMuted, payload.isDeafened));
    };
    
    const handlePeerStateChange = ({ peerId, state }: { peerId: string, state: RTCPeerConnectionState }) => {
      setPeerStatuses(prev => {
        const newStatuses = new Map(prev);
        newStatuses.set(peerId, state);
        return newStatuses;
      });
    };

    signalingService.on('auth-success', handleAuthSuccess);
    signalingService.on('disconnect', handleDisconnect);
    signalingService.on('stream-added', handleStreamAdded);
    signalingService.on('stream-removed', handleStreamRemoved);
    signalingService.on('chat-message', handleChatMessage);
    signalingService.on('room-state-received', handleRoomState);
    signalingService.on('new-peer-discovered', handleNewPeer);
    signalingService.on('game-setting-update', handleGameSettingUpdate);
    signalingService.on('player-status-update', handlePlayerStatusUpdate);
    signalingService.on('player-audio-update', handlePlayerAudioUpdate);
    signalingService.on('peer-connection-state-changed', handlePeerStateChange);
    signalingService.on('error', handleError);
    signalingService.on('room-closed', handleRoomClosed);


    return () => {
      signalingService.off('auth-success', handleAuthSuccess);
      signalingService.off('disconnect', handleDisconnect);
      signalingService.off('stream-added', handleStreamAdded);
      signalingService.off('stream-removed', handleStreamRemoved);
      signalingService.off('chat-message', handleChatMessage);
      signalingService.off('room-state-received', handleRoomState);
      signalingService.off('new-peer-discovered', handleNewPeer);
      signalingService.off('game-setting-update', handleGameSettingUpdate);
      signalingService.off('player-status-update', handlePlayerStatusUpdate);
      signalingService.off('player-audio-update', handlePlayerAudioUpdate);
      signalingService.off('peer-connection-state-changed', handlePeerStateChange);
      signalingService.off('error', handleError);
      signalingService.off('room-closed', handleRoomClosed);
    };
  }, [signalingService, currentUser, role, onLeave, audioContext]);
  
  // Effect for handling Minecraft world events (owner only)
  useEffect(() => {
    if (role !== 'owner') return;

    const handlePlayerJoin = ({ playerName }: { playerName: string }) => {
        console.log(`[ChatRoom] Player joined Minecraft: ${playerName}`);
        world.addPlayer(playerName);
        const newPlayerCode = world.generateAndAssignCode(playerName);
        
        if (roomCode && newPlayerCode) {
            world.notifyPlayerWithCode(playerName, roomCode);
        }

        const newPlayerData: PlayerData = {
            id: Math.random(),
            name: playerName,
            isMuted: false,
            isDeafened: false,
            isOwner: false,
            volume: 100,
            isOnline: false, // Player joins the game, not the voice chat yet.
            playerCode: newPlayerCode
        };

        setRoom(prevRoom => prevRoom.addPlayer(newPlayerData));
        setMessages(prev => [...prev, { senderName: 'システム', text: `${playerName}さんがゲームに参加しました。`, isMe: false }]);
    };
    
    const handlePlayerLeave = ({ playerName }: { playerName: string }) => {
        console.log(`[ChatRoom] Player left Minecraft: ${playerName}`);
        
        const player = room.allPlayers.find(p => p.name === playerName);
        if (player && player.isOnline && player.signalingId) {
            console.log(`Player ${playerName} was online, disconnecting them.`);
            signalingService.disconnectClient(player.signalingId);
        }

        world.removePlayer(playerName);
        setRoom(prevRoom => prevRoom.removePlayerByName(playerName));
        setMessages(prev => [...prev, { senderName: 'システム', text: `${playerName}さんがゲームから退出しました。`, isMe: false }]);
    };

    world.events.on('playerJoin', handlePlayerJoin);
    world.events.on('playerLeave', handlePlayerLeave);

    return () => {
        world.events.removeListener('playerJoin', handlePlayerJoin);
        world.events.removeListener('playerLeave', handlePlayerLeave);
    };
  }, [role, signalingService, roomCode, room]);

  // Effect for Owner to broadcast setting changes
  useEffect(() => {
    if (role === 'owner' && signalingService) {
        signalingService.broadcastGameSettings({
            audioRange: audibleRange,
            spectatorVoice: spectatorVoice,
        });
    }
  }, [audibleRange, spectatorVoice, role, signalingService]);

  // Effect to broadcast the current user's mute/deafen status
  useEffect(() => {
    if (signalingService) {
      signalingService.sendPlayerStatus(isMuted, isDeafened);
    }
  }, [isMuted, isDeafened, signalingService]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const inputs = devices.filter(device => device.kind === 'audioinput');
        setAudioInputDevices(inputs);
        if (inputs.length > 0 && !selectedAudioInput) setSelectedAudioInput(inputs[0].deviceId);

        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioOutputDevices(outputs);
        if (outputs.length > 0 && !selectedAudioOutput) setSelectedAudioOutput(outputs[0].deviceId);
      } catch (err) {
        console.error("Could not get audio devices:", err);
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, [selectedAudioInput, selectedAudioOutput]);

  useEffect(() => {
    if (signalingService) {
      signalingService.setMute(isMuted);
    }
  }, [isMuted, signalingService]);

  const handleAudioInputChange = useCallback((deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (signalingService) {
      signalingService.updateLocalStream(deviceId, isMuted);
    }
  }, [signalingService, isMuted]);

  const handleVolumeChange = (player: Player, volume: number) => {
    player.setVolume(volume);
    setRoom(room.clone());
  };

  const handleInitiateKick = (player: Player) => {
    if (role === 'owner' && player.isOnline && player.signalingId) {
      setPlayerToKick(player);
    }
  };

  const handleConfirmKick = () => {
    if (playerToKick && playerToKick.signalingId) {
      signalingService.disconnectClient(playerToKick.signalingId);
      setRoom(room.setPlayerOnlineStatus(playerToKick.signalingId, false));
    }
    setPlayerToKick(null);
  };

  const handleSendMessage = (text: string) => {
    signalingService.sendChatMessage(text);
    // Optimistically update the UI for the sender.
    setMessages(prev => [...prev, { senderName: currentUser.name, text, isMe: true }]);
  };

  const handleCancelKick = () => setPlayerToKick(null);
  const handleInitiateLeave = () => setIsLeaveModalOpen(true);
  const handleConfirmLeave = () => {
    setIsLeaveModalOpen(false);
    onLeave();
  };
  const handleCancelLeave = () => setIsLeaveModalOpen(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const onlinePlayerCount = useMemo(() => room.otherPlayers.filter(p => p.isOnline).length + 1, [room]);


  return (
    <div className="min-h-screen bg-[#313233] text-[#E0E0E0] flex flex-col selection:bg-[#58A445] selection:text-white">
      <div className="flex flex-grow overflow-hidden">
        <div className={`fixed md:relative top-0 left-0 h-full md:h-auto z-40 transition-transform transform ease-in-out duration-300 md:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar
            role={role}
            onClose={() => setIsSidebarOpen(false)}
            audibleRange={audibleRange} onAudibleRangeChange={setAudibleRange}
            spectatorVoice={spectatorVoice} onSpectatorVoiceChange={setSpectatorVoice}
            audioInputDevices={audioInputDevices} selectedAudioInput={selectedAudioInput} onAudioInputChange={handleAudioInputChange}
            audioOutputDevices={audioOutputDevices} selectedAudioOutput={selectedAudioOutput} onAudioOutputChange={setSelectedAudioOutput}
          /> 
        </div>

        {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true"></div>}

        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-hidden">
          <div className="md:hidden mb-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-[#A9A9A9] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]" aria-label="設定メニューを開く">
              <HamburgerIcon className="w-6 h-6 text-[#212121]" /> 
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl text-white">参加者 ({onlinePlayerCount})</h2>
            {role === 'owner' && roomCode && (
              <div className="flex items-center gap-2 bg-[#212121] p-2 border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454]">
                <span className="text-sm text-[#A9A9A9]">ルームコード:</span>
                <code className="text-lg text-white">{roomCode}</code>
                <button onClick={handleCopyCode} className="p-1 bg-[#A9A9A9] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB]">
                  {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4 text-[#212121]" />}
                </button>
              </div>
            )}
          </div>
          <div className="flex-grow overflow-y-auto mb-4">
            <PlayerList 
              room={room}
              currentRole={role}
              onKick={handleInitiateKick}
              onVolumeChange={handleVolumeChange}
              selectedAudioOutput={selectedAudioOutput}
              isDeafened={isDeafened}
              audioContext={audioContext}
              audioPositions={audioPositions}
              audibleRange={audibleRange}
              peerStatuses={peerStatuses}
            />
          </div>
          <div className="flex-shrink-0">
            <ChatBox messages={messages} onSendMessage={handleSendMessage} />
          </div>
        </main>
      </div>
      <ControlBar
        currentUser={currentUser} isMuted={isMuted} isDeafened={isDeafened}
        onMuteToggle={() => setIsMuted(prev => !prev)}
        onDeafenToggle={() => setIsDeafened(prev => !prev)}
        onLeave={handleInitiateLeave}
      />
      <Modal isOpen={!!playerToKick} onClose={handleCancelKick}>
        {playerToKick && (
          <div className="text-center p-4">
            <h2 className="text-2xl text-[#E0E0E0] mb-4">プレイヤーをキック</h2>
            <p className="text-[#A9A9A9] mb-8">本当に <strong>{playerToKick.name}</strong> さんをルームからキックしますか？</p>
            <div className="flex justify-center gap-6">
              <button onClick={handleCancelKick} className="w-40 bg-[#A9A9A9] text-[#212121] text-lg py-2 px-4 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]">キャンセル</button>
              <button onClick={handleConfirmKick} className="w-40 bg-[#b83939] text-white text-lg py-2 px-4 border-2 border-t-[#d67373] border-l-[#d67373] border-b-[#8a2c2c] border-r-[#8a2c2c] hover:bg-[#c94343] active:bg-[#b83939] active:border-t-[#8a2c2c] active:border-l-[#8a2c2c] active:border-b-[#d67373] active:border-r-[#d67373]" aria-label={`${playerToKick.name}のキックを確定`}>キックする</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={handleCancelLeave}>
        <div className="text-center p-4">
          <h2 className="text-2xl text-[#E0E0E0] mb-4">ルームから退出</h2>
          <p className="text-[#A9A9A9] mb-8">本当にこのルームから退出しますか？</p>
          <div className="flex justify-center gap-6">
            <button onClick={handleCancelLeave} className="w-40 bg-[#A9A9A9] text-[#212121] text-lg py-2 px-4 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]">キャンセル</button>
            <button onClick={handleConfirmLeave} className="w-40 bg-[#b83939] text-white text-lg py-2 px-4 border-2 border-t-[#d67373] border-l-[#d67373] border-b-[#8a2c2c] border-r-[#8a2c2c] hover:bg-[#c94343] active:bg-[#b83939] active:border-t-[#8a2c2c] active:border-l-[#8a2c2c] active:border-b-[#d67373] active:border-r-[#d67373]" aria-label="ルームからの退出を確定">退出する</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};