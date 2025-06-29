
import React, { useState, useCallback } from 'react';
import { Header } from './components/Header.js';
import { Hero } from './components/Hero.js';
import { Footer } from './components/Footer.js';
import { Modal } from './components/Modal.js';
import { RoomCodeInput } from './components/RoomCodeInput.js';
import { ChatRoom } from './components/ChatRoom.js';
import { ConnectionInstructions } from './components/ConnectionInstructions.js';
import { Player as PlayerClass } from './models/Player.js'; // Import the class
import { world } from './ipc/Minecraft.js';

enum ModalType {
  NONE,
  JOIN,
}

// Centralized type definitions
export type Role = 'owner' | 'player';

// This interface is now a Data Transfer Object (DTO)
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
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [currentUser, setCurrentUser] = useState<PlayerClass | null>(null); // Use the class instance
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const openModal = useCallback((type: ModalType) => {
    setActiveModal(type);
    setRoomCode('');
    setPlayerId('');
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(ModalType.NONE);
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === 6 && playerId.length === 4) {
      const playerData: Player = {
        id: parseInt(playerId, 10),
        name: playerId,
        isMuted: false,
        isOwner: false,
        volume: 100,
        isOnline: true,
      };
      setCurrentUser(new PlayerClass(playerData)); // Create class instance
      setUserRole('player');
      setView('chat');
      closeModal();
    } else {
      alert('ルームコードは6文字、プレイヤーIDは4桁で入力してください。');
    }
  };

  const generateRoomCode = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

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
      setCurrentUser(new PlayerClass(ownerPlayerData)); // Create class instance
      setUserRole('owner');
      setRoomCode(generateRoomCode(6));
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
    setView('landing');
    setUserRole(null);
    setCurrentUser(null);
    setRoomCode('');
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
                  value={roomCode}
                  onChange={setRoomCode}
                  ariaLabelPrefix="ルームコード"
                />
              </div>
              <div className="w-full flex flex-col gap-2">
                <label className="text-sm text-[#A9A9A9] text-center">プレイヤーID (4桁)</label>
                <RoomCodeInput
                    length={4}
                    value={playerId}
                    onChange={setPlayerId}
                    inputType="numeric"
                    ariaLabelPrefix="プレイヤーID"
                />
              </div>
              <button
                type="submit"
                disabled={roomCode.length !== 6 || playerId.length !== 4}
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
    return <ConnectionInstructions onConnected={handleConnectionComplete} />;
  }

  if (view === 'chat' && userRole && currentUser) {
    return <ChatRoom role={userRole} currentUser={currentUser} onLeave={handleLeaveRoom} />;
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
