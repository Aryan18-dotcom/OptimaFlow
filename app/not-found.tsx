import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 text-center p-6">
      <h2 className="text-6xl font-extrabold text-slate-900 mb-4">404</h2>
      <p className="text-xl text-slate-600 mb-8">
        Oops! The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        href="/" 
        className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-700 transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}