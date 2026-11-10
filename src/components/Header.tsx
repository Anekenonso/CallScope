import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-brand-group">
        <h1 className="app-brand">Callscope</h1>
        <span className="app-tagline">DAO proposal executable analysis</span>
      </div>
      <div className="header-attribution">
        <span>Advisory reviews by <strong>OpenServ SERV</strong> &amp; <strong>Dolphin</strong></span>
      </div>
    </header>
  );
};

