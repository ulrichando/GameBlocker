import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, Check, Copy, Server, AlertTriangle, Link2, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TitleBar } from "@/components/TitleBar";
import { useAuthStore } from "@/stores/auth-store";
import { useDaemonStore } from "@/stores/daemon-store";
import { apiService } from "@/services/api";

export function FirstRun() {
  const [step, setStep] = useState(0); // Start at step 0 for activation choice
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [daemonError, setDaemonError] = useState("");

  // Activation code state
  const [activationCode, setActivationCode] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [linkedEmail, setLinkedEmail] = useState("");

  const { setupPassword, completeSetup, masterPassword, isLoading } = useAuthStore();
  const { status: daemonStatus, fetchStatus: fetchDaemonStatus, installDaemon, isLoading: daemonLoading } = useDaemonStore();

  // Handle activation code redemption
  const handleActivateCode = async () => {
    if (!activationCode.trim()) {
      setActivationError("Please enter an activation code");
      return;
    }

    setActivationLoading(true);
    setActivationError("");

    const result = await apiService.redeemActivationCode(activationCode);

    setActivationLoading(false);

    if (result.success) {
      setLinkedEmail(result.user_email || "");
      setStep(1); // Go to password setup
    } else {
      setActivationError(result.error || "Invalid activation code");
    }
  };

  // Format activation code as user types (XXX-XXX format)
  const formatActivationCode = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length <= 3) return cleaned;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  };

  useEffect(() => {
    if (step === 3) {
      fetchDaemonStatus();
    }
  }, [step]);

  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const strength = getPasswordStrength(password);
  const strengthText = ["Very Weak", "Weak", "Fair", "Good", "Strong"][strength] || "Very Weak";
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"][strength] || "bg-gray-300";

  const handleSetupPassword = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const result = await setupPassword(password);
    if (result.success) {
      setStep(2);
    } else {
      setError(result.error || "Failed to set up password");
    }
  };

  const handleCopyMasterPassword = () => {
    if (masterPassword) {
      navigator.clipboard.writeText(masterPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInstallDaemon = async () => {
    setDaemonError("");
    const success = await installDaemon();
    if (!success) {
      setDaemonError("Failed to install daemon. You may need to run the install command manually with sudo.");
    }
  };

  const handleSkipDaemon = () => {
    completeSetup();
  };

  const handleFinishWithDaemon = () => {
    completeSetup();
  };

  // Step 0: Choose activation method
  if (step === 0) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto scrollable-content">
          <Card className="w-full max-w-sm fluent-card">
            <CardHeader className="text-center pt-6 px-6 pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <CardTitle className="text-lg">Welcome to ParentShield</CardTitle>
              <CardDescription className="text-xs">
                Link your account or set up as a new user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              {/* Activation Code Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  Have an activation code?
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="XXX-XXX"
                    value={activationCode}
                    onChange={(e) => {
                      setActivationCode(formatActivationCode(e.target.value));
                      setActivationError("");
                    }}
                    maxLength={7}
                    className="text-center text-lg font-mono tracking-widest"
                  />
                  {activationError && (
                    <p className="text-xs text-destructive">{activationError}</p>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleActivateCode}
                    disabled={activationLoading || activationCode.length < 7}
                  >
                    {activationLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Link Account
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Get your code from{" "}
                  <button
                    onClick={() => window.open("https://parentshield.app/dashboard/devices", "_blank")}
                    className="text-primary hover:underline"
                  >
                    parentshield.app/dashboard
                  </button>
                </p>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* New User Section */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep(1)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Set Up as New User
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Title bar with window controls */}
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto scrollable-content">
        <Card className="w-full max-w-sm fluent-card">
          <CardHeader className="text-center pt-6 px-6 pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-lg">
              {linkedEmail ? "Account Linked!" : "Welcome to ParentShield"}
            </CardTitle>
            <CardDescription className="text-xs">
              {linkedEmail ? (
                <>Linked to <strong>{linkedEmail}</strong>. Now set up your local password.</>
              ) : (
                "Set up your parent password to protect the settings"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-6 pb-6">
            <div className="space-y-2">
              <Label htmlFor="password">Parent Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${i < strength ? strengthColor : "bg-gray-200"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Strength: {strengthText}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder="Confirm your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleSetupPassword}
              disabled={!password || !confirmPassword || isLoading}
            >
              {isLoading ? "Setting up..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  if (step === 2) {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Title bar with window controls */}
      <TitleBar />
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto scrollable-content">
      <Card className="w-full max-w-sm fluent-card">
        <CardHeader className="text-center pt-6 px-6 pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-success">
            <Check className="h-7 w-7 text-success-foreground" />
          </div>
          <CardTitle className="text-lg">Save Your Recovery Password</CardTitle>
          <CardDescription className="text-xs">
            Write this down and keep it safe. You'll need it if you forget your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-1.5">
              Master Recovery Password
            </p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-mono font-bold text-amber-900 dark:text-amber-200">
                {masterPassword}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyMasterPassword}
                className="h-7 w-7 p-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-700 dark:text-red-400">
              <strong>Important:</strong> This password is never stored and cannot be recovered.
              Write it down and keep it in a safe place.
            </p>
          </div>

          <Button className="w-full" onClick={() => setStep(3)}>
            I've saved my recovery password
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
  }

  // Step 3: Daemon installation
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Title bar with window controls */}
      <TitleBar />
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto scrollable-content">
      <Card className="w-full max-w-sm fluent-card">
        <CardHeader className="text-center pt-6 px-6 pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
            <Server className="h-7 w-7 text-secondary-foreground" />
          </div>
          <CardTitle className="text-lg">Install Background Service</CardTitle>
          <CardDescription className="text-xs">
            The background service ensures blocking works even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
            <p className="text-xs text-primary font-medium">
              Why install the service?
            </p>
            <ul className="text-xs text-primary/80 mt-1.5 space-y-0.5 list-disc list-inside">
              <li>Blocking continues when app is closed</li>
              <li>No password prompts for settings changes</li>
              <li>Automatic firewall protection</li>
              <li>Continuous process monitoring</li>
            </ul>
          </div>

          {daemonStatus?.installed && daemonStatus?.running && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-xs">
                Service is installed and running!
              </AlertDescription>
            </Alert>
          )}

          {daemonError && (
            <Alert variant="destructive" className="rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{daemonError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {!daemonStatus?.installed ? (
              <Button
                className="w-full"
                onClick={handleInstallDaemon}
                disabled={daemonLoading}
              >
                {daemonLoading ? "Installing..." : "Install Background Service"}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleFinishWithDaemon}
              >
                Continue to Dashboard
              </Button>
            )}

            {!daemonStatus?.installed && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={handleSkipDaemon}
              >
                Skip for now (not recommended)
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            The service requires administrator privileges to install.
            You can install it later from Settings.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
