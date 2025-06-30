// types.ts

import { WebSocket } from 'ws';

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
        clientId: string;
    };
    senderId: string;
}

export interface OwnerInfoMessage {
    type: 'owner-info';
    payload: {
        ownerId: string;
        yourId: string;
    };
}

export interface AuthSuccessMessage {
    type: 'auth-success';
    payload: {
        clientId: string;
        playerName: string;
    };
    senderId: string;
}

export interface ErrorMessage {
    type: 'error';
    payload: {
        message: string;
        clientId: string;
    }
    senderId: string;
}

export interface disconnectMessage {
    type: 'disconnect';
    payload: {
        clientId: string;
    };
    senderId: string;
}


export type SignalingMessage = OfferMessage | AnswerMessage | IceCandidateMessage | AuthMessage | AuthSuccessMessage | ErrorMessage | disconnectMessage;

export interface CustomWebSocket extends WebSocket {
    roomCode: string;
    isOwner: boolean;
    id: string;
}