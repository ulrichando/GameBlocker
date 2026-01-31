import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl font-bold text-neutral-200 dark:text-neutral-800 mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
