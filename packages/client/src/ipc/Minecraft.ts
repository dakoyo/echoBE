// @ts-nocheck
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
  isSpectator: boolean;
}

// イベント定義
interface WorldEvents {
  playerJoin: (ev: { playerName: string }) => void; // プレイヤーがマインクラフトに入った時に発火する
  playerLeave: (ev: { playerName: string }) => void; // プレイヤーがマインクラフトから出た時に発火する
  tick: () => void; // マインクラフト内の1tick（0.05秒）ごとに発火する
  worldConnected: () => void; // /connect localhost:3000などのコマンドがマインクラフト内で入力され、webSocket接続が確立された時に発火する
}

class WorldEventEmitter extends EventEmitter {
  on<K extends keyof WorldEvents>(eventName: K, listener: WorldEvents[K]): this {
    return super.on(eventName, listener);
  }

  off<K extends keyof WorldEvents>(eventName: K, listener: WorldEvents[K]): this {
    return super.off(eventName, listener);
  }

  removeListener<K extends keyof WorldEvents>(eventName: K, listener: WorldEvents[K]): this {
    return super.removeListener(eventName, listener);
  }

  emit<K extends keyof WorldEvents>(eventName: K, ...args: Parameters<WorldEvents[K]>): boolean {
    return super.emit(eventName, ...args);
  }
}

class World {
  players: Map<string, PlayerData> = new Map();
  private playerCodes: Map<string, string> = new Map(); // playerName -> playerCode

  constructor() {}

  async startServer(): Promise<void> {
    if (window.electronAPI?.startServer) {
      window.electronAPI.startServer(3000);
    }
  }

  async stopServer(): Promise<void> {
    if (window.electronAPI?.stopServer) {
      window.electronAPI.stopServer();
    }
    
  }

  async getOwnerName(): Promise<string> {
    if (window.electronAPI?.getLocalPlayerName) {
      return window.electronAPI.getLocalPlayerName();
    }
    return 'Owner';
  }

  addPlayer(playerName: string): void {
    if (this.players.has(playerName)) {
      return;
    }
    const defaultPlayerData: PlayerData = {
      name: playerName,
      location: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0 },
      isSpectator: false,
    };
    this.players.set(playerName, defaultPlayerData);
  }

  removePlayer(playerName: string): void {
    this.players.delete(playerName);
    this.playerCodes.delete(playerName);
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

  generateAndAssignCode(playerName: string): string {
    if (playerName === "Owner") return '';
    const existingCode = this.playerCodes.get(playerName);
    if (existingCode) return existingCode;

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.playerCodes.set(playerName, code);
    return code;
  }

  generatePlayerCodes(): void {
    this.playerCodes.clear();
    this.players.forEach((_, name) => {
      if (name !== "Owner") {
        this.generateAndAssignCode(name);
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
  
  notifyPlayerWithCode(playerName: string, roomCode: string): void {
      const code = this.playerCodes.get(playerName);
      if(!code) {
          console.warn(`No code found for player ${playerName} to notify.`);
          return;
      }
      const message = `=====EchoBE プレイヤー情報=====\nルームID：${roomCode}\nプレイヤー名：${playerName}\nプレイヤーコード：${code}\n===========================`;
      this.sendMessage(message, playerName);
  }

  notifyPlayersWithCodes(roomCode: string): void {
      this.playerCodes.forEach((_code, name) => {
          this.notifyPlayerWithCode(name, roomCode);
      });
  }

  /**
   * マインクラフトのテキストチャット内にメッセージを書き込む
   * @param message - 送信するメッセージ内容
   * @param playerName - 送信するプレイヤーの名前（undefinedならワールド全体に送信される）
   */
  sendMessage(message: string, playerName?: string) {
    if (window.electronAPI?.sendMessage) {
      window.electronAPI.sendMessage(message, playerName);
    }
    console.log(`[Minecraft Mock] Message sent: ${message} (from ${playerName || 'world'})`);
  }

  events = new WorldEventEmitter();
}

export const world = new World();
export const isElectron = !!window.electronAPI;

if (isElectron) {
  window.electronAPI.onPlayerJoin((ev) => {
    world.events.emit('playerJoin', ev);
  });
  window.electronAPI.onPlayerLeave((ev) => {
    world.events.emit('playerLeave', ev);
  });
  window.electronAPI.onTick(async () => {
    if (window.electronAPI.requestPlayerData) {
        world.players = await window.electronAPI.requestPlayerData();
    }
    world.events.emit('tick');
  });
  window.electronAPI.onWorldConnected(() => {
    world.events.emit('worldConnected');
  });
}

export const startServer = async (port: number) => {
  if (!isElectron) {
    console.warn("Not running in Electron environment. Cannot start server.");
    return;
  }
  await window.electronAPI.startServer(port);
}
export const stopServer = async () => {
  if (!isElectron) {
    console.warn("Not running in Electron environment. Cannot stop server.");
    return;
  }
  await window.electronAPI.stopServer();
}