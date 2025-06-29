import React from 'react';
import { CloseIcon } from './icons/CloseIcon.js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#3C3C3C] border-4 border-t-[#545454] border-l-[#545454] border-b-[#272727] border-r-[#272727] p-8 pt-10 relative w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-[#212121] bg-[#A9A9A9] w-7 h-7 flex items-center justify-center border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]"
          aria-label="モーダルを閉じる"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
};