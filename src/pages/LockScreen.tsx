import { useState } from "react";
import { Shield, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            {currentlyBlocking ? (
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            ) : (
              <Lock className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <CardTitle className="text-2xl">GameBlocker</CardTitle>
          <CardDescription>
            {currentlyBlocking
              ? "Protection is active. Enter password to access settings."
              : "Enter your password to access settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showRecovery ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!password || isLoading}
              >
                {isLoading ? "Verifying..." : "Unlock"}
              </Button>

              <Button
                variant="link"
                className="w-full text-sm"
                onClick={() => setShowRecovery(true)}
              >
                Forgot password?
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="recovery">Recovery Password</Label>
                <Input
                  id="recovery"
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="WORD-WORD-0000-WORD"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the recovery password you saved during setup
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
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
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleRecovery}
                disabled={!masterPassword || !newPassword || isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>

              <Button
                variant="link"
                className="w-full text-sm"
                onClick={() => {
                  setShowRecovery(false);
                  setError("");
                }}
              >
                Back to login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
