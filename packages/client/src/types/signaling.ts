
export const SignalingEvents = {
    // Events sent from client/owner
    AUTH: 'auth',
    AUTH_SUCCESS: 'auth-success',
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    DISCONNECT: 'disconnect', // Owner wants to kick a client
    ERROR: 'error', // Owner informs client of auth failure

    // Events received from server
    ROOM_CREATED: 'room-created',
    ROOM_CLOSED: 'room-closed',
    NEW_CLIENT: 'new-client', // A new client has connected
    CLIENT_DISCONNECTED: 'disconnect', // A client has disconnected
} as const;

// --- Payloads for messages ---
export interface RoomCreatedPayload { roomCode: string; yourId: string; }
export interface NewClientPayload { clientId: string; }
export interface AuthPayload { playerId: string; clientId: string; } // playerId is the 4-digit code
export interface AuthSuccessPayload { clientId: string; playerName: string; }
export interface OfferPayload { offer: RTCSessionDescriptionInit; clientId: string; }
export interface AnswerPayload { answer: RTCSessionDescriptionInit; clientId: string; }
export interface IceCandidatePayload { candidate: RTCIceCandidateInit; clientId: string; }
export interface DisconnectPayload { clientId: string; }
export interface ErrorPayload { message: string; clientId: string; }


// --- Message Structures ---
interface BaseMessage<T, P> {
    type: T;
    payload: P;
}

// Base structure for messages that are forwarded and need sender identification
interface ForwardedMessage<T, P> extends BaseMessage<T, P> {
    senderId: string;
}

// --- Messages Sent from Client to Server ---
// The client sends an auth message without its ID, as it's not known yet.
export interface ClientAuthPayload { playerId: string }
export type ClientAuthMessage = BaseMessage<typeof SignalingEvents.AUTH, ClientAuthPayload>;

// The client sends answers/ice-candidates with its ID.
export type ClientAnswerMessage = ForwardedMessage<typeof SignalingEvents.ANSWER, AnswerPayload>;
export type ClientIceCandidateMessage = ForwardedMessage<typeof SignalingEvents.ICE_CANDIDATE, IceCandidatePayload>;

export type SignalingMessageOut =
    | ClientAuthMessage
    | ForwardedMessage<typeof SignalingEvents.AUTH_SUCCESS, AuthSuccessPayload>
    | ForwardedMessage<typeof SignalingEvents.OFFER, OfferPayload>
    | ClientAnswerMessage
    | ClientIceCandidateMessage
    | ForwardedMessage<typeof SignalingEvents.DISCONNECT, DisconnectPayload>
    | ForwardedMessage<typeof SignalingEvents.ERROR, ErrorPayload>;


// --- Messages Received by Client from Server ---
// These messages are what the WebSocket's 'onmessage' event will provide.
// The server is expected to add 'senderId' to all forwarded messages.
export type SignalingMessageIn =
    | BaseMessage<typeof SignalingEvents.ROOM_CREATED, RoomCreatedPayload>
    | { type: typeof SignalingEvents.ROOM_CLOSED }
    | BaseMessage<typeof SignalingEvents.NEW_CLIENT, NewClientPayload>
    | BaseMessage<typeof SignalingEvents.CLIENT_DISCONNECTED, DisconnectPayload>
    | ForwardedMessage<typeof SignalingEvents.AUTH, AuthPayload>
    | ForwardedMessage<typeof SignalingEvents.AUTH_SUCCESS, AuthSuccessPayload>
    | ForwardedMessage<typeof SignalingEvents.OFFER, OfferPayload>
    | ForwardedMessage<typeof SignalingEvents.ANSWER, AnswerPayload>
    | ForwardedMessage<typeof SignalingEvents.ICE_CANDIDATE, IceCandidatePayload>
    | BaseMessage<typeof SignalingEvents.ERROR, { message: string }>;
