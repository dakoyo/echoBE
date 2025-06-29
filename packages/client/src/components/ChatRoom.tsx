import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar.js';
import { PlayerList } from './PlayerList.js';
import { ControlBar } from './ControlBar.js';
import { Modal } from './Modal.js';
import { Role, Player as PlayerData } from '../App.js'; // PlayerData is the interface
import { Player } from '../models/Player.js'; // Player is the class
import { Room } from '../models/Room.js'; // Import Room class
import { HamburgerIcon } from './icons/HamburgerIcon.js';
import { world } from '../ipc/Minecraft.js';

interface ChatRoomProps {
  role: Role;
  currentUser: Player; // This is the Player class instance
  onLeave: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ role, currentUser, onLeave }) => {
  const [room, setRoom] = useState(() => new Room(currentUser, []));
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const [playerToKick, setPlayerToKick] = useState<Player | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Room settings state
  const [audibleRange, setAudibleRange] = useState(48);
  const [spectatorVoice, setSpectatorVoice] = useState(true);

  // Device settings state
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const inputs = devices.filter(device => device.kind === 'audioinput');
        setAudioInputDevices(inputs);
        if (inputs.length > 0) {
          const defaultInput = inputs.find(d => d.deviceId === 'default') || inputs[0];
          setSelectedAudioInput(defaultInput.deviceId);
        }

        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioOutputDevices(outputs);
        if (outputs.length > 0) {
          const defaultOutput = outputs.find(d => d.deviceId === 'default') || outputs[0];
          setSelectedAudioOutput(defaultOutput.deviceId);
        }
      } catch (err) {
        console.error("Could not get audio devices. Please grant microphone permission.", err);
      }
    };

    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  useEffect(() => {
    const syncPlayersWithWorld = async () => {
      const ownerName = await world.getOwnerName();
      // Player names from the Minecraft world are the source of truth for who is "online".
      const onlinePlayerNames = new Set(world.getPlayerNames());
      
      setRoom(prevRoom => {
        const allKnownPlayers = [...prevRoom.otherPlayers];
        const knownPlayerNames = new Set(allKnownPlayers.map(p => p.name));

        // Add any new players from the world that are not in our current state.
        onlinePlayerNames.forEach(name => {
          if (name !== currentUser.name && !knownPlayerNames.has(name)) {
            const newPlayer = new Player({
              id: Date.now() + Math.random(), // Unique ID for React key
              name: name,
              isMuted: false,
              isOwner: name === ownerName,
              volume: 100,
              isOnline: true,
            });
            allKnownPlayers.push(newPlayer);
          }
        });

        // Update the online status for every player and create new data objects.
        const updatedPlayersData = allKnownPlayers.map(player => {
          player.setOnlineStatus(onlinePlayerNames.has(player.name));
          return player.toData();
        });
        
        // Return a new Room instance to trigger re-render.
        return new Room(currentUser.clone(), updatedPlayersData);
      });
    };

    syncPlayersWithWorld(); // Initial sync when component mounts

    // Subscribe to world events
    world.events.on('playersJoin', syncPlayersWithWorld);
    world.events.on('playersLeave', syncPlayersWithWorld);

    // Cleanup listeners on unmount
    return () => {
      world.events.removeListener('playersJoin', syncPlayersWithWorld);
      world.events.removeListener('playersLeave', syncPlayersWithWorld);
    };
  }, [currentUser]);

  const handleVolumeChange = (player: Player, volume: number) => {
    player.setVolume(volume);
    setRoom(room.clone()); // Clone the room to trigger a re-render
  };

  const handleInitiateKick = (player: Player) => {
    if (role === 'owner' && player.isOnline) {
      setPlayerToKick(player);
    }
  };

  const handleConfirmKick = () => {
    if (playerToKick) {
      setRoom(room.kickPlayer(playerToKick));
    }
    setPlayerToKick(null);
  };

  const handleCancelKick = () => {
    setPlayerToKick(null);
  };

  const handleInitiateLeave = () => {
    setIsLeaveModalOpen(true);
  };

  const handleConfirmLeave = () => {
    setIsLeaveModalOpen(false);
    onLeave();
  };

  const handleCancelLeave = () => {
    setIsLeaveModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#313233] text-[#E0E0E0] flex flex-col selection:bg-[#58A445] selection:text-white">
      <div className="flex flex-grow overflow-hidden">
        <div className={`
          fixed md:relative 
          top-0 left-0 
          h-full md:h-auto 
          z-40 
          transition-transform transform 
          ease-in-out duration-300
          md:transform-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
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
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          ></div>
        )}

        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="md:hidden mb-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-[#A9A9A9] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
              aria-label="設定メニューを開く"
            >
              <HamburgerIcon className="w-6 h-6 text-[#212121]" /> 
            </button>
          </div>
          
          <h2 className="text-3xl text-white mb-6">参加者 ({room.onlinePlayerCount})</h2>
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
      {/* Kick Confirmation Modal */}
      <Modal isOpen={!!playerToKick} onClose={handleCancelKick}>
        {playerToKick && (
          <div className="text-center p-4">
            <h2 className="text-2xl text-[#E0E0E0] mb-4">プレイヤーをキック</h2>
            <p className="text-[#A9A9A9] mb-8">
              本当に <strong>{playerToKick.name}</strong> さんをルームからキックしますか？
            </p>
            <div className="flex justify-center gap-6">
              <button 
                onClick={handleCancelKick} 
                className="w-40 bg-[#A9A9A9] text-[#212121] text-lg py-2 px-4 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
              >
                キャンセル
              </button>
              <button 
                onClick={handleConfirmKick} 
                className="w-40 bg-[#b83939] text-white text-lg py-2 px-4 border-2 border-t-[#d67373] border-l-[#d67373] border-b-[#8a2c2c] border-r-[#8a2c2c] hover:bg-[#c94343] active:bg-[#b83939] active:border-t-[#8a2c2c] active:border-l-[#8a2c2c] active:border-b-[#d67373] active:border-r-[#d67373]"
                aria-label={`${playerToKick.name}のキックを確定`}
              >
                キックする
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Leave Confirmation Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={handleCancelLeave}>
        <div className="text-center p-4">
          <h2 className="text-2xl text-[#E0E0E0] mb-4">ルームから退出</h2>
          <p className="text-[#A9A9A9] mb-8">
            本当にこのルームから退出しますか？
          </p>
          <div className="flex justify-center gap-6">
            <button 
              onClick={handleCancelLeave} 
              className="w-40 bg-[#A9A9A9] text-[#212121] text-lg py-2 px-4 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
            >
              キャンセル
            </button>
            <button 
              onClick={handleConfirmLeave}
              className="w-40 bg-[#b83939] text-white text-lg py-2 px-4 border-2 border-t-[#d67373] border-l-[#d67373] border-b-[#8a2c2c] border-r-[#8a2c2c] hover:bg-[#c94343] active:bg-[#b83939] active:border-t-[#8a2c2c] active:border-l-[#8a2c2c] active:border-b-[#d67373] active:border-r-[#d67373]"
              aria-label="ルームからの退出を確定"
            >
              退出する
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};