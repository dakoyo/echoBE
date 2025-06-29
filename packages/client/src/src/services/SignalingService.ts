
import { EventEmitter } from "events";
import type { SignalingMessageIn, SignalingMessageOut } from '../types/signaling.js';

export class SignalingService extends EventEmitter {
  private ws: WebSocket | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("Signaling connection established.");
        this.emit('open');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SignalingMessageIn;
          this.emit('message', message);
        } catch (error) {
          console.error("Failed to parse signaling message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Signaling WebSocket error:", error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log("Signaling connection closed:", event.reason);
        this.emit('close', event.reason);
        this.ws = null;
      };
    });
  }

  send(message: SignalingMessageOut) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("Cannot send message, WebSocket is not open.");
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Type-safe 'on' method
  on(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
