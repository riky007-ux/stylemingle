import Link from 'next/link';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm space-y-m">
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        <form className="space-y-s">
          <input type="text" placeholder="Name" className="w-full border border-warm-taupe rounded-btn px-m py-s" />
          <input type="email" placeholder="Email" className="w-full border border-warm-taupe rounded-btn px-m py-s" />
          <input type="password" placeholder="Password" className="w-full border border-warm-taupe rounded-btn px-m py-s" />
          <Button type="submit" variant="primary" className="w-full">Sign Up</Button>
        </form>
        <p className="text-center text-sm">
          Already have an account? <Link href="/login" className="text-pastel-coral hover:underline">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
