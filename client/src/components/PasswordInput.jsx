import { useState } from 'react';
import { Input } from './ui';

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M1.7 10s3-6 8.3-6 8.3 6 8.3 6-3 6-8.3 6-8.3-6-8.3-6Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M8.1 4.2A8.6 8.6 0 0 1 10 4c5.3 0 8.3 6 8.3 6a14 14 0 0 1-2.2 2.9M5.4 5.6C3 7.2 1.7 10 1.7 10s3 6 8.3 6c1.6 0 3-.5 4.2-1.2" />
      <path d="M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6" />
      <path d="m2.5 2.5 15 15" />
    </svg>
  );
}

// Password field with an eye button to show/hide what you typed. Takes the
// same props as <Input>.
export default function PasswordInput({ className = '', ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...inputProps} type={visible ? 'text' : 'password'} className={`pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={inputProps.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <EyeIcon open={!visible} />
      </button>
    </div>
  );
}
