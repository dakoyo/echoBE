
import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalingService } from '../services/SignalingService.js';
import type { Role } from '../App.js';
import type { SignalingMessageIn, SignalingMessageOut, RoomCreatedPayload, NewClientPayload, AuthPayload, AuthSuccessPayload, OfferPayload, AnswerPayload, IceCandidatePayload, DisconnectPayload, ClientAuthMessage } from '../types/signaling.js';
import { SignalingEvents } from '../types/signaling.js';

const SIGNALING_URL = 'ws://localhost:8080';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

interface UseSignalingProps {
  role: Role | null;
  verifyPlayerCode: (clientId: string, playerCode: string) => string | null;
}

interface SelfInfo {
  clientId: string;
  playerName: string;
}

export const useSignaling = ({ role, verifyPlayerCode }: UseSignalingProps) => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [self, setSelf] = useState<SelfInfo | null>(null);
  const [onlineClients, setOnlineClients] = useState<Map<string, string>>(new Map()); // Map<clientId, playerName>
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const signalingService = useRef(new SignalingService());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const getLocalStream = useCallback(async () => {
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      alert("マイクへのアクセス許可が必要です。");
      return null;
    }
  }, [localStream]);

  const createPeerConnection = useCallback((peerId: string, currentStream: MediaStream) => {
    if (peerConnections.current.has(peerId)) {
        console.warn(`Peer connection for ${peerId} already exists.`);
        return peerConnections.current.get(peerId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && myId) {
        const message: SignalingMessageOut = {
          type: SignalingEvents.ICE_CANDIDATE,
          payload: { candidate: event.candidate.toJSON(), clientId: peerId },
          senderId: myId
        };
        signalingService.current.send(message);
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      setRemoteStreams(prev => new Map(prev).set(peerId, event.streams[0]));
    };
    
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
    }

    currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [myId]);
  
  const handleSignalingMessage = useCallback(async (message: SignalingMessageIn) => {
    console.log('Received message:', message);

    switch (message.type) {
      case SignalingEvents.ROOM_CREATED:
        setRoomCode(message.payload.roomCode);
        setMyId(message.payload.yourId);
        break;

      case SignalingEvents.AUTH: {
        if (role !== 'owner' || !myId) break;
        const { senderId, payload } = message;
        const playerName = verifyPlayerCode(senderId, payload.playerId);

        if (playerName) {
          console.log(`Client ${senderId} authenticated as ${playerName}`);
          const authSuccessMessage: SignalingMessageOut = {
            type: SignalingEvents.AUTH_SUCCESS,
            payload: { clientId: senderId, playerName },
            senderId: myId,
          };
          signalingService.current.send(authSuccessMessage);
          
          setOnlineClients(prev => new Map(prev).set(senderId, playerName));
          
          const stream = await getLocalStream();
          if (stream) {
            const pc = createPeerConnection(senderId, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            const offerMessage: SignalingMessageOut = {
              type: SignalingEvents.OFFER,
              payload: { offer, clientId: senderId },
              senderId: myId,
            };
            signalingService.current.send(offerMessage);
          }
        } else {
            console.warn(`Authentication failed for client ${senderId}`);
            const errorMessage: SignalingMessageOut = {
                type: SignalingEvents.ERROR,
                payload: { message: "Authentication failed: Invalid player code.", clientId: senderId },
                senderId: myId,
            };
            signalingService.current.send(errorMessage);
        }
        break;
      }
      
      case SignalingEvents.AUTH_SUCCESS: {
        if (role !== 'player') break;
        const { senderId, payload } = message;
        setSelf({ clientId: myId!, playerName: payload.playerName }); // client knows its own name
        setOnlineClients(prev => new Map(prev).set(senderId, "owner")); // Add owner to the list
        break;
      }

      case SignalingEvents.OFFER: {
        if (role !== 'player' || !myId) break;
        const { senderId: ownerId, payload } = message;
        const stream = await getLocalStream();
        if(stream) {
            const pc = createPeerConnection(ownerId, stream);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const answerMessage: SignalingMessageOut = {
                type: SignalingEvents.ANSWER,
                payload: { answer, clientId: ownerId },
                senderId: myId,
            };
            signalingService.current.send(answerMessage);
        }
        break;
      }

      case SignalingEvents.ANSWER: {
        if (role !== 'owner') break;
        const { senderId: clientId, payload } = message;
        const pc = peerConnections.current.get(clientId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        break;
      }

      case SignalingEvents.ICE_CANDIDATE: {
        const { senderId, payload } = message;
        const pc = peerConnections.current.get(senderId);
        if (pc && payload.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.error("Error adding received ice candidate", e));
        }
        break;
      }
      
      case SignalingEvents.CLIENT_DISCONNECTED: {
          const { clientId } = message.payload;
          console.log(`Client ${clientId} disconnected.`);
          peerConnections.current.get(clientId)?.close();
          peerConnections.current.delete(clientId);
          setRemoteStreams(prev => {
              const next = new Map(prev);
              next.delete(clientId);
              return next;
          });
          setOnlineClients(prev => {
              const next = new Map(prev);
              next.delete(clientId);
              return next;
          });
          break;
      }

      case SignalingEvents.ERROR:
        alert(`Error from server: ${message.payload.message}`);
        // Consider calling leaveRoom() or handling differently
        break;
        
      case SignalingEvents.ROOM_CLOSED:
          alert("The room has been closed by the owner.");
          leaveRoom();
          break;
    }
  }, [myId, role, getLocalStream, createPeerConnection, verifyPlayerCode]);

  useEffect(() => {
    const service = signalingService.current;
    service.on('message', handleSignalingMessage);
    return () => {
        service.removeListener('message', handleSignalingMessage);
    };
  }, [handleSignalingMessage]);
  
  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    peerConnections.current.forEach(pc => pc.close());
    signalingService.current.close();
    
    peerConnections.current.clear();
    setRoomCode(null);
    setMyId(null);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setOnlineClients(new Map());
    setSelf(null);
  },[localStream]);

  const leaveRoom = useCallback(() => {
    cleanup();
  }, [cleanup]);
  
  useEffect(() => {
    // Ensure cleanup is called when the component unmounts
    return () => {
        cleanup();
    }
  }, [cleanup]);

  const createRoom = useCallback(async () => {
    await getLocalStream();
    await signalingService.current.connect(`${SIGNALING_URL}/ws`);
  }, [getLocalStream]);

  const joinRoom = useCallback(async (code: string, playerId: string) => {
    const stream = await getLocalStream();
    if (!stream) return;

    const service = signalingService.current;
    await service.connect(`${SIGNALING_URL}/ws/${code.toUpperCase()}`);
    
    service.once('open', () => {
        const authMessage: ClientAuthMessage = {
             type: SignalingEvents.AUTH,
             payload: { playerId }
        };
        // The client doesn't know its ID, so it can't be the senderId.
        // Server will add it before forwarding.
        service.send(authMessage as SignalingMessageOut); 
        
        // After sending auth, we wait for a `room-created` like message to get our ID.
        // The current server implementation doesn't send one to clients.
        // We'll rely on the `auth-success` message to get our name, but we still don't have our client ID.
        // This is a protocol limitation. We'll set our ID for now from the first ICE candidate we need to send,
        // but it's not ideal. For now, we'll get it from the `answer` message we send.
        // A better server would send `connected: { yourId: '...' }`
    });

    service.once('message', (msg) => {
        if (msg.type === SignalingEvents.OFFER) {
            setMyId(msg.payload.clientId);
        }
    });

  }, [getLocalStream]);
  
  const kickClient = useCallback((clientId: string) => {
      if(role === 'owner' && myId) {
          const message: SignalingMessageOut = {
              type: SignalingEvents.DISCONNECT,
              payload: { clientId },
              senderId: myId
          };
          signalingService.current.send(message);

          // Also clean up locally immediately
          peerConnections.current.get(clientId)?.close();
          peerConnections.current.delete(clientId);
          setRemoteStreams(prev => {
              const next = new Map(prev);
              next.delete(clientId);
              return next;
          });
          setOnlineClients(prev => {
              const next = new Map(prev);
              next.delete(clientId);
              return next;
          });
      }
  }, [role, myId]);

  return { roomCode, onlineClients, remoteStreams, createRoom, joinRoom, leaveRoom, kickClient, self };
};
