import Link from 'next/link';
import Card from '../../components/Card';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md space-y-m">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p>Welcome to your dashboard. Choose a section:</p>
        <ul className="space-y-s list-disc list-inside">
          <li><Link href="/dashboard/wardrobe" className="text-pastel-coral hover:underline">Wardrobe</Link></li>
          <li><Link href="/dashboard/outfits" className="text-pastel-coral hover:underline">Outfits</Link></li>
          <li><Link href="/dashboard/avatar" className="text-pastel-coral hover:underline">Avatar</Link></li>
        </ul>
      </Card>
    </div>
  );
}
