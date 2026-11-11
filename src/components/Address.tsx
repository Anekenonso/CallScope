import React, { useState } from 'react';

export interface AddressProps {
  value: string;
  explorerUrl?: string;
  label?: string;
  truncateMiddle?: boolean;
  prefixLength?: number;
  suffixLength?: number;
  showCopy?: boolean;
  className?: string;
}

export const Address: React.FC<AddressProps> = ({
  value,
  explorerUrl,
  label = 'Address',
  truncateMiddle = true,
  prefixLength = 6,
  suffixLength = 4,
  showCopy = true,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanValue = value ? value.trim() : '';

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shouldTruncate =
    truncateMiddle && !isExpanded && cleanValue.length > prefixLength + suffixLength + 3;

  const displayValue = shouldTruncate
    ? `${cleanValue.slice(0, prefixLength)}...${cleanValue.slice(-suffixLength)}`
    : cleanValue;

  return (
    <span
      className={`address-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: 0,
        maxWidth: '100%',
      }}
      title={cleanValue}
    >
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="address-link"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            overflowWrap: 'anywhere',
            wordBreak: 'break-all',
            minWidth: 0,
          }}
        >
          {displayValue}
        </a>
      ) : (
        <span
          className="address-text"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            overflowWrap: 'anywhere',
            wordBreak: 'break-all',
            minWidth: 0,
          }}
        >
          {displayValue}
        </span>
      )}

      {cleanValue.length > prefixLength + suffixLength + 3 && (
        <button
          type="button"
          className="expand-address-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? `Collapse ${label}` : `Expand full ${label}`}
          title={isExpanded ? 'Collapse' : 'Expand full address'}
          style={{
            background: 'none',
            border: 'none',
            padding: '1px 4px',
            fontSize: '11px',
            color: 'var(--color-text-muted, #94a3b8)',
            cursor: 'pointer',
          }}
        >
          {isExpanded ? '«' : '»'}
        </button>
      )}

      {showCopy && (
        <button
          type="button"
          className="copy-btn"
          onClick={copyToClipboard}
          aria-label={`Copy ${label}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </span>
  );
};

