================================================================================
                    GAMEBLOCKER FOR WINDOWS - USER GUIDE
================================================================================

SYSTEM REQUIREMENTS
-------------------
- Windows 10 or later (64-bit)
- Administrator privileges (required for blocking features)
- 50 MB free disk space

================================================================================
                              INSTALLATION
================================================================================

1. Double-click the installer file:
   - gameblocker_x.x.x_x64_en-US.msi  (recommended)
   - OR gameblocker_x.x.x_x64-setup.exe

2. If Windows SmartScreen appears, click "More info" then "Run anyway"

3. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation location (default: C:\Program Files\GameBlocker)
   - Click "Install"

4. When prompted, allow administrator access

5. Launch GameBlocker from:
   - Start Menu > GameBlocker
   - Desktop shortcut (if created)

================================================================================
                            FIRST-TIME SETUP
================================================================================

1. On first launch, create a master password
   - This protects settings from being changed
   - WRITE IT DOWN - it cannot be recovered!

2. The app will ask to install the background service
   - Click "Install Service" for full protection
   - This ensures blocking works even after restart

================================================================================
                              HOW TO USE
================================================================================

ENABLE BLOCKING:
1. Toggle "Game Blocking" to block gaming apps (Steam, Epic, etc.)
2. Toggle "AI Blocking" to block AI services (ChatGPT, Claude, etc.)
3. Toggle "Website Blocking" to block gaming/AI websites

MANAGE BLOCKLISTS:
1. Go to Settings > Blocklists
2. Add custom applications or domains to block
3. Add exceptions to the whitelist

SET UP SCHEDULES:
1. Go to Settings > Schedule
2. Click "Add Schedule" or use presets:
   - School Hours (Mon-Fri 8AM-3PM)
   - Bedtime (9PM-7AM daily)
   - Weekend Gaming (Sat-Sun 2PM-6PM allowed)

================================================================================
                         WINDOWS SERVICE MANAGEMENT
================================================================================

The GameBlocker service runs in the background for continuous protection.

VIEW SERVICE STATUS:
1. Press Win+R, type "services.msc", press Enter
2. Find "GameBlocker Parental Control"
3. Status should show "Running"

MANUALLY START/STOP SERVICE:
- Open Command Prompt as Administrator
- Start:  sc start GameBlocker
- Stop:   sc stop GameBlocker

UNINSTALL SERVICE:
- Open Command Prompt as Administrator
- Run: sc delete GameBlocker

================================================================================
                             TROUBLESHOOTING
================================================================================

PROBLEM: "Access Denied" errors
SOLUTION: Right-click GameBlocker > Run as Administrator

PROBLEM: Blocking not working
SOLUTION:
1. Check if service is running (services.msc)
2. Restart the service
3. Check Windows Firewall isn't blocking GameBlocker

PROBLEM: Can't access legitimate websites
SOLUTION: Add them to whitelist in Settings > Blocklists > Allowed Domains

PROBLEM: Forgot master password
SOLUTION: Uninstall and reinstall GameBlocker (settings will be reset)

PROBLEM: VPN bypassing blocks
SOLUTION: Enable "Block VPN Ports" in Settings > Advanced

================================================================================
                              UNINSTALLATION
================================================================================

1. Open Windows Settings (Win+I)
2. Go to Apps > Installed Apps
3. Find "GameBlocker"
4. Click the three dots (...) > Uninstall
5. Follow the uninstall wizard

To manually clean up after uninstall:
1. Delete: C:\Program Files\GameBlocker
2. Delete: C:\Users\[YourName]\AppData\Roaming\gameblocker

================================================================================
                                SUPPORT
================================================================================

For issues or feature requests:
- GitHub: https://github.com/your-repo/gameblocker

================================================================================
