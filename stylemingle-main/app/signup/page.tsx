'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';
import Card from '@/components/Card';

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('authToken');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.message) {
          setError(data.message);
        } else {
          setError('An account with this email already exists. Please log in instead.');
        }
        setLoading(false);
        return;
      }
      const token = data?.token;
      if (token) {
        localStorage.setItem('authToken', token);
      }
      setSuccess('Account created successfully. Redirecting to your dashboard…');
      setLoading(false);
      router.push('/dashboard');
    } catch (err) {
      setError('An account with this email already exists. Please log in instead.');
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-10 p-8">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block mb-1 text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-1 text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-1 text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Sign Up'}
        </Button>
      </form>
      <p className="text-center text-sm mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 underline">
          Login
        </Link>
      </p>
    </Card>
  );
}
