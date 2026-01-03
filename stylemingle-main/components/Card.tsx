import React from 'react';

export interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export default function Card({ className = '', children }: CardProps) {
  return (
    <div className={`bg-card-bg border border-warm-taupe rounded-card shadow-soft p-l ${className}`.trim()}>
      {children}
    </div>
  );
}
