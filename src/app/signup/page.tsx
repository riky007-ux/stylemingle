'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.token) {
          localStorage.setItem('authToken', data.token);
        }
        setMessage('Account created successfully! Welcome!');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 500);
      } else {
        let data: any = {};
        try {
          data = await res.json();
        } catch (err) {
          // ignore parsing error
        }
        setMessage(data?.error || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setMessage('Signup failed. Please try again.');
    }
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Create Account</h1>
      {message && <p className="mb-4 text-sm">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Create Account
        </button>
      </form>
      <p className="mt-4">
        Already have an account?{' '}
        <a href="/login" className="text-blue-500 underline">
          Log In
        </a>
      </p>
    </main>
  );
}
