"use client";

import { motion } from "framer-motion";
import { Tag, Sparkles, Bug, Zap, Shield } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const releases = [
  {
    version: "0.2.0",
    date: "January 2026",
    type: "minor",
    title: "Activity & Alerts Update",
    description: "New activity dashboard, alerts page, and device linking improvements.",
    changes: [
      { type: "feature", text: "Activity Dashboard - Real-time feed of blocked attempts" },
      { type: "feature", text: "Alerts Page - View and manage device notifications" },
      { type: "feature", text: "Quick Device Linking - Generate activation codes from website" },
      { type: "feature", text: "Device Linking Codes - Link devices by entering a code" },
      { type: "improvement", text: "Enhanced device management on web dashboard" },
      { type: "security", text: "Content Security Policy added for improved security" },
      { type: "feature", text: "Auto-update support for seamless upgrades" },
      { type: "improvement", text: "Updated navigation with Activity and Alerts shortcuts" },
    ],
  },
  {
    version: "0.1.0",
    date: "January 2026",
    type: "major",
    title: "Initial Release",
    description: "The first public release of ParentShield.",
    changes: [
      { type: "feature", text: "Cross-platform support for Windows, macOS, and Linux" },
      { type: "feature", text: "Game blocking with 200+ gaming sites and apps" },
      { type: "feature", text: "AI service blocking (ChatGPT, Claude, etc.)" },
      { type: "feature", text: "DNS-level web filtering" },
      { type: "feature", text: "Browser DoH (DNS over HTTPS) protection" },
      { type: "feature", text: "Firewall-based blocking for maximum security" },
      { type: "feature", text: "Schedule-based blocking rules" },
      { type: "feature", text: "Background daemon service for persistent protection" },
      { type: "feature", text: "Web dashboard for remote management" },
      { type: "feature", text: "Tamper-resistant password protection" },
    ],
  },
  {
    version: "0.0.9",
    date: "December 2025",
    type: "beta",
    title: "Beta Release",
    description: "Final beta before public launch.",
    changes: [
      { type: "improvement", text: "Improved daemon stability on Linux" },
      { type: "improvement", text: "Better handling of browser extensions" },
      { type: "fix", text: "Fixed memory leak in process monitor" },
      { type: "fix", text: "Fixed schedule timezone issues" },
    ],
  },
  {
    version: "0.0.8",
    date: "November 2025",
    type: "beta",
    title: "Beta Update",
    description: "Major improvements to blocking reliability.",
    changes: [
      { type: "feature", text: "Added firewall-based blocking" },
      { type: "improvement", text: "Faster app detection" },
      { type: "improvement", text: "Reduced CPU usage by 40%" },
      { type: "fix", text: "Fixed whitelist not applying correctly" },
    ],
  },
  {
    version: "0.0.5",
    date: "October 2025",
    type: "alpha",
    title: "Alpha Release",
    description: "First alpha release for early testers.",
    changes: [
      { type: "feature", text: "Basic game blocking functionality" },
      { type: "feature", text: "Password protection" },
      { type: "feature", text: "Simple scheduling" },
    ],
  },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case "feature":
      return <Sparkles className="w-4 h-4 text-green-400" />;
    case "improvement":
      return <Zap className="w-4 h-4 text-blue-400" />;
    case "fix":
      return <Bug className="w-4 h-4 text-orange-400" />;
    case "security":
      return <Shield className="w-4 h-4 text-red-400" />;
    default:
      return <Tag className="w-4 h-4 text-gray-400" />;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case "major":
      return "bg-green-500/20 text-green-400";
    case "minor":
      return "bg-blue-500/20 text-blue-400";
    case "patch":
      return "bg-gray-500/20 text-gray-400";
    case "beta":
      return "bg-yellow-500/20 text-yellow-400";
    case "alpha":
      return "bg-purple-500/20 text-purple-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-surface-base flex flex-col">
      <Navbar />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Changelog</h1>
            <p className="text-xl text-gray-400">
              See what&apos;s new in ParentShield. All notable changes are documented here.
            </p>
          </motion.div>

          {/* Releases */}
          <div className="space-y-12">
            {releases.map((release, i) => (
              <motion.div
                key={release.version}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {/* Timeline line */}
                {i < releases.length - 1 && (
                  <div className="absolute left-4.75 top-12 bottom-0 w-0.5 bg-white/10" />
                )}

                <div className="flex gap-6">
                  {/* Timeline dot */}
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center shrink-0 z-10">
                    <Tag className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1">
                    {/* Version header */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h2 className="text-2xl font-bold text-white">v{release.version}</h2>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadge(release.type)}`}>
                        {release.type}
                      </span>
                      <span className="text-gray-500 text-sm">{release.date}</span>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">{release.title}</h3>
                    <p className="text-gray-400 mb-4">{release.description}</p>

                    {/* Changes */}
                    <div className="bg-surface-card/50 rounded-xl border border-white/5 p-4">
                      <ul className="space-y-2">
                        {release.changes.map((change, j) => (
                          <li key={j} className="flex items-start gap-3">
                            {getTypeIcon(change.type)}
                            <span className="text-gray-300 text-sm">{change.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
