
import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalingService } from '../services/SignalingService.js';
import type { Role } from '../App.js';
import type { SignalingMessageIn, SignalingMessageOut, RoomCreatedPayload, NewClientPayload, AuthPayload, AuthSuccessPayload, OfferPayload, AnswerPayload, IceCandidatePayload, DisconnectPayload, ErrorPayload } from '../types/signaling.js';
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      alert("マイクへのアクセス許可が必要です。");
      return null;
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string, currentStream: MediaStream) => {
    if (peerConnections.current.has(peerId)) {
        return peerConnections.current.get(peerId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && myId) {
        signalingService.current.send({
          type: SignalingEvents.ICE_CANDIDATE,
          payload: { candidate: event.candidate.toJSON(), clientId: peerId },
          senderId: myId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => new Map(prev).set(peerId, event.streams[0]));
    };

    currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [myId]);
  
  const handleSignalingMessage = useCallback(async (message: SignalingMessageIn) => {
    console.log('Received message:', message);
    if (!myId && message.type !== SignalingEvents.ROOM_CREATED && message.type !== SignalingEvents.ERROR) return;

    switch (message.type) {
      case SignalingEvents.ROOM_CREATED:
        setRoomCode((message.payload as RoomCreatedPayload).roomCode);
        setMyId((message.payload as RoomCreatedPayload).yourId);
        break;

      case SignalingEvents.NEW_CLIENT: {
        if (role !== 'owner') break;
        const { clientId } = message.payload as NewClientPayload;
        console.log(`New client connected: ${clientId}. Waiting for auth.`);
        // Wait for auth message to create PC
        break;
      }

      case SignalingEvents.AUTH: {
        if (role !== 'owner' || !myId) break;
        const { clientId, playerId } = message.payload as AuthPayload;
        const playerName = verifyPlayerCode(clientId, playerId);

        if (playerName) {
          signalingService.current.send({
            type: SignalingEvents.AUTH_SUCCESS,
            payload: { clientId, playerName },
            senderId: myId,
          });
          setOnlineClients(prev => new Map(prev).set(clientId, playerName));
          
          const stream = localStream || await getLocalStream();
          if (stream) {
            const pc = createPeerConnection(clientId, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signalingService.current.send({
              type: SignalingEvents.OFFER,
              payload: { offer, clientId },
              senderId: myId,
            });
          }
        } else {
            signalingService.current.send({
                type: SignalingEvents.ERROR,
                payload: { message: "Authentication failed", clientId },
                senderId: myId,
            });
        }
        break;
      }
      
      case SignalingEvents.AUTH_SUCCESS: {
        if (role !== 'player') break;
        const { clientId, playerName } = message.payload as AuthSuccessPayload;
        setSelf({ clientId, playerName });
        setOnlineClients(prev => new Map(prev).set(clientId, playerName));
        break;
      }

      case SignalingEvents.OFFER: {
        if (role !== 'player' || !myId) break;
        const { offer, clientId: ownerId } = message.payload as OfferPayload;
        const stream = localStream || await getLocalStream();
        if(stream) {
            const pc = createPeerConnection(ownerId, stream);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalingService.current.send({
                type: SignalingEvents.ANSWER,
                payload: { answer, clientId: ownerId },
                senderId: myId,
            });
        }
        break;
      }

      case SignalingEvents.ANSWER: {
        if (role !== 'owner') break;
        const { answer, clientId } = message.payload as AnswerPayload;
        const pc = peerConnections.current.get(clientId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        break;
      }

      case SignalingEvents.ICE_CANDIDATE: {
        const { candidate, clientId } = message.payload as IceCandidatePayload;
        const pc = peerConnections.current.get(clientId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        break;
      }
      
      case SignalingEvents.CLIENT_DISCONNECTED: {
          const { clientId } = message.payload as DisconnectPayload;
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
        alert(`Error from server: ${(message.payload as {message: string}).message}`);
        leaveRoom();
        break;
        
      case SignalingEvents.ROOM_CLOSED:
          alert("The room has been closed by the owner.");
          leaveRoom();
          break;
    }
  }, [myId, role, getLocalStream, createPeerConnection, localStream, verifyPlayerCode]);

  useEffect(() => {
    signalingService.current.on('message', handleSignalingMessage);
    return () => {
        signalingService.current.removeAllListeners('message');
    };
  }, [handleSignalingMessage]);

  const createRoom = useCallback(async () => {
    await getLocalStream();
    await signalingService.current.connect(`${SIGNALING_URL}/ws`);
  }, [getLocalStream]);

  const joinRoom = useCallback(async (code: string, playerId: string) => {
    await getLocalStream();
    await signalingService.current.connect(`${SIGNALING_URL}/ws/${code}`);
    signalingService.current.on('open', () => {
        // We don't have our ID from the server yet, so we can't send auth.
        // This is a flow issue in the protocol design.
        // For now, let's assume client sends auth without its own ID and server forwards.
        // The server-side code implies senderId is not needed for auth. Let's adjust.
         signalingService.current.send({
             type: SignalingEvents.AUTH,
             payload: { playerId, clientId: '' } // clientId will be filled by server
         });
    });
  }, [getLocalStream]);
  
  const leaveRoom = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    signalingService.current.close();
    setRoomCode(null);
    setMyId(null);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setOnlineClients(new Map());
    setSelf(null);
  }, [localStream]);

  const kickClient = useCallback((clientId: string) => {
      if(role === 'owner' && myId) {
          signalingService.current.send({
              type: SignalingEvents.DISCONNECT,
              payload: { clientId },
              senderId: myId
          });
      }
  }, [role, myId]);

  return { roomCode, onlineClients, remoteStreams, createRoom, joinRoom, leaveRoom, kickClient, self };
};
