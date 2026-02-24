import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <section className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">
        <h1 className="text-4xl md:text-5xl font-semibold mb-4">Dashboard</h1>
        <p className="text-lg text-gray-700 mb-6">Build outfits and preview them on your avatar.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/dashboard/avatar" className="border rounded-xl p-5 hover:bg-slate-50">
            <h2 className="font-semibold text-xl">Avatar</h2>
            <p className="text-sm text-zinc-600">Customize body, face, skin tone, hair, and size.</p>
          </Link>
          <Link href="/dashboard/outfits" className="border rounded-xl p-5 hover:bg-slate-50">
            <h2 className="font-semibold text-xl">AI Stylist</h2>
            <p className="text-sm text-zinc-600">Generate explainable outfit suggestions from metadata.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
