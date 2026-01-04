'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.message) {
          setError('An account with this email already exists. Please log in instead.');
        } else {
          setError(data?.error || 'Signup failed');
        }
        setLoading(false);
        return;
      }
      if (data?.token) {
        localStorage.setItem('authToken', data.token);
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md space-y-4 bg-white rounded shadow p-8">
        <h1 className="text-xl font-bold text-center">Sign Up</h1>
        {error && <p className="text-red-500">{error}</p>}
        {success && <p className="text-green-500">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-1 text-sm font-medium">Name</label>
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
          <div>
            <label htmlFor="email" className="block mb-1 text-sm font-medium">Email</label>
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
          <div>
            <label htmlFor="password" className="block mb-1 text-sm font-medium">Password</label>
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
            {loading ? 'Loading…' : 'Sign Up'}
          </Button>
        </form>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
