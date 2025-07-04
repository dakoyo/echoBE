import React from 'react';

interface HeroProps {
  onJoin: () => void;
  onCreate: () => void;
  isCreating: boolean;
  isElectron: boolean;
}

export const Hero: React.FC<HeroProps> = ({ onJoin, onCreate, isCreating, isElectron }) => {
  return (
    <div className="text-center p-4">
      <h2 className="text-4xl md:text-6xl text-white leading-tight mb-4">
        プロキシミティチャット
      </h2>
      <p className="text-lg md:text-2xl text-[#E0E0E0] mb-12 max-w-2xl mx-auto">
        マインクラフト統合版のための
        <br />
        ゲーム内の位置に合わせて会話しよう。
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <button
          onClick={onJoin}
          className="w-64 bg-[#A9A9A9] text-[#212121] text-lg py-3 px-6 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
        >
          ルームに参加
        </button>
        <button
          onClick={onCreate}
          disabled={isCreating || !isElectron}
          className="w-64 bg-[#58A445] text-white text-lg py-3 px-6 border-2 border-t-[#94E37E] border-l-[#94E3E7] border-b-[#3F7A3E] border-r-[#3F7A3E] hover:bg-[#6BC056] active:bg-[#58A445] active:border-t-[#3F7A3E] active:border-l-[#3F7A3E] active:border-b-[#94E37E] active:border-r-[#94E37E] disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-700 disabled:cursor-not-allowed"
          title={!isElectron ? "ルームの作成はデスクトップ版でのみ利用できます。" : ""}
        >
          {isCreating ? '作成中...' : 'ルームを作成'}
        </button>
      </div>
    </div>
  );
};
