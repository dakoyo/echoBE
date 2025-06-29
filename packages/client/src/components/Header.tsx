import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="py-4 px-4 md:px-8 bg-[#3C3C3C] border-b-4 border-[#272727]">
      <div className="container mx-auto flex items-center justify-center md:justify-start">
        <h1 className="text-3xl md:text-4xl text-[#E0E0E0] tracking-wider">
          EchoBE
        </h1>
      </div>
    </header>
  );
};
