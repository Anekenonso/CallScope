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

  const themeLabel =
    theme === 'system' ? 'Theme: Auto' : theme === 'light' ? 'Theme: Paper' : 'Theme: Slate';

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
            <span className="header-version-tag">Verified On-Chain · v0.1</span>
          </div>
          <span className="header-tagline">DAO Proposal Calldata Ledger &amp; Security Examiner</span>
        </div>
      </div>

      <div className="header-controls-group">
        <button
          type="button"
          onClick={cycleTheme}
          className="theme-toggle-btn"
          aria-label={`Toggle visual theme. Current: ${theme}`}
          title="Switch theme (Paper, Slate, or System)"
        >
          <span className="theme-toggle-dot" aria-hidden="true" />
          <span>{themeLabel}</span>
        </button>

        <div className="header-attribution">
          <span className="attribution-dot" aria-hidden="true" />
          <span>Advisory by <strong>OpenServ SERV</strong> &amp; <strong>Dolphin</strong></span>
        </div>
      </div>
    </header>
  );
};
