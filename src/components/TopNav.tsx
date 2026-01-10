"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TopNav() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("authToken");
    setIsAuthenticated(!!token);
  };

  useEffect(() => {
    checkAuth();

    window.addEventListener("focus", checkAuth);
    window.addEventListener("storage", checkAuth);

    return () => {
      window.removeEventListener("focus", checkAuth);
      window.removeEventListener("storage", checkAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    checkAuth();
    window.location.href = "/login";
  };

  return (
    <nav style={{ padding: "1rem", borderBottom: "1px solid #ddd" }}>
      <strong>StyleMingle</strong>

      <div style={{ marginTop: "0.5rem" }}>
        {!isAuthenticated ? (
          <>
            <Link href="/login">Login</Link>{" "}
            <Link href="/signup">Sign Up</Link>
          </>
        ) : (
          <>
            <Link href="/dashboard">Dashboard</Link>{" "}
            <Link href="/dashboard/wardrobe">Wardrobe</Link>{" "}
            <button onClick={handleLogout}>Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
