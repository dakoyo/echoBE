// handler.ts
import { RawData } from "ws";
import { CustomWebSocket, SignalingMessage } from "./types.js";
import { logger } from "./logger.js";
import { SignalingEvents, ErrorMessages } from "./constants.js";

const rooms: Map<string, Set<CustomWebSocket>> = new Map();

const generateRoomCode = (): string => {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
        }
    } while (rooms.has(code));
    return code;
};

const safeJsonParse = (data: RawData): SignalingMessage | null => {
    try {
        return JSON.parse(data.toString()) as SignalingMessage;
    } catch (e) {
        logger.error(`Failed to parse incoming message: ${data.toString()}`);
        return null;
    }
};

const forwardMessage = (sender: CustomWebSocket, clientSet: Set<CustomWebSocket>, message: SignalingMessage) => {
    const targetId = message.type === SignalingEvents.OFFER || message.type === SignalingEvents.ANSWER || message.type === SignalingEvents.ICE_CANDIDATE
        ? message.payload.clientId
        : undefined;

    if (!targetId) {
        logger.warn(`Message type ${message.type} does not have a target client. Broadcasting to room.`);
        // Or handle as an error, depending on desired logic
        return;
    }

    clientSet.forEach((client) => {
        if (client.id === targetId && client !== sender) {
            logger.debug(`Forwarding message type ${message.type} from ${sender.id} to ${client.id}`);
            client.send(JSON.stringify(message));
        }
    });
};

export function handleOwnerConnection(ws: CustomWebSocket) {
    ws.isOwner = true;
    const newRoomCode = generateRoomCode();
    ws.roomCode = newRoomCode;

    const clientSet = new Set<CustomWebSocket>();
    clientSet.add(ws);
    rooms.set(newRoomCode, clientSet);

    logger.info(`Owner ${ws.id} connected and created room ${newRoomCode}`);
    ws.send(JSON.stringify({ type: SignalingEvents.ROOM_CREATED, payload: { roomCode: newRoomCode, yourId: ws.id } }));

    ws.on("message", (data: RawData) => {
        const message = safeJsonParse(data);
        if (!message) return;

        logger.debug(`Owner ${ws.id} in room ${ws.roomCode} sent message: ${JSON.stringify(message)}`);

        switch (message.type) {
            case SignalingEvents.ERROR:
                const clientWs = Array.from(clientSet).find(client => client.id === message.senderId);
                if (clientWs) {
                    logger.warn(`Relaying error message to client ${clientWs.id} and closing connection.`);
                    clientWs.send(JSON.stringify(message));
                    clientWs.close();
                }
                break;
            case SignalingEvents.AUTH:
            case SignalingEvents.ANSWER:
            case SignalingEvents.OFFER:
            case SignalingEvents.ICE_CANDIDATE:
                forwardMessage(ws, clientSet, message);
                break;
            case SignalingEvents.DISCONNECT:
                const clientToDisconnect = Array.from(clientSet).find(c => c.id === message.payload.clientId);
                if (clientToDisconnect) {
                    logger.info(`Disconnecting client ${clientToDisconnect.id} from room ${ws.roomCode} by owner's request.`);
                    clientToDisconnect.send(JSON.stringify({ type: SignalingEvents.DISCONNECT, payload: { message: "Disconnected by owner" } }));
                    clientToDisconnect.close();
                    clientSet.delete(clientToDisconnect);
                }
                break;
            default:
                logger.warn(`Owner ${ws.id} sent unhandled message type: ${message.type}`);
                break;
        }
    });

    ws.on("close", () => {
        logger.info(`Owner ${ws.id} disconnected. Closing room ${newRoomCode}.`);
        clientSet.forEach((client) => {
            if (client !== ws) {
                client.send(JSON.stringify({ type: SignalingEvents.ROOM_CLOSED }));
                client.close();
            }
        });
        rooms.delete(newRoomCode);
        logger.info(`Room ${newRoomCode} has been deleted.`);
    });
}

export function handleClientConnection(ws: CustomWebSocket, roomCode: string) {
    const clientSet = rooms.get(roomCode);

    if (!clientSet) {
        logger.warn(`Client ${ws.id} attempted to connect to non-existent room ${roomCode}`);
        ws.send(JSON.stringify({ type: SignalingEvents.ERROR, payload: { message: ErrorMessages.ROOM_NOT_FOUND } }));
        ws.close();
        return;
    }

    clientSet.add(ws);
    ws.roomCode = roomCode;

    const ownerWs = Array.from(clientSet).find(client => client.isOwner);

    if (!ownerWs) {
        logger.error(`Room ${roomCode} exists but has no owner. Closing connection for client ${ws.id}.`);
        ws.send(JSON.stringify({ type: SignalingEvents.ERROR, payload: { message: "Room has no owner." } }));
        ws.close();
        clientSet.delete(ws);
        return;
    }

    logger.info(`Client ${ws.id} connected to room ${roomCode}`);
    ownerWs.send(JSON.stringify({ type: SignalingEvents.NEW_CLIENT, payload: { clientId: ws.id } }));

    ws.on("message", (data: RawData) => {
        const message = safeJsonParse(data);
        if (!message) return;

        logger.debug(`Client ${ws.id} in room ${ws.roomCode} sent message: ${JSON.stringify(message)}`);

        switch (message.type) {
            case SignalingEvents.OFFER:
            case SignalingEvents.ANSWER:
            case SignalingEvents.ICE_CANDIDATE:
                logger.debug(`Forwarding message from client ${ws.id} to owner ${ownerWs.id}`);
                ownerWs.send(JSON.stringify(message));
                break;
            default:
                logger.warn(`Client ${ws.id} sent unhandled message type: ${message.type}`);
                break;
        }
    });

    ws.on("close", () => {
        logger.info(`Client ${ws.id} disconnected from room ${roomCode}`);
        clientSet.delete(ws);
        if (ownerWs) {
            ownerWs.send(JSON.stringify({ type: SignalingEvents.DISCONNECT, payload: { clientId: ws.id } }));
        }
    });
}