"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const TOKEN_KEY = "authToken";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard.</p>
    </main>
  );
}
