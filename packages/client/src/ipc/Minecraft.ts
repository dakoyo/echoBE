
// Electronのコンテキストブリッジで使う。ダミー。オーナーしか使用ができない

import { EventEmitter } from "events";

// プレイヤー位置の型定義
interface PlayerLocation {
  x: number;
  y: number;
  z: number;
}

// プレイヤー回転の型定義
interface PlayerRotation {
  x: number;
  y: number;
}

// プレイヤーデータの型定義
interface PlayerData {
  name: string;
  location: PlayerLocation;
  rotation: PlayerRotation;
}

// イベント定義
interface WorldEvents {
  playersJoin: (playerNames: string[]) => void; // プレイヤーがマインクラフトに入った時に発火する
  playersLeave: (playerNames: string[]) => void; // プレイヤーがマインクラフトから出た時に発火する
  tick: () => void; // マインクラフト内の1tick（0.05秒）ごとに発火する
  worldConnected: () => void; // /connect localhost:3000などのコマンドがマインクラフト内で入力され、webSocket接続が確立された時に発火する
  codeRequest: (playerName: string) => void // プレイヤーコードを生成するようにリクエストされた時に発火
}

class WorldEventEmitter extends EventEmitter {
  on<K extends keyof WorldEvents>(eventName: K, listener: WorldEvents[K]): this {
    return super.on(eventName, listener);
  }

  emit<K extends keyof WorldEvents>(eventName: K, ...args: Parameters<WorldEvents[K]>): boolean {
    return super.emit(eventName, ...args);
  }
}

class World {
  private players: Map<string, PlayerData> = new Map([
    ["Owner", { name: "Owner", location: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
    ["Steve", { name: "Steve", location: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
    ["Alex", { name: "Alex", location: { x: -10, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
  ]);
  private playerCodes: Map<string, string> = new Map(); // playerName -> playerCode

  async getOwnerName(): Promise<string> {
    return "Owner"
  }

  getPlayerNames(): string[] {
    return Array.from(this.players.keys());
  }

  getPlayerLocation(playerName: string): PlayerLocation {
    return this.players.get(playerName)?.location || { x: 0, y: 0, z: 0 };
  }

  getPlayerRotation(playerName: string): PlayerRotation {
    return this.players.get(playerName)?.rotation || { x: 0, y: 0 };
  }

  generatePlayerCodes(): void {
    this.playerCodes.clear();
    this.players.forEach((_, name) => {
      // Don't generate a code for the owner
      if (name !== "Owner") {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        this.playerCodes.set(name, code);
      }
    });
    console.log("Generated Player Codes:", this.playerCodes);
  }

  getPlayerNameByCode(code: string): string | undefined {
      for (const [name, playerCode] of this.playerCodes.entries()) {
          if (playerCode === code) {
              return name;
          }
      }
      return undefined;
  }
  
  notifyPlayersWithCodes(roomCode: string): void {
      this.playerCodes.forEach((code, name) => {
          const message = `=====EchoBE プレイヤー情報=====\nルームID：${roomCode}\nプレイヤー名：${name}\nプレイヤーコード：${code}\n===========================`;
          this.sendMessage(message, name);
      });
  }

  /**
   * マインクラフトのテキストチャット内にメッセージを書き込む
   * @param message - 送信するメッセージ内容
   * @param playerName - 送信するプレイヤーの名前（undefinedならワールド全体に送信される）
   */
  sendMessage(message: string, playerName?: string) {
    if (playerName) {
        console.log(`[Sent to ${playerName}]:\n${message}`);
    } else {
        console.log(`[Sent to all]:\n${message}`);
    }
  }

  addPlayer(name: string, location?: PlayerLocation, rotation?: PlayerRotation): void {
    this.players.set(name, {
      name,
      location: location || { x: 0, y: 0, z: 0 },
      rotation: rotation || { x: 0, y: 0 }
    });
    this.events.emit('playersJoin', [name]);
  }

  events = new WorldEventEmitter();
}

export const world = new World();
