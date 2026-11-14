import React from 'react';

interface GovernanceLogoProps {
  size?: number;
  className?: string;
}

export const GovernanceLogo: React.FC<GovernanceLogoProps> = ({ size = 26, className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Callscope DAO Governance Emblem"
      role="img"
    >
      <defs>
        <linearGradient id="headerGovGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D78E" />
          <stop offset="50%" stopColor="#C99D41" />
          <stop offset="100%" stopColor="#9E761E" />
        </linearGradient>
        <linearGradient id="headerBgGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#222016" />
          <stop offset="100%" stopColor="#0D0C07" />
        </linearGradient>
      </defs>

      {/* Frame */}
      <rect
        width="32"
        height="32"
        rx="8"
        fill="url(#headerBgGrad)"
        stroke="#C99D41"
        strokeOpacity="0.4"
        strokeWidth="1.2"
      />

      {/* Classical Governance Pediment + 3 Pillars (Propose, Vote, Execute) */}
      <path d="M16 6.8L6.5 12.2H25.5L16 6.8Z" fill="url(#headerGovGrad)" />
      <rect x="7" y="13.2" width="18" height="1.8" rx="0.9" fill="url(#headerGovGrad)" />
      <rect x="8.5" y="16" width="3" height="7.2" rx="1" fill="url(#headerGovGrad)" />
      <rect x="14.5" y="16" width="3" height="7.2" rx="1" fill="url(#headerGovGrad)" />
      <rect x="20.5" y="16" width="3" height="7.2" rx="1" fill="url(#headerGovGrad)" />
      <rect x="6.5" y="24.2" width="19" height="2" rx="1" fill="url(#headerGovGrad)" />

      {/* Apex Verified Execution Beacon */}
      <circle cx="16" cy="10" r="1.3" fill="#FFFFFF" />
    </svg>
  );
};
