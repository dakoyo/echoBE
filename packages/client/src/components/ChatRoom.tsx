
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
import { AuthSuccessMessage, disconnectMessage, PlayerStatusUpdateBroadcastDataMessage, Location, Rotation } from '../types/signaling.js';
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
  const [playerPositions, setPlayerPositions] = useState<Map<string, { position: Location; rotation: Rotation }>>(new Map());

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
        // The rest of the players will be discovered via data channel messages.
        const ownerName = await world.getOwnerName();
        const ownerData: PlayerData = {
          id: Math.random(),
          name: ownerName,
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
    };

    const handleChatMessage = ({ senderName, text }: { senderName: string; text: string }) => {
      // A message received from the service is never from the current user,
      // as the service no longer echoes messages back to the sender.
      // The optimistic update in `handleSendMessage` is the single source of truth for the sender.
      setMessages(prev => [...prev, { senderName, text, isMe: false }]);
    };

    // A player receives the full list of connected peers from the owner.
    const handleRoomState = (players: {id: string, name: string}[]) => {
      const newPlayersData: PlayerData[] = players.map(p => ({
        id: Math.random(),
        name: p.name,
        isMuted: false,
        isDeafened: false,
        isOwner: false,
        volume: 100,
        isOnline: true,
        signalingId: p.id,
      }));
      setRoom(prevRoom => prevRoom.addPlayers(newPlayersData));
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
    
    const handlePositionsUpdate = (players: { clientId: string; position: Location; rotation: Rotation }[]) => {
        setPlayerPositions(new Map(players.map(p => [p.clientId, { position: p.position, rotation: p.rotation }])));
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
    signalingService.on('player-positions-update', handlePositionsUpdate);
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
      signalingService.off('player-positions-update', handlePositionsUpdate);
      signalingService.off('error', handleError);
      signalingService.off('room-closed', handleRoomClosed);
    };
  }, [signalingService, currentUser, role, onLeave]);

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
              currentUserSignalingId={currentUser.signalingId}
              onKick={handleInitiateKick}
              onVolumeChange={handleVolumeChange}
              selectedAudioOutput={selectedAudioOutput}
              isDeafened={isDeafened}
              playerPositions={playerPositions}
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
