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
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

export const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
export const RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per second