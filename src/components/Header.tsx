import React, { useEffect, useState } from 'react';

export const Header: React.FC = () => {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('callscope-theme') as 'system' | 'light' | 'dark' | null;
      if (saved) {
        setTheme(saved);
        if (saved === 'system') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', saved);
        }
      }
    } catch {
      // LocalStorage access may fail in restricted sandboxes
    }
  }, []);

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    try {
      localStorage.setItem('callscope-theme', next);
    } catch {
      // ignore
    }
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
  };

  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

  return (
    <header className="app-header">
      <div className="header-brand-group">
        <div className="header-logo-mark" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="7" className="logo-base-rect" />
            {/* Ledger calldata record lines & crosshair target */}
            <path d="M7 10h18M7 16h11M7 22h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
            <circle cx="23" cy="19" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="23" cy="19" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-text-block">
          <div className="brand-title-row">
            <h1 className="app-brand">Callscope</h1>
            <span className="header-version-tag">Read-only · v0.1 beta</span>
          </div>
          <span className="header-tagline">DAO Proposal Calldata Ledger &amp; Security Examiner</span>
        </div>
      </div>

      <div className="header-controls-group">
        <button
          type="button"
          onClick={cycleTheme}
          className="theme-toggle-icon-btn"
          aria-label={`Current theme: ${theme}. Switch to ${nextTheme} theme.`}
          title={`Theme: ${theme.toUpperCase()} (Click to switch to ${nextTheme})`}
        >
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
        </button>

        <div className="header-attribution">
          <span className="attribution-dot" aria-hidden="true" />
          <span>Advisory by <strong>OpenServ SERV</strong> &amp; <strong>Dolphin</strong></span>
        </div>
      </div>
    </header>
  );
};
