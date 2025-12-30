'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed');
      } else {
        router.push('/login');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md py-12">
      <h1 className="text-3xl font-semibold mb-6 text-center">Create Account</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 rounded bg-green-600 text-white hover:bg-green-700 transition"
          disabled={loading}
        >
          {loading ? 'Signing up…' : 'Sign Up'}
        </button>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-600 hover:underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
