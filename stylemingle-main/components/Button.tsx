import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const base = 'rounded-btn font-medium transition-shadow focus:outline-none';
  const variants: Record<string, string> = {
    primary: 'bg-pastel-coral text-secondary-bg hover:shadow-hover',
    secondary: 'border border-pastel-coral text-pastel-coral hover:bg-pastel-coral hover:text-secondary-bg',
  };
  const spacing = 'py-m px-l';
  const classes = `${base} ${variants[variant] || variants.primary} ${spacing} ${className}`;
  return (
    <button className={classes.trim()} {...props}>
      {children}
    </button>
  );
}
