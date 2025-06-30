// constants.ts

export const SignalingEvents = {
    ROOM_CREATED: 'room-created',
    ROOM_CLOSED: 'room-closed',
    NEW_CLIENT: 'new-client',
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    ERROR: 'error',
    DISCONNECT: 'disconnect',
    AUTH: 'auth',
    AUTH_SUCCESS: 'auth-success',
    OwnerInfo: 'owner-info',
} as const;

export const ErrorMessages = {
    ROOM_NOT_FOUND: 'Room not found',
    INVALID_MESSAGE_FORMAT: 'Invalid message format',
} as const;