import React, { useRef } from 'react';

export function InputOTP({ length = 4, value = '', onChange }) {
  const inputsRef = useRef([]);

  const handleChange = (e, idx) => {
    const val = e.target.value;
    if (val.length > 1) return;
    const newArr = value.split('');
    newArr[idx] = val;
    const result = newArr.join('');
    if (onChange) onChange(result);

    if (val && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center my-3">
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputsRef.current[idx] = el)}
          type="text"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className="w-11 h-13 text-center text-xl font-bold rounded-lg border border-gray-700 bg-gray-900 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
        />
      ))}
    </div>
  );
}
