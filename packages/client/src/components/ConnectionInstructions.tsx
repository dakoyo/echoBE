
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { CopyIcon } from './icons/CopyIcon.js';
import { CheckIcon } from './icons/CheckIcon.js';
import { world } from '../ipc/Minecraft.js';

interface ConnectionInstructionsProps {
  roomCode: string | null;
  onConnected: () => void;
}

const TRANSITION_DELAY = 5000; // 5 seconds

const CodeBlock: React.FC<{text: string, onCopy: () => void, copied: boolean}> = React.memo(function CodeBlock({ text, onCopy, copied }) {
  return (
    <div className="bg-[#212121] p-4 flex items-center justify-between border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] mt-2">
      <code className="text-lg text-[#E0E0E0] break-all">{text}</code>
      <button
        onClick={onCopy}
        className="ml-4 p-2 bg-[#A9A9A9] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
        aria-label={`Copy ${text}`}
      >
        {copied ? <CheckIcon className="w-5 h-5 text-[#58A445]" /> : <CopyIcon className="w-5 h-5 text-[#212121]" />}
      </button>
    </div>
  );
});

export const ConnectionInstructions: React.FC<ConnectionInstructionsProps> = ({ roomCode, onConnected }) => {
  const [progress, setProgress] = useState(0);
  const [connectCopied, setConnectCopied] = useState(false);
  const connectCommand = '/connect localhost:3000';

  useEffect(() => {
    // We only start the timer if the room code is available.
    if (!roomCode) return;

    const handleWorldConnected = () => {
      onConnected();
    };

    world.events.on('worldConnected', handleWorldConnected);

    const simulationTimer = setTimeout(() => {
      world.events.emit('worldConnected');
    }, TRANSITION_DELAY);

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 100 / (TRANSITION_DELAY / 100), 100));
    }, 100);

    return () => {
      clearTimeout(simulationTimer);
      clearInterval(interval);
      world.events.removeListener('worldConnected', handleWorldConnected);
    };
  }, [onConnected, roomCode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(connectCommand).then(() => {
      setConnectCopied(true);
      setTimeout(() => setConnectCopied(false), 2000);
    });
  }, [connectCommand]);

  return (
    <div className="min-h-screen bg-[#313233] text-[#E0E0E0] flex flex-col selection:bg-[#58A445] selection:text-white">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-[#3C3C3C] border-4 border-t-[#545454] border-l-[#545454] border-b-[#272727] border-r-[#272727] p-8 text-center">
          <h2 className="text-3xl text-white mb-6">ルームを作成しました！</h2>
          
          <div className="text-left mb-4">
            <p className="text-lg text-[#E0E0E0] mb-2">Minecraftでサーバーに接続:</p>
            <p className="text-sm text-[#A9A9A9] mb-2">ゲーム内で「サーバーを追加」または「直接接続」を選び、以下のコマンドを入力してください。</p>
            <CodeBlock text={connectCommand} onCopy={handleCopy} copied={connectCopied} />
          </div>
          
          <div className="text-left mb-8">
            <p className="text-lg text-[#E0E0E0] mb-2">クライアントへの情報:</p>
            <p className="text-sm text-[#A9A9A9] mb-2">参加するプレイヤーは、アプリで以下のルームコードを入力します。<br/>(各プレイヤーには個別のプレイヤーコードがゲーム内で通知されます)</p>
            <div className="bg-[#212121] p-4 text-center border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] mt-2">
                <p className="text-sm text-[#A9A9A9]">ルームコード</p>
                <p className="text-4xl text-white tracking-[0.5em] font-mono p-2">{roomCode || '生成中...'}</p>
            </div>
          </div>

          <div className="w-full bg-[#212121] border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] mt-8">
            <div 
              className="bg-[#58A445] h-4 transition-all duration-100 ease-linear" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-[#A9A9A9] mt-3">
            {progress < 100 ? 'Minecraftとの接続を待っています...' : '接続完了！'}
          </p>

        </div>
      </main>
      <Footer />
    </div>
  );
};
