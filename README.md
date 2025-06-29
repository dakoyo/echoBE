あなたにはこれからMinecraft統合版のプロキシミティチャットを制作していただきます。まずはシグナリング機構から作成して下さい。こちらのフロントエンドのUIをElectronアプリのものだと仮定し、コンテキストブリッジを使って作成して下さい。

# 概要
プレイヤーはオーナー、クライアントに分かれます。オーナーが「ルームを作成」を押してルームを作ったプレイヤー、クライアントが「ルームに参加」で参加するプレイヤーになります。

1. オーナー
オーナーは、Minecraftでワールドを開き、Electronアプリを開きます。そして、ルームを作成ボタンを押し、出てきた/connectコマンドをマインクラフト内で入力することにより、MinecraftとElectronアプリを繋げます。Electronアプリでは、それぞれのプレイヤーの座標の取得、首の向きの取得が行われます。それをコンテキストブリッジを通じてUIに渡します。

2. クライアント
オーナーのワールドに参加するプレイヤーです。ワールドに参加すると、テキストチャットにルームID（アルファベット6桁）とプレイヤーコード（数字4桁）が表示されます。クライアントはアプリでルームに参加ボタンを押し、ルームID、プレイヤーコードを入力しMinecraftと同じプレイヤー名として認証を行います。
認証が成功したらwebRTC接続を確立します。接続が確立できたらシグナリングサーバーとの接続をきり、オーナーのdataChannelを通じて他の既存プレイヤーとのシグナリングを行います

プレイヤーコードはUI側でオーナーがプレイヤーごとに生成し、送られてきたプレイヤーコードの内容から、その送り主がどのプレイヤーかを特定します。

# 通信について
シグナリングサーバーのコードは次のとおりです。
```ts
// server.ts
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { CustomWebSocket } from './types.js';
import { handleOwnerConnection, handleClientConnection } from './handlers.js';
import { logger } from './logger.js';

const app = express();
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
```

```ts
// handlers.ts
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
```

```
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
} as const;

export const ErrorMessages = {
    ROOM_NOT_FOUND: 'Room not found',
    INVALID_MESSAGE_FORMAT: 'Invalid message format',
} as const;
```

```
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

export interface AuthSuccessMessage {
    type: 'auth-success';
    payload: {
        playerId: string;
        clientId: string;
        playerName: string;
    };
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
```

```ts
//logger.ts

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

type Color = keyof typeof colors;

const log = (message: string, color: Color = 'reset', label: string) => {
    const timestamp = new Date().toISOString();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${label}${colors.reset} ${message}`);
};

export const logger = {
    info: (message: string) => log(message, 'green', ' [INFO]'),
    warn: (message: string) => log(message, 'yellow', '[WARN] '),
    error: (message: string) => log(message, 'red', ' [ERROR]'),
    debug: (message: string) => log(message, 'magenta', '[DEBUG]'),
};
```

こちらを見るとわかるとおり、次のような通信が行われています。順番に詳細に説明します。

## 通信フロー詳細

### 1. オーナーの接続確立プロセス

1. **Minecraftとの接続**
   - オーナーがElectronアプリでルーム作成ボタンを押す
   - オーナーは出てきたコマンドをコピーしMinecraftで `/connect` コマンドを実行
   - Minecraftとオーナーのアプリが接続される

2. **ルーム作成とWebSocket接続**
   - サーバーのエンドポイント `/ws` にWebSocket接続を確立
   - サーバーは接続を検出し、`handleOwnerConnection`関数を実行
   - サーバーは6桁の英字大文字のルームコード（例：`ABCDEF`）を生成
   - サーバーはオーナーに `room-created` イベントを送信し、ルームコードとオーナーIDを通知
   ```json
   {
     "type": "room-created", 
     "payload": {
       "roomCode": "ABCDEF", 
       "yourId": "550e8400-e29b-41d4-a716-446655440000"
     }
   }
   ```
   - オーナーは現在ワールドにいるプレイヤーに対してプレイヤー特定用の4桁数字コードを作成、また、コンテキストブリッジの`playersJoin`イベントや`playersLeave`イベントを購読、それらの新規プレイヤーに対してもプレイヤーコードを生成し、プレイヤーが退出した場合はコードを消す。
   - オーナーはコンテキストブリッジの`world.sendMessage`で、マインクラフトでそれぞれのプレイヤーに対して対応するプレイヤーコードとルームIDを特定のプレイヤーのテキストチャットに書き込む
   ```json 
   =====EchoBE プレイヤー情報=====
   ルームID：ABCDEF
   プレイヤーコード：1234
   ===========================
   ```



### 2. クライアントの接続プロセス

1. **ルーム参加とWebSocket接続**
   - クライアントはMinecraftでオーナーのワールドに参加
   - テキストチャットにルームID（6桁英字）とプレイヤーコード（4桁数字）が表示される
   - クライアントはアプリでルーム参加ボタンを押し、ルームIDとプレイヤーコードを入力
   - サーバーのエンドポイント `/ws/{ルームコード}` にWebSocket接続を確立
   - サーバーは接続を検出し、`handleClientConnection`関数を実行
   - サーバーはルームの存在を確認し、存在しない場合はエラーを返して接続を閉じる
   ```json
   {
     "type": "error", 
     "payload": {
       "message": "Room not found"
     }
   }
   ```

2. **オーナーへの通知**
   - ルームが存在する場合、サーバーはオーナーに新しいクライアントの接続を通知
   ```json
   {
     "type": "new-client", 
     "payload": {
       "clientId": "550e8400-e29b-41d4-a716-446655440001"
     }
   }
   ```

### 3. 認証プロセス

1. **プレイヤー認証**
   - クライアントはオーナーに認証メッセージを送信（プレイヤーコードを含む）
   - サーバーはこのメッセージをオーナーに転送
   ```json
   {
     "type": "auth", 
     "payload": {
       "playerId": "1234",  // プレイヤーコード
       "clientId": "550e8400-e29b-41d4-a716-446655440001"
     },
     "senderId": "550e8400-e29b-41d4-a716-446655440001"
   }
   ```
   - オーナーはプレイヤーコードを確認し、該当するMinecraftプレイヤーと紐付け
   - 認証に成功した場合、オーナーはクライアントに認証成功メッセージを送信
   ```json
   {
       type: 'auth-success';
       payload: {
           clientId: "550e8400-e29b-41d4-a716-446655440001";
           playerName: "Steve";
       };
   }
   ```
   - 認証に失敗した場合オーナーはエラーメッセージを送信
   ```json
   {
     "type": "error", 
     "payload": {
       "message": "Faild to auth",
       "clientId": "550e8400-e29b-41d4-a716-446655440001"
     },
     "senderId": "550e8400-e29b-41d4-a716-446655440001"
   }
   ```
   - エラーメッセージを検知したサーバーは自動的に対象クライアントをクローズ

### 4. WebRTC接続確立

1. **シグナリングプロセス**
   - オーナーがクライアントにOffer SDPを送信
   ```json
   {
     "type": "offer",
     "payload": {
       "offer": {/* RTCSessionDescriptionInit オブジェクト */},
       "clientId": "550e8400-e29b-41d4-a716-446655440001"
     },
     "senderId": "550e8400-e29b-41d4-a716-446655440000"
   }
   ```
   - クライアントがオーナーにAnswer SDPを送信
   ```json
   {
     "type": "answer",
     "payload": {
       "answer": {/* RTCSessionDescriptionInit オブジェクト */},
       "clientId": "550e8400-e29b-41d4-a716-446655440000"
     },
     "senderId": "550e8400-e29b-41d4-a716-446655440001"
   }
   ```
   - 双方がICE候補を交換
   ```json
   {
     "type": "ice-candidate",
     "payload": {
       "candidate": {/* RTCIceCandidateInit オブジェクト */},
       "clientId": "550e8400-e29b-41d4-a716-446655440001"  // 送信先ID
     },
     "senderId": "550e8400-e29b-41d4-a716-446655440000"  // 送信元ID
   }
   ```

2. **P2P接続確立**
   - WebRTC接続が確立されると、クライアントはシグナリングサーバーとの接続を維持しつつ
   - オーナーとの直接的なデータチャネル（WebRTC DataChannel）を確立
   - 以降の通信はこのデータチャネルを通じて行われる

### 5. 他のクライアントとの接続

1. **既存プレイヤーとの接続**
   - 新しいクライアントが参加すると、オーナーは既存のクライアントとの接続を仲介
   - オーナーのDataChannelを通じて、新規クライアントと既存クライアント間でシグナリング情報を交換
   - クライアント同士のP2P接続が確立される

### 6. 切断プロセス

1. **クライアントの切断**
   - クライアントがアプリを閉じると、WebSocket接続が切断される
   - サーバーはオーナーにクライアントの切断を通知
   ```json
   {
     "type": "disconnect", 
     "payload": {
       "clientId": "550e8400-e29b-41d4-a716-446655440001"
     }
   }
   ```
   - オーナーは他のクライアントにもこの情報を転送

2. **オーナーの切断**
   - オーナーがアプリを閉じると、WebSocket接続が切断される
   - サーバーは全クライアントにルーム閉鎖を通知し、接続を閉じる
   ```json
   {
     "type": "room-closed"
   }
   ```
   - サーバーはルーム情報を削除

このように、シグナリングサーバーを介してオーナーとクライアント間で初期接続を確立し、その後WebRTCのP2P接続に移行することで、効率的な通信を実現しています。オーナーはMinecraftからプレイヤー情報を取得し、それをElectronアプリを通じてUIに表示します。

## 詳細な機構
* テストとして、ボイスルームではマイク音声をMediaStreamTrackとしてストリームして、再生するようにして下さい。特に音声処理はまだ施さなくていいです。
* ルーム作成ボタンを押すと、/connect localhost:3000のようなコマンドが表示されます。本来なら`world.events.on("worldConnected")`が発火しないとその画面から転移しませんが、今回はテストとして、数秒経ったらそのイベントをemitして進んで構いません。
* ワールドには存在するが、ルームには存在しないプレイヤーはオフラインとして表示し、ルームに参加したらオンラインにして下さい

## 指示
あなたには、これらのシグナリング機構をまず作成して欲しいです。
シグナリングサーバーのURLは、http://localhost:8080です。
この説明文章をよく読み、入念な確認をした上で開発を進めて下さい。特にシグナリングに関しては、ちゃんと通信が則ったものになっているかよく確認して下さい。