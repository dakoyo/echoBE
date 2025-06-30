import React, { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  senderName: string;
  text: string;
  isMe: boolean;
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage }) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <div className="bg-[#3C3C3C] border-4 border-t-[#545454] border-l-[#545454] border-b-[#272727] border-r-[#272727] p-4 flex flex-col h-72">
      <div className="flex-grow overflow-y-auto mb-3 pr-2 space-y-2 text-base bg-[#212121] p-2 border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454]">
        {messages.map((msg, index) => (
          <div key={index} className="leading-snug">
            <span className={`font-bold ${msg.isMe ? 'text-green-300' : 'text-blue-300'}`}>{msg.senderName}: </span>
            <span className="text-white break-words">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex-shrink-0 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力してEnter..."
          className="flex-grow bg-[#313131] border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] text-white p-2 focus:outline-none focus:bg-[#454545]"
          autoComplete="off"
        />
        <button
          type="submit"
          className="bg-[#A9A9A9] text-[#212121] py-2 px-6 border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF] disabled:bg-[#545454] disabled:text-[#888] disabled:cursor-not-allowed disabled:border-gray-700"
          disabled={!text.trim()}
          aria-label="メッセージを送信"
        >
          送信
        </button>
      </form>
    </div>
  );
};
