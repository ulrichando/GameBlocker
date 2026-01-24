"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Gamepad2,
  Globe,
  Shield,
  Laptop,
  BarChart3,
  Lock,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Clock,
    title: "Smart Time Limits",
    description:
      "Set daily screen time limits that automatically adjust based on your family's schedule. Includes homework mode and weekend extensions.",
    span: "md:col-span-2",
    featured: true,
  },
  {
    icon: Gamepad2,
    title: "Game Blocking",
    description:
      "Block Steam, Epic, and 500+ gaming platforms. Whitelist educational games while blocking distractions.",
    span: "",
  },
  {
    icon: Globe,
    title: "Website Filtering",
    description:
      "AI-powered content filtering that blocks harmful content in real-time across all browsers.",
    span: "",
  },
  {
    icon: Shield,
    title: "Tamper Protection",
    description:
      "Enterprise-grade security prevents kids from disabling or bypassing the software. Even tech-savvy teenagers can't circumvent it.",
    span: "md:col-span-3",
    featured: true,
  },
  {
    icon: Laptop,
    title: "Cross-Platform",
    description:
      "Works on Windows, macOS, and Linux. One subscription covers all your family's devices.",
    span: "",
  },
  {
    icon: BarChart3,
    title: "Activity Reports",
    description:
      "Weekly reports show screen time trends, most-used apps, and blocked attempts.",
    span: "",
  },
  {
    icon: Lock,
    title: "App Control",
    description:
      "Block or limit any application. Set different rules for different apps.",
    span: "",
  },
  {
    icon: Bell,
    title: "Instant Alerts",
    description:
      "Get notified when limits are reached or when blocked content is attempted.",
    span: "",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-surface-base relative">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/5 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
            Features
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="text-gradient">Protect Your Family</span>
          </h2>
          <p className="text-gray-400 text-lg">
            Comprehensive parental control tools designed for modern families.
            Easy to set up, impossible to bypass.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className={cn("col-span-1", feature.span)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  featured = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  featured?: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "h-full rounded-2xl p-6 border transition-all duration-300",
        "bg-surface-card hover:bg-surface-elevated",
        featured
          ? "border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-transparent"
          : "border-white/5 hover:border-primary-500/20"
      )}
      whileHover={{
        y: -4,
        boxShadow: featured
          ? "0 0 60px rgba(6, 182, 212, 0.2)"
          : "0 0 40px rgba(6, 182, 212, 0.1)",
      }}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
          featured ? "bg-gradient-primary shadow-glow-sm" : "bg-surface-elevated"
        )}
      >
        <Icon className={cn("w-6 h-6", featured ? "text-white" : "text-primary-400")} />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}
