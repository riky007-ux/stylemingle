import Link from 'next/link';

export default function Page() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="mb-6">Welcome to your dashboard. Choose a section:</p>
      <ul className="space-y-2">
        <li><Link href="/dashboard/wardrobe" className="text-blue-600 hover:underline">Wardrobe</Link></li>
        <li><Link href="/dashboard/outfits" className="text-blue-600 hover:underline">Outfits</Link></li>
        <li><Link href="/dashboard/avatar" className="text-blue-600 hover:underline">Avatar</Link></li>
      </ul>
    </div>
  );
}
