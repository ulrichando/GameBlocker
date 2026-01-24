"use client";

import { motion } from "framer-motion";
import { Shield, Star, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-surface-base">
      {/* Animated Gradient Orbs */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-primary-600/50 blur-[120px] animate-float" />
      <div className="absolute bottom-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full bg-accent-500/40 blur-[120px] animate-float animation-delay-7000" />
      <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-secondary-500/30 blur-[100px] animate-float animation-delay-4000" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Trust Badge */}
          <motion.div variants={item} className="mb-8">
            <div className="inline-flex items-center gap-3 bg-surface-card/80 backdrop-blur-sm border border-white/10 rounded-full px-5 py-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-300 text-sm font-medium">
                Trusted by 10,000+ Families Worldwide
              </span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 tracking-tight"
          >
            Protect Your Family&apos;s{" "}
            <span className="text-gradient">Digital Life</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={item}
            className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Take control of screen time and block distracting games and websites
            with enterprise-grade protection. Simple setup, powerful results.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={item}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button size="lg" className="group">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="secondary" size="lg" className="group">
              <Play className="w-5 h-5" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            variants={item}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-14"
          >
            {/* Avatar Stack */}
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-surface-base bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white text-xs font-bold"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>

            {/* Rating */}
            <div className="flex flex-col items-start">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                <strong className="text-white">4.9/5</strong> from 2,000+ reviews
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          className="mt-20 relative"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface-card/80 backdrop-blur-xl rounded-2xl border border-white/10 p-2 shadow-2xl">
              {/* Window Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-gray-500 ml-4">ParentShield Dashboard</span>
              </div>

              {/* Dashboard Content */}
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <DashboardStat
                  label="Screen Time Today"
                  value="2h 34m"
                  trend="-15%"
                  trendUp={false}
                />
                <DashboardStat
                  label="Apps Blocked"
                  value="47"
                  trend="+12"
                  trendUp={true}
                />
                <DashboardStat
                  label="Sites Filtered"
                  value="156"
                  trend="+8"
                  trendUp={true}
                />
                <DashboardStat
                  label="Safety Score"
                  value="98%"
                  trend="+3%"
                  trendUp={true}
                />
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 via-secondary-500/20 to-primary-500/20 rounded-3xl blur-3xl -z-10" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardStat({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="bg-surface-overlay/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p
        className={`text-xs mt-1 ${
          trendUp ? "text-green-400" : "text-primary-400"
        }`}
      >
        {trend} from yesterday
      </p>
    </div>
  );
}
