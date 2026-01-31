"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || data.message || "Login failed";
        throw new Error(errorMsg);
      }

      const { accessToken, refreshToken, user } = data.data;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user_role", user.role);
      localStorage.setItem("user_email", user.email);
      localStorage.setItem("user_name", user.firstName || "User");

      if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-neutral-950 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 pt-32 pb-16">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-block mb-8">
              <span className="text-2xl font-light tracking-tight text-neutral-900 dark:text-white">
                Parent<span className="font-semibold">Shield</span>
              </span>
            </Link>
            <h1 className="text-3xl font-light text-neutral-900 dark:text-white mb-2">
              Welcome <span className="italic">back.</span>
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">Sign in to your account</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8">
            {error && (
              <motion.div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 mb-6 text-sm"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border border-neutral-200 dark:border-neutral-700 py-3 pl-12 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border border-neutral-200 dark:border-neutral-700 py-3 pl-12 pr-12 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Register Link */}
            <p className="text-center text-neutral-500 dark:text-neutral-400 text-sm mt-6">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-neutral-900 dark:text-white font-medium hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Demo Accounts */}
          <motion.div
            className="mt-6 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mb-3">Demo Account (click to fill)</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@parentshield.com");
                  setPassword("ChangeThisPassword123!");
                }}
                className="border border-neutral-200 dark:border-neutral-700 p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Admin</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">admin@parentshield.com</p>
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
      <Footer />
    </main>
  );
}
