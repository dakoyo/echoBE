export interface RoomCreatedMessage {
    type: 'room-created';
    payload: {
        roomCode: string;
        yourId: string;
    };
}

export interface OwnerInfoMessage {
    type: 'owner-info';
    payload: {
        ownerId: string;
        yourId: string;
    };
}

export interface NewClientMessage {
    type: 'new-client';
    payload: {
        clientId: string;
    };
}

export interface OfferMessage {
    type: 'offer';
    payload: {
        offer: RTCSessionDescriptionInit;
        clientId: string;
    };
    senderId: string;
}

export interface AnswerMessage {
    type: 'answer';
    payload: {
        answer: RTCSessionDescriptionInit;
        clientId: string;
    };
    senderId: string;
}

export interface IceCandidateMessage {
    type: 'ice-candidate';
    payload: {
        candidate: RTCIceCandidateInit;
        clientId: string;
    };
    senderId: string;
}

export interface AuthMessage {
    type: 'auth';
    payload: {
        playerId: string;
        clientId: string; // Recipient (owner) ID
    };
    senderId: string;
}

export interface AuthSuccessMessage {
    type: 'auth-success';
    payload: {
        clientId: string;
        playerName: string;
    };
    senderId?: string;
}

export interface ErrorMessage {
    type: 'error';
    payload: {
        message: string;
        clientId?: string;
    };
    senderId?: string;
}

export interface disconnectMessage {
    type: 'disconnect';
    payload: {
        clientId: string;
    };
    senderId?: string;
}

export interface RoomClosedMessage {
    type: 'room-closed';
}

export type SignalingMessage = 
    | RoomCreatedMessage
    | OwnerInfoMessage
    | NewClientMessage
    | OfferMessage 
    | AnswerMessage 
    | IceCandidateMessage 
    | AuthMessage 
    | AuthSuccessMessage 
    | ErrorMessage 
    | disconnectMessage
    | RoomClosedMessage;

// Data Channel Message Types
interface BaseDataChannelMessage<T, P> {
  'data-channel-type': T;
  payload: P;
  senderId: string; // Original sender's ID
}

export interface ClientJoinedDataMessage extends BaseDataChannelMessage<'client-joined', { id: string; name: string }> {}
export interface ClientLeftDataMessage extends BaseDataChannelMessage<'client-left', { clientId: string }> {}
export interface RoomStateDataMessage extends BaseDataChannelMessage<'room-state', { players: {id: string; name: string}[] }> {}
export interface OfferDataMessage extends BaseDataChannelMessage<'offer', { sdp: RTCSessionDescriptionInit; clientId: string }> {}
export interface AnswerDataMessage extends BaseDataChannelMessage<'answer', { sdp: RTCSessionDescriptionInit; clientId: string }> {}
export interface IceCandidateDataMessage extends BaseDataChannelMessage<'ice-candidate', { candidate: RTCIceCandidateInit; clientId: string }> {}
export interface ChatDataMessage extends BaseDataChannelMessage<'chat', { text: string }> {}
export interface ChatBroadcastDataMessage extends BaseDataChannelMessage<'chat-broadcast', { senderName: string; text: string }> {}
export interface GameSettingDataMessage extends BaseDataChannelMessage<'game-setting', { audioRange: number; spectatorVoice: boolean }> {}
export interface PlayerStatusDataMessage extends BaseDataChannelMessage<'player-status', { isMuted: boolean; isDeafened: boolean }> {}
export interface PlayerStatusUpdateBroadcastDataMessage extends BaseDataChannelMessage<'player-status-update-broadcast', { clientId: string; isMuted: boolean; isDeafened: boolean }> {}


export type DataChannelMessage = 
    | ClientJoinedDataMessage
    | ClientLeftDataMessage
    | RoomStateDataMessage
    | OfferDataMessage
    | AnswerDataMessage
    | IceCandidateDataMessage
    | ChatDataMessage
    | ChatBroadcastDataMessage
    | GameSettingDataMessage
    | PlayerStatusDataMessage
    | PlayerStatusUpdateBroadcastDataMessage;
