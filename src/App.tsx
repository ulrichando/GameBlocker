import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/stores/auth-store";
import { useBlockingStore } from "@/stores/blocking-store";
import { useLicenseStore } from "@/stores/license-store";
import "@/stores/theme-store"; // Initialize theme on app load
import { FirstRun } from "@/pages/FirstRun";
import { LockScreen } from "@/pages/LockScreen";
import { SubscriptionLockScreen } from "@/components/SubscriptionLockScreen";
import { Dashboard } from "@/pages/Dashboard";
import { Schedule } from "@/pages/Schedule";
import { Blocklist } from "@/pages/Blocklist";
import { Settings } from "@/pages/Settings";
import { Activity } from "@/pages/Activity";
import { Alerts } from "@/pages/Alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiService } from "@/services/api";

type Page = "dashboard" | "schedule" | "blocklist" | "settings" | "activity" | "alerts";

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
  const {
    isLocked: isSubscriptionLocked,
    checkLicense,
    getLicenseState,
    initLicenseListener,
    status: subscriptionStatus,
  } = useLicenseStore();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const blockingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quit password protection
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitPassword, setQuitPassword] = useState("");
  const [quitError, setQuitError] = useState("");
  const [isQuitting, setIsQuitting] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    // Initialize API service to register installation and start heartbeat
    apiService.initialize().catch(console.error);
    // Load cached license state immediately
    getLicenseState();
    // Set up listener for license-state-changed events from Rust backend
    const unlistenPromise = initLicenseListener();
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // Listen for quit-requested event from tray menu
  useEffect(() => {
    const unlisten = listen("quit-requested", () => {
      setShowQuitModal(true);
      setQuitPassword("");
      setQuitError("");
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleQuitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsQuitting(true);
    setQuitError("");

    try {
      const success = await invoke<boolean>("quit_with_password", { password: quitPassword });
      if (!success) {
        setQuitError("Incorrect password");
        setQuitPassword("");
      }
      // If successful, the app will exit
    } catch (err) {
      setQuitError("Failed to quit: " + String(err));
    } finally {
      setIsQuitting(false);
    }
  };

  const handleQuitCancel = () => {
    setShowQuitModal(false);
    setQuitPassword("");
    setQuitError("");
  };

  // Quit modal overlay (shown on top of any page)
  const quitModal = showQuitModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Enter Password to Quit
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Parental password is required to close ParentShield.
        </p>
        <form onSubmit={handleQuitSubmit}>
          <Input
            type="password"
            placeholder="Enter password"
            value={quitPassword}
            onChange={(e) => setQuitPassword(e.target.value)}
            className="mb-3"
            autoFocus
            disabled={isQuitting}
          />
          {quitError && (
            <p className="text-red-500 text-sm mb-3">{quitError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuitCancel}
              disabled={isQuitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!quitPassword || isQuitting}
            >
              {isQuitting ? "Quitting..." : "Quit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      // Check license when user authenticates
      checkLicense();
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
      <>
        {quitModal}
        <div className="h-full flex items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  // First run setup
  if (!isConfigured) {
    return <>{quitModal}<FirstRun /></>;
  }

  // Lock screen (parental password)
  if (!isAuthenticated) {
    return <>{quitModal}<LockScreen /></>;
  }

  // Subscription lock screen (shown when trial expired or no active subscription)
  if (isSubscriptionLocked && subscriptionStatus !== "none") {
    return <>{quitModal}<SubscriptionLockScreen /></>;
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
      return <>{quitModal}<Schedule onBack={handleBack} /></>;
    case "blocklist":
      return <>{quitModal}<Blocklist onBack={handleBack} /></>;
    case "settings":
      return <>{quitModal}<Settings onBack={handleBack} /></>;
    case "activity":
      return <>{quitModal}<Activity onBack={handleBack} /></>;
    case "alerts":
      return <>{quitModal}<Alerts onBack={handleBack} /></>;
    default:
      return <>{quitModal}<Dashboard onNavigate={handleNavigate} /></>;
  }
}

export default App;
