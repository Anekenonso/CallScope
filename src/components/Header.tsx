import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-brand-group">
        <div className="header-logo-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="30" height="30" rx="7" fill="#121620" stroke="#2D3548" strokeWidth="1.2" />
            <path d="M16 5.5L25 10.7V21.3L16 26.5L7 21.3V10.7L16 5.5Z" stroke="#4B5563" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="6" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
            <line x1="16" y1="7" x2="16" y2="10" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="16" y1="22" x2="16" y2="25" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="7" y1="16" x2="10" y2="16" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="22" y1="16" x2="25" y2="16" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.2" fill="#C7D2FE" />
          </svg>
        </div>
        <h1 className="app-brand">Callscope</h1>
        <span className="header-version-tag">v0.1 · Mainnet &amp; Base</span>
      </div>
      <div className="header-attribution">
        <span className="attribution-dot" aria-hidden="true"></span>
        <span>Advisory reviews by <strong>OpenServ SERV</strong> &amp; <strong>Dolphin</strong></span>
      </div>
    </header>
  );
};


