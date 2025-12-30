import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h1>Welcome to StyleMingle</h1>
      <p>Mix and match your wardrobe effortlessly.</p>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <Link href="/signup">Get Started</Link>
        <Link href="/login">Login</Link>
      </div>
    </main>
  );
}
