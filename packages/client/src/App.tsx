

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header.js';
import { Hero } from './components/Hero.js';
import { Footer } from './components/Footer.js';
import { Modal } from './components/Modal.js';
import { RoomCodeInput } from './components/RoomCodeInput.js';
import { ChatRoom } from './components/ChatRoom.js';
import { ConnectionInstructions } from './components/ConnectionInstructions.js';
import { Player as PlayerClass } from './models/Player.js';
import { world } from './ipc/Minecraft.js';
import { SignalingService } from './services/SignalingService.js';
import type { AuthSuccessMessage } from './types/signaling.js';

enum ModalType {
  NONE,
  JOIN,
}

export type Role = 'owner' | 'player';

export interface PlayerData {
  id: number;
  name: string;
  isMuted: boolean;
  isDeafened: boolean;
  isOwner: boolean;
  volume: number;
  isOnline: boolean;
  playerCode?: string;
  signalingId?: string;
  stream?: MediaStream;
}

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'chat' | 'connecting'>('landing');
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
  const [roomCode, setRoomCode] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [currentUser, setCurrentUser] = useState<PlayerClass | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const signalingServiceRef = useRef<SignalingService | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Get microphone permissions and stream early
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        setLocalStream(stream);
      })
      .catch(err => {
        console.error("Could not get microphone permission:", err);
        alert("マイクの許可が必要です。");
      });

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      signalingServiceRef.current?.close();
    };
  }, []);

  const openModal = useCallback((type: ModalType) => {
    setActiveModal(type);
    setRoomCode('');
    setPlayerCode('');
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(ModalType.NONE);
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === 6 && playerCode.length === 4 && localStream) {
      setUserRole('player');
      const service = new SignalingService('player', localStream);
      signalingServiceRef.current = service;

      service.on('connected-with-id', ({ ownerId }: { ownerId: string }) => {
        service.sendAuth(playerCode, ownerId);
      });

      service.on('auth-success', (data: AuthSuccessMessage['payload']) => {
        const playerData: PlayerData = {
          id: Date.now(),
          name: data.playerName,
          isMuted: false,
          isDeafened: false,
          isOwner: false,
          volume: 100,
          isOnline: true,
          signalingId: data.clientId,
        };
        const user = new PlayerClass(playerData);
        setCurrentUser(user);
        setView('chat');
        closeModal();
      });
      
      service.on('error', (error) => {
        alert(`エラー: ${error.message}`);
        setView('landing');
        closeModal();
      });

      service.connect(roomCode);
    } else {
      alert('ルームコードは6文字、プレイヤーコードは4桁で入力してください。');
    }
  };

  const handleCreateRoom = async () => {
    if (!localStream) {
      alert("マイクの準備ができていません。");
      return;
    }
    setIsCreatingRoom(true);
    setUserRole('owner');
    setView('connecting');
  };

  const handleConnectionComplete = useCallback(async () => {
    if (!localStream) {
        setIsCreatingRoom(false);
        setView('landing');
        alert("マイクの準備ができていませんでした。");
        return;
    }
    try {
      const ownerName = await world.getOwnerName();
      const ownerPlayerData: PlayerData = {
        id: 1,
        name: ownerName,
        isMuted: false,
        isDeafened: false,
        isOwner: true,
        volume: 100,
        isOnline: true,
      };
      const owner = new PlayerClass(ownerPlayerData);
      setCurrentUser(owner);

      const service = new SignalingService('owner', localStream, owner);
      signalingServiceRef.current = service;

      service.on('room-created', ({ roomCode, yourId }) => {
        owner.signalingId = yourId;
        setCurrentUser(owner.clone());
        world.generatePlayerCodes();
        world.notifyPlayersWithCodes(roomCode);
        setRoomCode(roomCode);
      });

      service.connect();
      setView('chat');

    } catch (error) {
      console.error("Failed to create room:", error);
      alert("ルームの作成に失敗しました。");
      setView('landing');
    } finally {
      setIsCreatingRoom(false);
    }
  }, [localStream]);

  const handleLeaveRoom = useCallback(() => {
    signalingServiceRef.current?.close();
    signalingServiceRef.current = null;
    setView('landing');
    setUserRole(null);
    setCurrentUser(null);
    setRoomCode('');
  }, []);

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
                <label className="text-sm text-[#A9A9A9] text-center">プレイヤーコード (4桁)</label>
                <RoomCodeInput
                    length={4}
                    value={playerCode}
                    onChange={setPlayerCode}
                    inputType="numeric"
                    ariaLabelPrefix="プレイヤーコード"
                />
              </div>
              <button
                type="submit"
                disabled={roomCode.length !== 6 || playerCode.length !== 4 || !localStream}
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

  if (view === 'chat' && userRole && currentUser && signalingServiceRef.current) {
    return <ChatRoom role={userRole} currentUser={currentUser} onLeave={handleLeaveRoom} signalingService={signalingServiceRef.current} roomCode={roomCode} />;
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
