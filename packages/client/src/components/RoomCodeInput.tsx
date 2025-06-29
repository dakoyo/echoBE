import React, { useRef } from 'react';

interface RoomCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  inputType?: 'alphanumeric' | 'numeric';
  ariaLabelPrefix: string;
}

export const RoomCodeInput: React.FC<RoomCodeInputProps> = ({ length = 6, value, onChange, inputType = 'alphanumeric', ariaLabelPrefix }) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>(new Array(length));
  
  const getRegex = () => {
    return inputType === 'numeric' ? /[^0-9]/g : /[^A-Z0-9]/g;
  };

  // Handles both typing and pasting into an input box
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const regex = getRegex();
    const inputVal = e.target.value.toUpperCase().replace(regex, '');
    const newCodeArr = [...value];

    // If pasting, fill subsequent boxes
    if (inputVal.length > 1) {
        for (let i = 0; i < inputVal.length; i++) {
            if (index + i < length) {
                newCodeArr[index + i] = inputVal[i];
            }
        }
        onChange(newCodeArr.join('').slice(0, length));
        const focusIndex = Math.min(index + inputVal.length, length - 1);
        if (inputRefs.current[focusIndex]) {
            inputRefs.current[focusIndex]!.focus();
        }
    } else { // Single character
        newCodeArr[index] = inputVal;
        onChange(newCodeArr.join(''));
        if (inputVal && index < length - 1) {
            if(inputRefs.current[index + 1]) {
                inputRefs.current[index + 1]!.focus();
            }
        }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      e.preventDefault();
      if(inputRefs.current[index - 1]) {
        inputRefs.current[index - 1]!.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      if(inputRefs.current[index - 1]) {
        inputRefs.current[index - 1]!.focus();
      }
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      if(inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]!.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const regex = getRegex();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(regex, '').slice(0, length);
    onChange(pastedText);
    const focusIndex = Math.min(pastedText.length, length - 1);
    
    setTimeout(() => {
        if (inputRefs.current[focusIndex]) {
            inputRefs.current[focusIndex]!.focus();
        }
    }, 0);
  };

  return (
    <div className="flex justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type={inputType === 'numeric' ? 'tel' : 'text'}
          inputMode={inputType === 'numeric' ? 'numeric' : 'text'}
          pattern={inputType === 'numeric' ? '[0-9]*' : '[A-Z0-9]*'}
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={(e) => e.target.select()}
          className={`w-12 h-16 bg-[#313131] border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] text-white text-center text-3xl tracking-widest focus:outline-none focus:bg-[#454545] focus:z-10
          ${index > 0 ? 'ml-[-2px]' : ''}
          `}
          aria-label={`${ariaLabelPrefix} ${index + 1}文字目`}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
};