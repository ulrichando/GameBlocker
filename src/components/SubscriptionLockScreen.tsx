import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Shield, Lock, CreditCard, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { useLicenseStore } from "@/stores/license-store";

const PLANS = [
  {
    name: "Basic",
    price: "$4.99",
    interval: "month",
    features: [
      "Website blocking",
      "Up to 30 blocked items",
      "Basic tamper protection",
    ],
    missing: [
      "Game blocking",
      "Web dashboard",
      "Activity reports",
      "Schedules",
    ],
  },
  {
    name: "Pro",
    price: "$9.99",
    interval: "month",
    highlight: true,
    features: [
      "Website blocking",
      "Game blocking",
      "Unlimited blocked items",
      "Web dashboard",
      "Activity reports",
      "Schedules",
      "Advanced tamper protection",
    ],
    missing: [],
  },
];

export function SubscriptionLockScreen() {
  const { status, message, upgradeUrl, checkLicense, isLoading } = useLicenseStore();
  const [checking, setChecking] = useState(false);

  const handleSubscribe = async () => {
    const url = upgradeUrl || "https://parentshield.app/pricing";
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleRefreshLicense = async () => {
    setChecking(true);
    await checkLicense();
    setChecking(false);
  };

  const statusLabel = (() => {
    switch (status) {
      case "expired_trial": return "Trial Expired";
      case "past_due": return "Payment Past Due";
      case "canceled": return "Subscription Canceled";
      default: return "Subscription Required";
    }
  })();

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fluent 2 Custom Title Bar */}
      <TitleBar>
        <div className="flex items-center px-3 gap-2 h-full">
          <div className="w-5 h-5 bg-gradient-primary rounded flex items-center justify-center">
            <Shield className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold">ParentShield</span>
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Lock Status */}
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900">
                <Lock className="h-8 w-8 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200">
                    {statusLabel}
                  </h2>
                  <Badge variant="secondary" className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                    Locked
                  </Badge>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {message || "Subscribe to unlock all ParentShield features."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlight
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950 dark:border-blue-600 ring-2 ring-blue-400"
                  : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.highlight && (
                    <Badge className="bg-blue-600 text-white">Recommended</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground line-through">
                      <span className="h-4 w-4 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={handleSubscribe}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Subscribe Now
          </Button>

          <Button
            variant="outline"
            onClick={handleRefreshLicense}
            disabled={isLoading || checking}
            className="w-full max-w-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Already subscribed? Check again"}
          </Button>
        </div>
        </div>
      </main>
    </div>
  );
}
