import React from 'react';

export const Header: React.FC = () => {
  return (
    <>
      <header className="app-header">
        <div className="header-brand-group">
          <span className="app-brand-logo" aria-hidden="true" />
          <h1 className="app-brand">Callscope</h1>
          <span className="app-tagline">DAO governance executable analysis</span>
        </div>
        <div className="header-attribution">
          <span className="header-status-pill">
            <span className="pulse-dot" aria-hidden="true" />
            Ethereum &amp; Base Live
          </span>
        </div>
      </header>

      <section className="hero-section" aria-label="Overview">
        <div className="hero-pill-badge">
          <span className="hero-pill-sparkle" aria-hidden="true">✦</span>
          Dual-Agent Governance Intelligence
        </div>
        <h2 className="hero-title">Verify Proposal Execution Before Voting</h2>
        <p className="hero-subtitle">
          Deterministic calldata decoding, parameter validation, and dual-LLM adversarial cross-examination powered by OpenServ SERV and Dolphin.
        </p>
      </section>
    </>
  );
};
