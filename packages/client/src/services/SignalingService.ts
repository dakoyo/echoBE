

import { EventEmitter } from 'events';
import { Player } from '../models/Player.js';
import { world } from '../ipc/Minecraft.js';
import type { SignalingMessage, OfferMessage, AnswerMessage, IceCandidateMessage, AuthMessage, AuthSuccessMessage, ErrorMessage, disconnectMessage, RoomCreatedMessage, NewClientMessage, OwnerInfoMessage, DataChannelMessage, OfferDataMessage, AnswerDataMessage, IceCandidateDataMessage, ClientJoinedDataMessage, RoomStateDataMessage, ChatDataMessage, ChatBroadcastDataMessage, ClientLeftDataMessage } from '../types/signaling.js';

const SIGNALING_SERVER_URL = 'ws://localhost:8080';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

type Role = 'owner' | 'player';

export class SignalingService extends EventEmitter {
  private ws: WebSocket | null = null;
  private role: Role;
  private localStream: MediaStream;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private playerNames: Map<string, string> = new Map();
  public clientId: string | null = null;
  public ownerId: string | null = null;
  private persistentPeers: Set<string> = new Set();
  private expectingDisconnectFor: Set<string> = new Set();

  constructor(role: Role, localStream: MediaStream, owner?: Player) {
    super();
    this.role = role;
    this.localStream = localStream;
    if (owner) {
      this.playerNames.set(owner.signalingId!, owner.name);
    }
  }

  connect(roomCode?: string) {
    const url = this.role === 'owner' ? `${SIGNALING_SERVER_URL}/ws` : `${SIGNALING_SERVER_URL}/ws/${roomCode}`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      console.log(`WebSocket connected to ${url}`);
      this.emit('open');
    };
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = (err) => console.error('WebSocket error:', err);
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.role === 'player' && this.persistentPeers.size > 0) {
        console.log('Player WebSocket closed, but maintaining persistent WebRTC connection.');
        return;
      }
      this.cleanup();
    };
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as SignalingMessage;
      console.log('Received message:', message);

      switch (message.type) {
        case 'room-created':
          this.clientId = (message as RoomCreatedMessage).payload.yourId;
          this.playerNames.set(this.clientId!, 'Owner'); // Set owner name early
          this.emit('room-created', (message as RoomCreatedMessage).payload);
          break;
        case 'owner-info':
          if (this.role === 'player') {
            const { ownerId, yourId } = (message as OwnerInfoMessage).payload;
            this.ownerId = ownerId;
            this.clientId = yourId;
            this.emit('connected-with-id', { ownerId });
          }
          break;
        case 'new-client':
            this.emit('new-client', (message as NewClientMessage).payload);
            break;
        case 'auth':
          if (this.role === 'owner') {
            this.handleAuth(message as AuthMessage);
          }
          break;
        case 'auth-success':
            const payload = (message as AuthSuccessMessage).payload;
            if (this.role === 'player') {
              this.clientId = payload.clientId;
              this.playerNames.set(payload.clientId, payload.playerName);
            }
            this.emit('auth-success', payload);
            if (this.role === 'player' && message.senderId) {
                // Connect to owner
                this.initiateWebRTCOffer(message.senderId, true);
            }
            break;
        case 'offer':
          if (this.role === 'owner') {
            this.handleOffer(message as OfferMessage);
          }
          break;
        case 'answer':
          if (this.role === 'player') {
            this.handleAnswer(message as AnswerMessage);
          }
          break;
        case 'ice-candidate':
          this.handleIceCandidate(message as IceCandidateMessage);
          break;
        case 'disconnect':
          this.handleDisconnect((message as disconnectMessage));
          break;
        case 'error':
            this.emit('error', (message as ErrorMessage).payload);
            break;
        case 'room-closed':
            alert('ルームがオーナーによって閉じられました。');
            this.emit('room-closed');
            this.close();
            break;
        default:
          console.warn('Unknown message type:', (message as any).type);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', event.data, error);
    }
  }

  private async createPeerConnection(peerId: string, createDataChannel: boolean): Promise<RTCPeerConnection> {
    console.log(`Creating peer connection to ${peerId}. Data channel: ${createDataChannel}`);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (this.role === 'owner') {
            // Owner is always signaling with a player directly via WebSocket
            this.sendMessage({
              type: 'ice-candidate',
              payload: { candidate: event.candidate.toJSON(), clientId: peerId },
              senderId: this.clientId!,
            });
        } else {
            // Player is signaling.
            // If it's with the owner, use WebSocket.
            // If it's with another player, use data channel relay via owner.
            if (peerId === this.ownerId) {
                 this.sendMessage({
                  type: 'ice-candidate',
                  payload: { candidate: event.candidate.toJSON(), clientId: peerId },
                  senderId: this.clientId!,
                });
            } else {
                this.sendDataChannelMessage({
                    'data-channel-type': 'ice-candidate',
                    payload: { candidate: event.candidate.toJSON(), clientId: peerId },
                    senderId: this.clientId!,
                });
            }
        }
      }
    };
    
    pc.ontrack = (event) => {
      console.log('Track received from', peerId, event.streams[0]);
      this.emit('stream-added', peerId, event.streams[0]);
    };
    
    pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Peer ${peerId} connection state changed to: ${pc.connectionState}`);
        if(pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            console.error(`[WebRTC] Peer ${peerId} disconnected or failed. Cleaning up.`);
            this.closePeerConnection(peerId);
        }
    };

    if (createDataChannel) {
        // Only the player initiating connection to the owner creates the data channel.
        const dataChannel = pc.createDataChannel('main-signaling');
        this.setupDataChannel(peerId, dataChannel);
    } else if (this.role === 'owner') {
        // Owner sets up listener for incoming data channel from new player
        pc.ondatachannel = (event) => {
            console.log('[Owner] Data channel received from player:', event.channel.label);
            this.setupDataChannel(peerId, event.channel);
        };
    }

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
      this.dataChannels.set(peerId, channel);
      console.log(`Data channel to ${peerId} has been set up.`);

      channel.onopen = () => {
        console.log(`Data channel with ${peerId} is open.`);
        if (this.role === 'owner') {
          // 1. Send the new player the current room state.
          const players = Array.from(this.dataChannels.keys())
            .filter(id => id !== peerId)
            .map(id => ({ id, name: this.playerNames.get(id) || 'Unknown' }));
          
          this.sendDataChannelMessage({
            'data-channel-type': 'room-state',
            payload: { players },
            senderId: this.clientId!,
          }, peerId);

          // 2. Announce the new player to everyone else.
          const newPlayerName = this.playerNames.get(peerId) || 'Unknown';
          this.broadcastDataChannelMessage({
              'data-channel-type': 'client-joined',
              payload: { id: peerId, name: newPlayerName },
              senderId: this.clientId!,
          }, peerId);

          // 3. Mark for persistence and disconnect WebSocket.
          this.persistentPeers.add(peerId);
          this.expectingDisconnectFor.add(peerId);
          this.sendMessage({ type: 'disconnect', payload: { clientId: peerId }, senderId: this.clientId! });
        } else { // Player role
          // This is the crucial fix. When the data channel to the owner is open,
          // the player must mark this connection as persistent so it isn't
          // cleaned up when the websocket is intentionally closed.
          if (peerId === this.ownerId) {
              this.persistentPeers.add(this.ownerId);
              console.log(`Player has established persistent connection with owner ${this.ownerId}`);
          }
        }
      };

      channel.onmessage = (event) => this.handleDataChannelMessage(event);
      channel.onclose = () => { console.log(`Data channel with ${peerId} is closed.`); this.dataChannels.delete(peerId); };
      channel.onerror = (error) => console.error(`Data channel error with ${peerId}:`, error);
  }

  private handleDataChannelMessage(event: MessageEvent) {
    if (typeof event.data !== 'string') return;
    try {
        const message = JSON.parse(event.data) as DataChannelMessage;

        if (this.role === 'owner') {
            if (message['data-channel-type'] === 'chat') {
                const senderName = this.playerNames.get(message.senderId) || 'Unknown';
                const chatPayload = { senderName, text: message.payload.text };

                // Broadcast to other players, EXCLUDING the original sender.
                this.broadcastDataChannelMessage({
                    'data-channel-type': 'chat-broadcast',
                    payload: chatPayload,
                    senderId: message.senderId
                }, message.senderId);
                
                // Emit for owner's own UI.
                this.emit('chat-message', chatPayload);

            } else if (
                message['data-channel-type'] === 'offer' ||
                message['data-channel-type'] === 'answer' ||
                message['data-channel-type'] === 'ice-candidate'
            ) {
                // These are WebRTC signaling messages to be relayed to another player.
                const targetId = message.payload.clientId;
                const recipientDataChannel = this.dataChannels.get(targetId);
                if (recipientDataChannel?.readyState === 'open') {
                    recipientDataChannel.send(event.data);
                } else {
                    console.warn(`[Owner Relay] Could not find open data channel for target ${targetId}`);
                }
            }
        } else { // Player role
            switch (message['data-channel-type']) {
                case 'room-state':
                    this.emit('room-state-received', (message as RoomStateDataMessage).payload.players);
                    break;
                case 'client-joined':
                    const { id, name } = (message as ClientJoinedDataMessage).payload;
                    this.playerNames.set(id, name);
                    this.emit('new-peer-discovered', { id, name });
                    this.initiatePeerToPeerOffer(id, false);
                    break;
                case 'client-left':
                    this.closePeerConnection((message as ClientLeftDataMessage).payload.clientId);
                    break;
                case 'offer':
                    this.handlePeerToPeerOffer(message as OfferDataMessage);
                    break;
                case 'answer':
                    this.handlePeerToPeerAnswer(message as AnswerDataMessage);
                    break;
                case 'ice-candidate':
                    this.handlePeerToPeerIceCandidate(message as IceCandidateDataMessage);
                    break;
                case 'chat-broadcast':
                    this.emit('chat-message', (message as ChatBroadcastDataMessage).payload);
                    break;
            }
        }
    } catch (error) {
        console.error('Failed to parse data channel message:', event.data, error);
    }
  }
  
  private handleAuth(message: AuthMessage) {
    if (this.role !== 'owner') return;
    const playerName = world.getPlayerNameByCode(message.payload.playerId);
    if (playerName) {
        this.playerNames.set(message.senderId, playerName);
        this.sendMessage({
            type: 'auth-success',
            payload: { clientId: message.senderId, playerName },
            senderId: this.clientId!,
        });
        this.emit('auth-success', { clientId: message.senderId, playerName });
    } else {
        this.sendMessage({
            type: 'error',
            payload: { message: 'Invalid player code', clientId: message.senderId },
            senderId: this.clientId!,
        });
    }
  }
  
  private async initiateWebRTCOffer(peerId: string, createDataChannel: boolean) {
      const pc = await this.createPeerConnection(peerId, createDataChannel);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendMessage({
        type: 'offer',
        payload: { offer, clientId: peerId },
        senderId: this.clientId!,
      });
  }

  private async handleOffer(message: OfferMessage) {
    if (this.role !== 'owner') return;
    const playerClientId = message.senderId;
    const pc = await this.createPeerConnection(playerClientId, false); // Owner never creates data channel
    await pc.setRemoteDescription(new RTCSessionDescription(message.payload.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendMessage({
      type: 'answer',
      payload: { answer, clientId: playerClientId },
      senderId: this.clientId!,
    });
  }

  private async handleAnswer({ payload, senderId }: AnswerMessage) {
    const pc = this.peerConnections.get(senderId!);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
    }
  }

  private async handleIceCandidate({ payload, senderId }: IceCandidateMessage) {
    const pc = this.peerConnections.get(senderId!);
    if (pc && payload.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) { console.error('Error adding received ice candidate', e); }
    }
  }

  private async initiatePeerToPeerOffer(peerId: string, createDataChannel: boolean) {
      const pc = await this.createPeerConnection(peerId, createDataChannel);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendDataChannelMessage({
          'data-channel-type': 'offer',
          payload: { sdp: offer, clientId: peerId },
          senderId: this.clientId!
      });
  }

  private async handlePeerToPeerOffer(message: OfferDataMessage) {
      const peerId = message.senderId;
      const pc = await this.createPeerConnection(peerId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendDataChannelMessage({
          'data-channel-type': 'answer',
          payload: { sdp: answer, clientId: peerId },
          senderId: this.clientId!
      });
  }

  private async handlePeerToPeerAnswer(message: AnswerDataMessage) {
      const pc = this.peerConnections.get(message.senderId);
      if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload.sdp));
      }
  }

  private async handlePeerToPeerIceCandidate(message: IceCandidateDataMessage) {
      const pc = this.peerConnections.get(message.senderId);
      if (pc && message.payload.candidate) {
          try {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload.candidate));
          } catch (e) { console.error(`Error adding P2P ice candidate from ${message.senderId}`, e); }
      }
  }

  private handleDisconnect({ payload }: disconnectMessage) {
    const peerId = payload.clientId;
    if (this.expectingDisconnectFor.has(peerId)) {
      this.expectingDisconnectFor.delete(peerId);
      console.log(`Ignoring expected disconnect for ${peerId}`);
      return;
    }
    
    // Notify all other clients that this one has left.
    if(this.role === 'owner'){
        this.broadcastDataChannelMessage({
            'data-channel-type': 'client-left',
            payload: { clientId: peerId },
            senderId: this.clientId!,
        }, peerId); // Don't send it to the guy who is already gone
    }
    
    this.closePeerConnection(peerId);
    this.emit('disconnect', payload);
  }

  public sendAuth(playerCode: string, ownerId: string) {
    if (this.role === 'player' && this.ws?.readyState === WebSocket.OPEN && this.clientId) {
      this.sendMessage({
        type: 'auth',
        payload: { playerId: playerCode, clientId: ownerId },
        senderId: this.clientId,
      });
    }
  }
  
  public sendChatMessage(text: string) {
    if (this.role === 'owner') {
        const senderName = this.playerNames.get(this.clientId!) || 'Owner';
        this.broadcastDataChannelMessage({
            'data-channel-type': 'chat-broadcast',
            payload: { senderName, text },
            senderId: this.clientId!,
        });
    } else {
        // Player sends chat message to owner for relay
        this.sendDataChannelMessage({
            'data-channel-type': 'chat',
            payload: { text },
            senderId: this.clientId!,
        });
    }
  }

  private sendDataChannelMessage(message: DataChannelMessage, targetId?: string) {
    const recipientDataChannel = this.dataChannels.get(targetId || this.ownerId!);
    if (recipientDataChannel && recipientDataChannel.readyState === 'open') {
      recipientDataChannel.send(JSON.stringify(message));
    } else {
      console.warn(`Could not send DC message to ${targetId || this.ownerId}. Channel not open.`);
    }
  }
  
  private broadcastDataChannelMessage(message: DataChannelMessage, exceptForId?: string) {
    this.dataChannels.forEach((channel, id) => {
        if (id !== exceptForId && channel.readyState === 'open') {
            channel.send(JSON.stringify(message));
        }
    });
  }

  public disconnectClient(clientId: string) {
    this.sendMessage({ type: 'disconnect', payload: { clientId }, senderId: this.clientId! });
    this.closePeerConnection(clientId);
  }
  
  private sendMessage(message: Omit<Extract<SignalingMessage, { payload: any }>, 'senderId'> & { senderId: string }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
      this.persistentPeers.delete(peerId);
      this.dataChannels.delete(peerId);
      this.playerNames.delete(peerId);
      this.emit('stream-removed', peerId);
      console.log(`Peer connection with ${peerId} closed.`);
    }
  }

  private cleanup() {
    Array.from(this.peerConnections.keys()).forEach(peerId => this.closePeerConnection(peerId));
    this.peerConnections.clear();
    this.persistentPeers.clear();
    this.dataChannels.clear();
    this.expectingDisconnectFor.clear();
  }

  close() {
    this.cleanup();
    if(this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
        this.ws?.close();
    }
  }
}