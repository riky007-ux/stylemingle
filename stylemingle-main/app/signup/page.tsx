import Link from 'next/link';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        <form className="space-y-4">
          <input type="text" placeholder="Name" className="w-full border rounded-md px-3 py-2" />
          <input type="email" placeholder="Email" className="w-full border rounded-md px-3 py-2" />
          <input type="password" placeholder="Password" className="w-full border rounded-md px-3 py-2" />
          <button type="submit" className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-800">
            Sign Up
          </button>
        </form>
        <p className="text-center text-sm">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
