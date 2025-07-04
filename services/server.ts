// server.ts
import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { CustomWebSocket } from './types.js';
import { handleOwnerConnection, handleClientConnection } from './handlers.js';
import { logger } from './logger.js';

const app = express();

app.use(cors());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
    const { url } = req;
    if (!url) {
        logger.warn('Connection attempt with no URL. Terminating.');
        ws.terminate();
        return;
    }

    const requestUrl = new URL(url, `ws://${req.headers.host}`);
    const { pathname } = requestUrl;

    logger.info(`Incoming connection attempt to: ${pathname}`);

    const ownerPathRegex = /^\/ws\/?$/; // /ws or /ws/
    const clientPathRegex = /^\/ws\/([A-Z]{6})$/; // /ws/ABCDEF

    ws.id = crypto.randomUUID();
    ws.isOwner = false;

    const isOwner = ownerPathRegex.test(pathname);
    const clientMatch = pathname.match(clientPathRegex);

    if (isOwner) {
        logger.info(`Connection from ${ws.id} is an Owner.`);
        handleOwnerConnection(ws);
    } else if (clientMatch) {
        const roomCode = clientMatch[1];
        logger.info(`Connection from ${ws.id} is a Client for room ${roomCode}.`);
        handleClientConnection(ws, roomCode);
    } else {
        logger.warn(`Invalid connection URL: ${pathname}. Terminating connection for ${ws.id}.`);
        ws.terminate();
        return;
    }

    ws.on('error', (error) => {
        logger.error(`WebSocket error for connection ${ws.id}: ${error.message}`);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    logger.info(`Signaling server started on port ${PORT}`);
});