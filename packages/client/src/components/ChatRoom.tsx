
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './Sidebar.js';
import { PlayerList } from './PlayerList.js';
import { ControlBar } from './ControlBar.js';
import { Modal } from './Modal.js';
import { Role, Player as PlayerData } from '../App.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { HamburgerIcon } from './icons/HamburgerIcon.js';
import { world } from '../ipc/Minecraft.js';

interface ChatRoomProps {
  role: Role;
  currentUser: Player;
  onLeave: () => void;
  onlineClients: Map<string, string>; // Map<clientId, playerName>
  onKick: (playerName: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ role, currentUser, onLeave, onlineClients, onKick }) => {
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

  const onlinePlayerNames = useMemo(() => new Set(onlineClients.values()), [onlineClients]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Ensure we have permission before enumerating
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the track immediately to avoid leaving the mic on
        stream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioInputDevices(inputs);
        if (inputs.length > 0) setSelectedAudioInput(inputs[0].deviceId);

        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioOutputDevices(outputs);
        if (outputs.length > 0) setSelectedAudioOutput(outputs[0].deviceId);
      } catch (err) {
        console.error("Could not get audio devices. Please grant microphone permission.", err);
      }
    };

    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  useEffect(() => {
    const syncPlayersWithWorld = async () => {
      const worldPlayerNames = new Set(world.getPlayerNames());
      
      setRoom(prevRoom => {
        const allKnownPlayers = [...prevRoom.otherPlayers];
        const knownPlayerNames = new Set(allKnownPlayers.map(p => p.name));

        // Add players from world who are not in the room list yet
        worldPlayerNames.forEach(name => {
          if (name !== currentUser.name && !knownPlayerNames.has(name)) {
            const newPlayer = new Player({
              id: Date.now() + Math.random(),
              name: name,
              isMuted: false,
              isOwner: false,
              volume: 100,
              isOnline: onlinePlayerNames.has(name),
            });
            allKnownPlayers.push(newPlayer);
          }
        });
        
        // Update online status for all players and filter out those who left the world
        const updatedPlayersData = allKnownPlayers
          .map(player => {
              player.setOnlineStatus(onlinePlayerNames.has(player.name) || player.name === currentUser.name);
              return player.toData();
          })
          .filter(playerData => worldPlayerNames.has(playerData.name) || playerData.name === currentUser.name);
        
        const otherPlayersData = updatedPlayersData.filter(p => p.name !== currentUser.name);
        
        return new Room(currentUser.clone(), otherPlayersData);
      });
    };

    syncPlayersWithWorld();

    world.events.on('playersJoin', syncPlayersWithWorld);
    world.events.on('playersLeave', syncPlayersWithWorld);

    return () => {
      world.events.removeListener('playersJoin', syncPlayersWithWorld);
      world.events.removeListener('playersLeave', syncPlayersWithWorld);
    };
  }, [currentUser, onlinePlayerNames]);

  const handleVolumeChange = (player: Player, volume: number) => {
    player.setVolume(volume);
    setRoom(room.clone());
  };

  const handleInitiateKick = (player: Player) => {
    if (role === 'owner' && player.isOnline) {
      setPlayerToKick(player);
    }
  };

  const handleConfirmKick = () => {
    if (playerToKick) {
      onKick(playerToKick.name);
      setRoom(room.kickPlayer(playerToKick));
    }
    setPlayerToKick(null);
  };

  const handleCancelKick = () => setPlayerToKick(null);
  const handleInitiateLeave = () => setIsLeaveModalOpen(true);
  const handleConfirmLeave = () => {
    setIsLeaveModalOpen(false);
    onLeave();
  };
  const handleCancelLeave = () => setIsLeaveModalOpen(false);

  return (
    <div className="min-h-screen bg-[#313233] text-[#E0E0E0] flex flex-col selection:bg-[#58A445] selection:text-white">
      <div className="flex flex-grow overflow-hidden">
        <div className={`fixed md:relative top-0 left-0 h-full md:h-auto z-40 transition-transform transform ease-in-out duration-300 md:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar
            role={role}
            onClose={() => setIsSidebarOpen(false)}
            audibleRange={audibleRange}
            onAudibleRangeChange={setAudibleRange}
            spectatorVoice={spectatorVoice}
            onSpectatorVoiceChange={setSpectatorVoice}
            audioInputDevices={audioInputDevices}
            selectedAudioInput={selectedAudioInput}
            onAudioInputChange={setSelectedAudioInput}
            audioOutputDevices={audioOutputDevices}
            selectedAudioOutput={selectedAudioOutput}
            onAudioOutputChange={setSelectedAudioOutput}
          /> 
        </div>

        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true"></div>
        )}

        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="md:hidden mb-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-[#A9A9A9] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]" aria-label="設定メニューを開く">
              <HamburgerIcon className="w-6 h-6 text-[#212121]" /> 
            </button>
          </div>
          
          <h2 className="text-3xl text-white mb-6">参加者 ({room.onlinePlayerCount + 1})</h2>
          <PlayerList 
            room={room}
            currentRole={role}
            onKick={handleInitiateKick}
            onVolumeChange={handleVolumeChange}
          />
        </main>
      </div>
      <ControlBar
        currentUser={currentUser}
        isMuted={isMuted}
        isDeafened={isDeafened}
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
