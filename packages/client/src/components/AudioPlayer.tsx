
import React, { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  stream: MediaStream;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  // Audio elements for remote streams should be hidden from the user
  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};
