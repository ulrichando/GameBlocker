================================================================================
                     GAMEBLOCKER FOR MACOS - USER GUIDE
================================================================================

SYSTEM REQUIREMENTS
-------------------
- macOS 11 (Big Sur) or later
- Apple Silicon (M1/M2/M3) or Intel Mac
- Administrator privileges (required for blocking features)
- 50 MB free disk space

================================================================================
                              INSTALLATION
================================================================================

1. Double-click the DMG file:
   - GameBlocker_x.x.x_universal.dmg

2. Drag GameBlocker to the Applications folder

3. First launch - bypassing Gatekeeper:
   - Right-click (or Control+click) on GameBlocker in Applications
   - Select "Open" from the menu
   - Click "Open" in the security dialog

4. Grant required permissions when prompted:
   - Accessibility access (for process monitoring)
   - Full Disk Access (for hosts file modification)

GRANTING PERMISSIONS MANUALLY:
1. Open System Settings > Privacy & Security
2. Click "Accessibility" > Enable GameBlocker
3. Click "Full Disk Access" > Enable GameBlocker

================================================================================
                            FIRST-TIME SETUP
================================================================================

1. On first launch, create a master password
   - This protects settings from being changed
   - WRITE IT DOWN - it cannot be recovered!

2. The app will ask to install the background daemon
   - Click "Install Daemon" for full protection
   - Enter your Mac password when prompted
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
                          DAEMON MANAGEMENT
================================================================================

The GameBlocker daemon runs in the background for continuous protection.

CHECK DAEMON STATUS:
Open Terminal and run:
  launchctl list | grep gameblocker

MANUALLY START DAEMON:
  sudo launchctl start com.gameblocker.daemon

MANUALLY STOP DAEMON:
  sudo launchctl stop com.gameblocker.daemon

VIEW DAEMON LOGS:
  cat /var/log/gameblocker.log
  cat /var/log/gameblocker.error.log

UNINSTALL DAEMON:
  sudo launchctl unload /Library/LaunchDaemons/com.gameblocker.daemon.plist
  sudo rm /Library/LaunchDaemons/com.gameblocker.daemon.plist

================================================================================
                             TROUBLESHOOTING
================================================================================

PROBLEM: "GameBlocker can't be opened" error
SOLUTION:
1. Go to System Settings > Privacy & Security
2. Click "Open Anyway" next to the GameBlocker message

PROBLEM: Blocking not working
SOLUTION:
1. Check if daemon is running: launchctl list | grep gameblocker
2. Check permissions in System Settings > Privacy & Security
3. Try reinstalling the daemon from the app

PROBLEM: Can't modify hosts file
SOLUTION: Grant Full Disk Access in System Settings > Privacy & Security

PROBLEM: Forgot master password
SOLUTION: Uninstall and reinstall GameBlocker (settings will be reset)

PROBLEM: App won't quit
SOLUTION: Use Activity Monitor to force quit, or Terminal:
  killall GameBlocker

================================================================================
                              UNINSTALLATION
================================================================================

1. Stop and remove the daemon:
   sudo launchctl unload /Library/LaunchDaemons/com.gameblocker.daemon.plist
   sudo rm /Library/LaunchDaemons/com.gameblocker.daemon.plist

2. Restore hosts file (if needed):
   sudo cp /etc/hosts.backup /etc/hosts

3. Remove the application:
   - Drag GameBlocker from Applications to Trash
   - Empty Trash

4. Remove configuration files:
   rm -rf ~/Library/Application\ Support/com.gameblocker.app
   rm -rf ~/.config/gameblocker

================================================================================
                                SUPPORT
================================================================================

For issues or feature requests:
- GitHub: https://github.com/your-repo/gameblocker

================================================================================
