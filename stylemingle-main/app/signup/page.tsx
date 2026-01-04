'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data && (data as any).error) || 'Signup failed');
      }
      const data = await res.json();
      if (data && (data as any).token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', (data as any).token);
        }
        router.replace('/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm space-y-m">
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        <form onSubmit={handleSubmit} className="space-y-s">
          {error && <div className="text-red-500">{error}</div>}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-warm-taupe rounded-btn px-m py-s"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-warm-taupe rounded-btn px-m py-s"
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Sign Up
          </Button>
        </form>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-pastel-coral hover:underline">
            Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
