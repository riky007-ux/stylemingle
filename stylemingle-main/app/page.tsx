import Link from 'next/link';

export default function Page() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center text-center space-y-4">
      <h1 className="text-4xl font-bold">Welcome to StyleMingle</h1>
      <p className="text-lg text-gray-600">Your AI-powered personal stylist.</p>
      <div className="space-x-4">
        <Link href="/signup" className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800">
          Get Started
        </Link>
        <Link href="/login" className="text-black px-4 py-2 border border-black rounded-md hover:bg-gray-100">
          Login
        </Link>
      </div>
    </section>
  );
}
