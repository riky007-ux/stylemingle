import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Dashboard</h1>
      <p style={{ marginBottom: '1rem' }}>Welcome to your dashboard. Choose a section:</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li><Link href="/dashboard/wardrobe">Wardrobe</Link></li>
        <li><Link href="/dashboard/outfits">Outfits</Link></li>
        <li><Link href="/dashboard/avatar">Avatar</Link></li>
      </ul>
    </div>
  );
}
