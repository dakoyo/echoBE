
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
    // Note: OFFER, ANSWER, ICE_CANDIDATE, AUTH are forwarded by the server and also received
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
    senderId: string;
}

// Messages sent TO the server
export type SignalingMessageOut =
    | Omit<BaseMessage<typeof SignalingEvents.AUTH, AuthPayload>, 'senderId'>
    | BaseMessage<typeof SignalingEvents.AUTH_SUCCESS, AuthSuccessPayload>
    | BaseMessage<typeof SignalingEvents.OFFER, OfferPayload>
    | BaseMessage<typeof SignalingEvents.ANSWER, AnswerPayload>
    | BaseMessage<typeof SignalingEvents.ICE_CANDIDATE, IceCandidatePayload>
    | BaseMessage<typeof SignalingEvents.DISCONNECT, DisconnectPayload>
    | BaseMessage<typeof SignalingEvents.ERROR, ErrorPayload>;


// Messages received FROM the server
export type SignalingMessageIn =
    | { type: typeof SignalingEvents.ROOM_CREATED, payload: RoomCreatedPayload }
    | { type: typeof SignalingEvents.ROOM_CLOSED }
    | { type: typeof SignalingEvents.NEW_CLIENT, payload: NewClientPayload }
    | { type: typeof SignalingEvents.CLIENT_DISCONNECTED, payload: DisconnectPayload }
    | BaseMessage<typeof SignalingEvents.AUTH, AuthPayload>
    | BaseMessage<typeof SignalingEvents.AUTH_SUCCESS, AuthSuccessPayload>
    | BaseMessage<typeof SignalingEvents.OFFER, OfferPayload>
    | BaseMessage<typeof SignalingEvents.ANSWER, AnswerPayload>
    | BaseMessage<typeof SignalingEvents.ICE_CANDIDATE, IceCandidatePayload>
    | { type: typeof SignalingEvents.ERROR, payload: { message: string } };
