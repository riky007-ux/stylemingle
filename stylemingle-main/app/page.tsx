import Link from 'next/link';
import Button from '../components/Button';
import Card from '../components/Card';

export default function Page() {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen space-y-l">
      <Card className="text-center space-y-m">
        <h1 className="text-4xl font-bold">Welcome to StyleMingle</h1>
        <p className="text-lg text-deep-espresso/80">Your AI-powered personal stylist.</p>
        <div className="flex justify-center space-x-m">
          <Link href="/signup">
            <Button variant="primary">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Login</Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
