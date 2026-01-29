"use client";

import { motion } from "framer-motion";
import {
  Code,
  Key,
  Shield,
  Zap,
  ChevronRight,
  Check,
  Globe,
  Bell,
  Laptop,
  Clock,
  Lock,
  ArrowRight,
  Webhook
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const pricingPlans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "For testing and development",
    requests: "100 requests/day",
    features: [
      "100 API requests per day",
      "Read-only access",
      "Community support",
      "Basic rate limiting",
    ],
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    description: "For production applications",
    requests: "10,000 requests/day",
    popular: true,
    features: [
      "10,000 API requests per day",
      "Full read/write access",
      "Webhooks included",
      "Priority support",
      "Higher rate limits",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large-scale integrations",
    requests: "Unlimited",
    features: [
      "Unlimited API requests",
      "Dedicated support",
      "Custom rate limits",
      "SLA guarantee",
      "White-label options",
    ],
  },
];

const endpoints = [
  { method: "GET", path: "/devices", description: "List all connected devices" },
  { method: "GET", path: "/devices/:id", description: "Get device details" },
  { method: "GET", path: "/alerts", description: "List recent alerts" },
  { method: "GET", path: "/blocked-apps", description: "Get blocked applications" },
  { method: "POST", path: "/blocked-apps", description: "Add blocked application" },
  { method: "GET", path: "/web-filters", description: "Get web filtering rules" },
  { method: "POST", path: "/web-filters", description: "Add web filter" },
  { method: "GET", path: "/screen-time", description: "Get screen time data" },
  { method: "PUT", path: "/settings", description: "Update parental settings" },
];

const webhookEvents = [
  { event: "alert.created", description: "When any alert is triggered" },
  { event: "alert.blocked_site", description: "When a blocked website is accessed" },
  { event: "alert.blocked_app", description: "When a blocked app is launched" },
  { event: "device.online", description: "When a device comes online" },
  { event: "device.offline", description: "When a device goes offline" },
  { event: "settings.changed", description: "When settings are modified" },
];

const features = [
  {
    icon: Shield,
    title: "Secure by Design",
    description: "API key authentication with scoped permissions. Your data stays protected.",
  },
  {
    icon: Zap,
    title: "Real-time Webhooks",
    description: "Get instant notifications when events occur. HMAC-signed for security.",
  },
  {
    icon: Code,
    title: "RESTful API",
    description: "Clean, predictable endpoints following REST best practices. Easy to integrate.",
  },
  {
    icon: Clock,
    title: "High Availability",
    description: "99.9% uptime SLA with global edge caching for fast response times.",
  },
];

const useCases = [
  {
    icon: Bell,
    title: "Custom Notifications",
    description: "Build custom alert systems that notify you via Slack, Discord, or SMS when kids access blocked content.",
  },
  {
    icon: Laptop,
    title: "Dashboard Integrations",
    description: "Integrate ParentShield data into your existing family management or school monitoring tools.",
  },
  {
    icon: Globe,
    title: "Automation",
    description: "Automate schedule changes, update block lists, or adjust settings based on external triggers.",
  },
];

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-surface-base flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary-600/20 rounded-full px-4 py-2 mb-6">
              <Code className="w-4 h-4 text-primary-400" />
              <span className="text-primary-400 text-sm font-medium">Developer API</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Build with ParentShield API
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Integrate powerful parental controls into your apps. Monitor devices, manage settings, and receive real-time alerts programmatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Get API Key Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  Sign In to Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">Why Use Our API?</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              A robust, secure API designed for developers who need reliable parental control integrations.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-surface-card rounded-xl border border-white/5 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <div className="w-12 h-12 bg-primary-600/20 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">What Can You Build?</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((useCase, i) => (
              <motion.div
                key={useCase.title}
                className="bg-gradient-to-br from-surface-card to-surface-elevated rounded-xl border border-white/5 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4">
                  <useCase.icon className="w-5 h-5 text-primary-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{useCase.title}</h3>
                <p className="text-gray-500 text-sm">{useCase.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Preview */}
      <section className="py-16 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-3xl font-bold text-white mb-4">Simple Integration</h2>
              <p className="text-gray-400 mb-6">
                Get started in minutes with our straightforward REST API. Just grab your API key and make your first request.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <p className="text-gray-300">Sign up and get your API key from the dashboard</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <p className="text-gray-300">Add the API key to your request headers</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <p className="text-gray-300">Start making API calls to manage devices</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="bg-surface-base rounded-xl border border-white/10 p-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-500 text-sm ml-2">Example Request</span>
              </div>
              <pre className="text-sm overflow-x-auto">
                <code className="text-gray-300">
{`curl -X GET "https://api.parentshield.com/api/v1/devices" \\
  -H "X-API-Key: your_api_key_here"

# Response
{
  "devices": [
    {
      "id": "dev_123",
      "name": "Kids Laptop",
      "status": "online",
      "last_seen": "2024-01-15T10:30:00Z"
    }
  ]
}`}
                </code>
              </pre>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Endpoints Preview */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">Available Endpoints</h2>
            <p className="text-gray-400">
              Full documentation available after signing up
            </p>
          </motion.div>

          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="divide-y divide-white/5">
              {endpoints.map((endpoint, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                        endpoint.method === "GET"
                          ? "bg-green-500/20 text-green-400"
                          : endpoint.method === "POST"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-gray-300">/api/v1{endpoint.path}</span>
                  </div>
                  <span className="text-gray-500 text-sm hidden md:block">{endpoint.description}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-surface-elevated border-t border-white/5 text-center">
              <p className="text-gray-500 text-sm">
                <Lock className="w-4 h-4 inline mr-1" />
                Sign in to access full endpoint documentation with request/response schemas
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Webhooks Preview */}
      <section className="py-16 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <Webhook className="w-5 h-5 text-primary-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">Real-time Webhooks</h2>
              </div>
              <p className="text-gray-400 mb-6">
                Subscribe to events and get notified instantly when something happens. Perfect for building real-time dashboards and notification systems.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-primary-400" />
                  HTTPS endpoints with retry logic
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-primary-400" />
                  Signature verification for security
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-primary-400" />
                  Delivery logs and debugging tools
                </li>
              </ul>
            </motion.div>

            <motion.div
              className="bg-surface-card rounded-xl border border-white/5 overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="p-4 border-b border-white/5">
                <h3 className="font-semibold text-white">Available Events</h3>
              </div>
              <div className="divide-y divide-white/5">
                {webhookEvents.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <code className="text-primary-400 text-sm font-mono">{item.event}</code>
                    <span className="text-gray-500 text-sm">{item.description}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">Simple Pricing</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Start free, scale as you grow. API access is included with your ParentShield subscription.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                className={`bg-surface-card rounded-2xl p-6 border ${
                  plan.popular ? "border-primary-500 ring-1 ring-primary-500/20" : "border-white/5"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                {plan.popular && (
                  <span className="text-xs bg-primary-500 text-white px-3 py-1 rounded-full font-medium">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mt-4">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-primary-400 mb-6">{plan.requests}</p>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-primary-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block">
                  <Button
                    variant={plan.popular ? "default" : "secondary"}
                    className="w-full"
                  >
                    Get Started
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Authentication Info */}
      <section className="py-16 px-6 bg-surface-card/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-600/20 rounded-xl flex items-center justify-center shrink-0">
                <Key className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Authentication</h2>
                <p className="text-gray-400 mb-4">
                  All API requests require authentication using an API key. Include your key in the <code className="text-primary-400 bg-surface-base px-1.5 py-0.5 rounded text-sm">X-API-Key</code> header:
                </p>
                <div className="bg-surface-base rounded-lg p-4 font-mono text-sm mb-4">
                  <code className="text-gray-300">X-API-Key: ps_live_xxxxxxxxxxxxxxxxxxxx</code>
                </div>
                <p className="text-gray-500 text-sm">
                  API keys can be generated from your{" "}
                  <Link href="/dashboard/api" className="text-primary-400 hover:underline">
                    dashboard
                  </Link>
                  {" "}after signing up. Keys have configurable scopes and optional expiration dates.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Build?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Create your free account and get your API key in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Create Free Account
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  I Already Have an Account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
