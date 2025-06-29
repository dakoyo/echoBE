import React from 'react';

export const HeadphonesIcon: React.FC<{ muted?: boolean } & React.SVGProps<SVGSVGElement>> = ({ muted, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 0 0-9 9v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 0 1 9 9v6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h2" />
    {muted && <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" strokeWidth={2} />}
  </svg>
);
