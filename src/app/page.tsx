import Link from 'next/link';

export default function Page() {
  return (
    <section className="min-h-screen flex flex-col justify-center items-center text-center p-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to StyleMingle</h1>
      <p className="mb-8 text-lg">Your AI-powered personal styling companion.</p>
      <div className="flex space-x-4">
        <Link href="/signup" className="px-6 py-3 bg-black text-white rounded">Get Started</Link>
        <Link href="/login" className="px-6 py-3 border border-black text-black rounded">Log in</Link>
      </div>
    </section>
  );
}
