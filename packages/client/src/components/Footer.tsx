import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="py-6 px-4 md:px-8 text-center">
      <p className="text-[#545454] text-sm">&copy; {new Date().getFullYear()} EchoBE.</p>
    </footer>
  );
};
