export function IconPoop({ active }: { active?: boolean }) {
  const c = active ? "currentColor" : "#9a7a86";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 14c0-3 2-5 4-6 1-2 3-3 4-2 2 1 2 4 1 5 3 1 4 3 3 5-1 3-4 5-8 5s-7-2-7-5c0-2 1-3 3-2z" stroke={c} strokeWidth="1.8" />
    </svg>
  );
}

export function IconHeart({ active }: { active?: boolean }) {
  const c = active ? "currentColor" : "#9a7a86";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGlobe({ active }: { active?: boolean }) {
  const c = active ? "currentColor" : "#9a7a86";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16" stroke={c} strokeWidth="1.6" />
    </svg>
  );
}

export function IconMemo({ active }: { active?: boolean }) {
  const c = active ? "currentColor" : "#9a7a86";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke={c} strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconFriends({ active }: { active?: boolean }) {
  const c = active ? "currentColor" : "#9a7a86";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3" stroke={c} strokeWidth="1.8" />
      <circle cx="16" cy="10" r="2.5" stroke={c} strokeWidth="1.8" />
      <path d="M3.5 19c1-3 3-4.5 5.5-4.5S13 16 14 19M13.5 18.5c.6-1.8 2-3 3.5-3 1.8 0 3 1.2 3.5 3" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
