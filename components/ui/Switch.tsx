'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

interface SwitchProps {
  initialChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ initialChecked = false, onChange, disabled = false }: SwitchProps) {
  const [checked, setChecked] = useState(initialChecked);

  const toggle = () => {
    if (disabled) return;
    const newState = !checked;
    setChecked(newState);
    onChange?.(newState);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="sr-only">Use setting</span>
      <motion.span
        layout
        initial={false}
        animate={{
          x: checked ? 20 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0`}
      />
    </button>
  );
}
