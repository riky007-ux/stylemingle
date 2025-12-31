import Link from 'next/link';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm space-y-m">
        <h1 className="text-2xl font-bold text-center">Login</h1>
        <form className="space-y-s">
          <input type="email" placeholder="Email" className="w-full border border-warm-taupe rounded-btn px-m py-s" />
          <input type="password" placeholder="Password" className="w-full border border-warm-taupe rounded-btn px-m py-s" />
          <Button type="submit" variant="primary" className="w-full">Log In</Button>
        </form>
        <p className="text-center text-sm">
          Don’t have an account? <Link href="/signup" className="text-pastel-coral hover:underline">Sign up</Link>
        </p>
      </Card>
    </div>
  );
}
