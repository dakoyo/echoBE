
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Header } from './components/Header.js';
import { Hero } from './components/Hero.js';
import { Footer } from './components/Footer.js';
import { Modal } from './components/Modal.js';
import { RoomCodeInput } from './components/RoomCodeInput.js';
import { ChatRoom } from './components/ChatRoom.js';
import { ConnectionInstructions } from './components/ConnectionInstructions.js';
import { Player as PlayerClass } from './models/Player.js';
import { world } from './ipc/Minecraft.js';
import { useSignaling } from './hooks/useSignaling.js';
import { AudioPlayer } from './components/AudioPlayer.js';

enum ModalType {
  NONE,
  JOIN,
}

export type Role = 'owner' | 'player';

export interface Player {
  id: number;
  name: string;
  isMuted: boolean;
  isOwner: boolean;
  volume: number;
  isOnline: boolean;
}

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'chat' | 'connecting'>('landing');
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinPlayerId, setJoinPlayerId] = useState(''); // This is the 4-digit player code
  const [currentUser, setCurrentUser] = useState<PlayerClass | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [playerCodeMap, setPlayerCodeMap] = useState<Map<string, string>>(new Map()); // <playerName, playerCode>

  const verifyPlayerCode = useCallback((clientId: string, playerCode: string): string | null => {
    for (const [name, code] of playerCodeMap.entries()) {
      if (code === playerCode) {
        return name;
      }
    }
    return null;
  }, [playerCodeMap]);

  const signaling = useSignaling({ role: userRole, verifyPlayerCode });

  useEffect(() => {
    if (userRole !== 'owner' || !signaling.roomCode || !currentUser) return;

    const generatePlayerCode = () => Math.floor(1000 + Math.random() * 9000).toString();

    const updateAndInformPlayers = () => {
        const worldPlayerNames = world.getPlayerNames();
        const newCodeMap = new Map<string, string>();
        
        worldPlayerNames.forEach(name => {
            if (name === currentUser.name) return;
            
            const code = generatePlayerCode();
            newCodeMap.set(name, code);

            const message = `=====EchoBE プレイヤー情報=====\nルームID：${signaling.roomCode}\nプレイヤーコード：${code}\n===========================`;
            world.sendMessage(message, name);
        });
        setPlayerCodeMap(newCodeMap);
    };
    
    updateAndInformPlayers();

    world.events.on('playersJoin', updateAndInformPlayers);
    world.events.on('playersLeave', updateAndInformPlayers);

    return () => {
        world.events.removeListener('playersJoin', updateAndInformPlayers);
        world.events.removeListener('playersLeave', updateAndInformPlayers);
    };
  }, [userRole, signaling.roomCode, currentUser]);


  const openModal = useCallback((type: ModalType) => {
    setActiveModal(type);
    setJoinRoomCode('');
    setJoinPlayerId('');
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(ModalType.NONE);
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinRoomCode.length === 6 && joinPlayerId.length === 4) {
      const tempPlayer = new PlayerClass({
          id: Date.now(),
          name: '接続中...',
          isMuted: false,
          isOwner: false,
          volume: 100,
          isOnline: true,
      });
      setCurrentUser(tempPlayer);
      setUserRole('player');
      signaling.joinRoom(joinRoomCode.toUpperCase(), joinPlayerId);
      setView('chat');
      closeModal();
    } else {
      alert('ルームコードは6文字、プレイヤーコードは4桁で入力してください。');
    }
  };
  
  // Update currentUser name when client auth is successful
  useEffect(() => {
    if (userRole === 'player' && signaling.self?.playerName && currentUser?.name !== signaling.self.playerName) {
      setCurrentUser(prev => {
        if (!prev) return null;
        const newData = prev.toData();
        newData.name = signaling.self.playerName;
        return new PlayerClass(newData);
      });
    }
  }, [userRole, signaling.self, currentUser]);

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const ownerName = await world.getOwnerName();
      const ownerPlayerData: Player = {
        id: 1, // Static ID for the owner
        name: ownerName,
        isMuted: false,
        isOwner: true,
        volume: 100,
        isOnline: true,
      };
      setCurrentUser(new PlayerClass(ownerPlayerData));
      setUserRole('owner');
      signaling.createRoom();
      setView('connecting');
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("ルームの作成に失敗しました。");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleConnectionComplete = useCallback(() => {
    setView('chat');
  }, []);

  const handleLeaveRoom = () => {
    signaling.leaveRoom();
    setView('landing');
    setUserRole(null);
    setCurrentUser(null);
    setJoinRoomCode('');
    setJoinPlayerId('');
    setPlayerCodeMap(new Map());
  };
  
  const handleKickPlayer = (playerName: string) => {
      const clientId = Array.from(signaling.onlineClients.entries())
          .find(([, name]) => name === playerName)?.[0];
      if (clientId) {
          signaling.kickClient(clientId);
      }
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case ModalType.JOIN:
        return (
          <>
            <h2 className="text-2xl text-[#E0E0E0] mb-6 text-center">ルームに参加</h2>
            <form onSubmit={handleJoinRoom} className="flex flex-col items-center gap-6 w-full">
              <div className="w-full flex flex-col gap-2">
                <label className="text-sm text-[#A9A9A9] text-center">ルームコード (6文字)</label>
                <RoomCodeInput
                  length={6}
                  value={joinRoomCode}
                  onChange={setJoinRoomCode}
                  ariaLabelPrefix="ルームコード"
                  inputType="alphanumeric"
                />
              </div>
              <div className="w-full flex flex-col gap-2">
                <label className="text-sm text-[#A9A9A9] text-center">プレイヤーコード (4桁)</label>
                <RoomCodeInput
                    length={4}
                    value={joinPlayerId}
                    onChange={setJoinPlayerId}
                    inputType="numeric"
                    ariaLabelPrefix="プレイヤーコード"
                />
              </div>
              <button
                type="submit"
                disabled={joinRoomCode.length !== 6 || joinPlayerId.length !== 4}
                className="w-full bg-[#A9A9A9] text-[#212121] py-3 px-6 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF] disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-700 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:active:border-gray-700"
              >
                参加する
              </button>
            </form>
          </>
        );
      default:
        return null;
    }
  };

  if (view === 'connecting') {
    return <ConnectionInstructions roomCode={signaling.roomCode} onConnected={handleConnectionComplete} />;
  }

  if (view === 'chat' && userRole && currentUser) {
    return (
     <>
        <ChatRoom
          role={userRole}
          currentUser={currentUser}
          onLeave={handleLeaveRoom}
          onlineClients={signaling.onlineClients}
          onKick={handleKickPlayer}
        />
        {Array.from(signaling.remoteStreams.entries()).map(([clientId, stream]) => (
            <AudioPlayer key={clientId} stream={stream} />
        ))}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#313233] text-[#E0E0E0] flex flex-col selection:bg-[#58A445] selection:text-white">
      <div className="relative z-10 flex flex-col flex-grow">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Hero onJoin={() => openModal(ModalType.JOIN)} onCreate={handleCreateRoom} isCreating={isCreatingRoom} />
        </main>
        <Footer />
      </div>

      <Modal isOpen={activeModal !== ModalType.NONE} onClose={closeModal}>
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default App;
