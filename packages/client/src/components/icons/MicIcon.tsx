import React from 'react';

export const MicIcon: React.FC<{ muted?: boolean } & React.SVGProps<SVGSVGElement>> = ({ muted, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5a3 3 0 0 1 3 3v3a3 3 0 0 1-6 0v-3a3 3 0 0 1 3-3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12.75v.75a6 6 0 0 1-10.5 0v-.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75v4.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 20.25h7.5" />
    {muted && <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" strokeWidth={2} />}
  </svg>
);
