"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "authToken";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        const token = data.token;
        if (token) {
          localStorage.setItem(TOKEN_KEY, token);
        }
        // show confirmation
        setMessage("Logged in successfully!");
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      } else {
        setMessage(data?.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setMessage("Login failed. Please try again.");
    }
  }

  return (
    <div>
      <h1>Log In</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Log In</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
