import Link from 'next/link';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Login</h1>
        <form className="space-y-4">
          <input type="email" placeholder="Email" className="w-full border rounded-md px-3 py-2" />
          <input type="password" placeholder="Password" className="w-full border rounded-md px-3 py-2" />
          <button type="submit" className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-800">Log In</button>
        </form>
        <p className="text-center text-sm">
          Don’t have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
