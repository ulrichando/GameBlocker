import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TitleBar } from "@/components/TitleBar";
import { useAuthStore } from "@/stores/auth-store";
import { useBlockingStore } from "@/stores/blocking-store";

export function LockScreen() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const { login, resetWithMaster, isLoading } = useAuthStore();
  const { currentlyBlocking } = useBlockingStore();

  const handleLogin = async () => {
    setError("");
    const success = await login(password);
    if (!success) {
      setError("Invalid password");
      setPassword("");
    }
  };

  const handleRecovery = async () => {
    setError("");
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    const success = await resetWithMaster(masterPassword, newPassword);
    if (!success) {
      setError("Invalid recovery password");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (showRecovery) {
        handleRecovery();
      } else {
        handleLogin();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Title bar with window controls */}
      <TitleBar />
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto scrollable-content">
      <Card className="w-full max-w-sm fluent-card">
        <CardHeader className="text-center pb-2 pt-6 px-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary">
            {currentlyBlocking ? (
              <Shield className="h-7 w-7 text-white" />
            ) : (
              <Lock className="h-7 w-7 text-white" />
            )}
          </div>
          <CardTitle className="text-lg font-semibold">ParentShield</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            {currentlyBlocking
              ? "Protection is active. Enter password to access settings."
              : "Enter your password to access settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2 px-6 pb-6">
          {!showRecovery ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your password"
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!password || isLoading}
              >
                {isLoading ? "Verifying..." : "Unlock"}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowRecovery(true)}
              >
                Forgot password?
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="recovery" className="text-xs">Recovery Password</Label>
                <Input
                  id="recovery"
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="WORD-WORD-0000-WORD"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the recovery password you saved during setup
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter new password"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleRecovery}
                disabled={!masterPassword || !newPassword || isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowRecovery(false);
                  setError("");
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
