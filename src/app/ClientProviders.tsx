'use client'
import { AuthProvider } from '../context/AuthContext';
import TopNav from '../components/TopNav';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TopNav />
      {children}
    </AuthProvider>
  );
}
