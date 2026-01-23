import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useBlockingStore } from "@/stores/blocking-store";
import { FirstRun } from "@/pages/FirstRun";
import { LockScreen } from "@/pages/LockScreen";
import { Dashboard } from "@/pages/Dashboard";
import { Schedule } from "@/pages/Schedule";
import { Blocklist } from "@/pages/Blocklist";
import { Settings } from "@/pages/Settings";

type Page = "dashboard" | "schedule" | "blocklist" | "settings";

function App() {
  const { isConfigured, isAuthenticated, isLoading, checkAuthStatus } = useAuthStore();
  const {
    fetchStatus,
    runBlockingCheck,
    currentlyBlocking,
    gameBlockingEnabled,
    aiBlockingEnabled,
    dnsBlockingEnabled
  } = useBlockingStore();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const blockingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated]);

  // Continuous blocking check every 5 seconds while authenticated and protection is active
  const isAnyBlockingEnabled = gameBlockingEnabled || aiBlockingEnabled || dnsBlockingEnabled;

  useEffect(() => {
    if (!isAuthenticated || !currentlyBlocking || !isAnyBlockingEnabled) {
      if (blockingIntervalRef.current) {
        clearInterval(blockingIntervalRef.current);
        blockingIntervalRef.current = null;
      }
      return;
    }

    // Initial check
    runBlockingCheck();

    // Set up interval
    blockingIntervalRef.current = setInterval(() => {
      runBlockingCheck();
    }, 5000);

    return () => {
      if (blockingIntervalRef.current) {
        clearInterval(blockingIntervalRef.current);
        blockingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, currentlyBlocking, gameBlockingEnabled, aiBlockingEnabled, dnsBlockingEnabled]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // First run setup
  if (!isConfigured) {
    return <FirstRun />;
  }

  // Lock screen
  if (!isAuthenticated) {
    return <LockScreen />;
  }

  // Main app
  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  const handleBack = () => {
    setCurrentPage("dashboard");
  };

  switch (currentPage) {
    case "schedule":
      return <Schedule onBack={handleBack} />;
    case "blocklist":
      return <Blocklist onBack={handleBack} />;
    case "settings":
      return <Settings onBack={handleBack} />;
    default:
      return <Dashboard onNavigate={handleNavigate} />;
  }
}

export default App;
