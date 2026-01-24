================================================================================
                     GAMEBLOCKER FOR LINUX - USER GUIDE
================================================================================

SYSTEM REQUIREMENTS
-------------------
- Ubuntu 20.04+, Debian 11+, Fedora 36+, or compatible distro
- x86_64 architecture
- Root/sudo access (required for blocking features)
- systemd (for daemon functionality)
- 50 MB free disk space

================================================================================
                              INSTALLATION
================================================================================

OPTION 1: DEB PACKAGE (Debian/Ubuntu/Mint)
------------------------------------------
1. Download gameblocker_x.x.x_amd64.deb

2. Install via terminal:
   sudo dpkg -i gameblocker_x.x.x_amd64.deb

3. Fix any dependency issues:
   sudo apt-get install -f

4. Launch from application menu or run:
   gameblocker


OPTION 2: RPM PACKAGE (Fedora/RHEL/openSUSE)
--------------------------------------------
1. Download gameblocker-x.x.x-1.x86_64.rpm

2. Install via terminal:
   sudo rpm -i gameblocker-x.x.x-1.x86_64.rpm
   # OR for Fedora:
   sudo dnf install ./gameblocker-x.x.x-1.x86_64.rpm

3. Launch from application menu or run:
   gameblocker


OPTION 3: APPIMAGE (Universal)
------------------------------
1. Download GameBlocker_x.x.x_amd64.AppImage

2. Make it executable:
   chmod +x GameBlocker_x.x.x_amd64.AppImage

3. Run directly:
   ./GameBlocker_x.x.x_amd64.AppImage

Note: AppImage runs without installation but daemon features require
manual setup.

================================================================================
                            FIRST-TIME SETUP
================================================================================

1. On first launch, create a master password
   - This protects settings from being changed
   - WRITE IT DOWN - it cannot be recovered!

2. Install the background daemon for full protection:
   - Click "Install Daemon" in the app, OR
   - Run manually: sudo gameblocker-daemon --install

3. Enable and start the daemon:
   sudo systemctl enable gameblocker-daemon
   sudo systemctl start gameblocker-daemon

================================================================================
                              HOW TO USE
================================================================================

ENABLE BLOCKING:
1. Toggle "Game Blocking" to block gaming apps (Steam, etc.)
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
                         SYSTEMD SERVICE MANAGEMENT
================================================================================

The GameBlocker daemon runs as a systemd service for continuous protection.

CHECK STATUS:
  sudo systemctl status gameblocker-daemon

START SERVICE:
  sudo systemctl start gameblocker-daemon

STOP SERVICE:
  sudo systemctl stop gameblocker-daemon

ENABLE ON BOOT:
  sudo systemctl enable gameblocker-daemon

DISABLE ON BOOT:
  sudo systemctl disable gameblocker-daemon

VIEW LOGS:
  sudo journalctl -u gameblocker-daemon -f

RESTART SERVICE:
  sudo systemctl restart gameblocker-daemon

================================================================================
                             TROUBLESHOOTING
================================================================================

PROBLEM: "Permission denied" errors
SOLUTION: Run with sudo or add your user to appropriate groups:
  sudo usermod -aG adm $USER
  # Log out and back in

PROBLEM: Daemon not starting
SOLUTION:
1. Check status: sudo systemctl status gameblocker-daemon
2. Check logs: sudo journalctl -u gameblocker-daemon -n 50
3. Verify socket: ls -la /run/gameblocker/

PROBLEM: Hosts file not being modified
SOLUTION: Check permissions:
  ls -la /etc/hosts
  # Should be owned by root with 644 permissions

PROBLEM: Blocking not working
SOLUTION:
1. Verify daemon is running: systemctl is-active gameblocker-daemon
2. Check if iptables rules are set: sudo iptables -L -n
3. Restart daemon: sudo systemctl restart gameblocker-daemon

PROBLEM: Forgot master password
SOLUTION: Remove config and restart:
  rm ~/.config/gameblocker/config.enc
  # Relaunch app and create new password

PROBLEM: AppImage won't run
SOLUTION:
  sudo apt install libfuse2  # For Ubuntu 22.04+
  chmod +x GameBlocker_*.AppImage

================================================================================
                              UNINSTALLATION
================================================================================

DEB PACKAGE:
  sudo systemctl stop gameblocker-daemon
  sudo systemctl disable gameblocker-daemon
  sudo apt remove gameblocker

RPM PACKAGE:
  sudo systemctl stop gameblocker-daemon
  sudo systemctl disable gameblocker-daemon
  sudo dnf remove gameblocker  # or: sudo rpm -e gameblocker

APPIMAGE:
  sudo systemctl stop gameblocker-daemon
  sudo systemctl disable gameblocker-daemon
  rm GameBlocker_*.AppImage

CLEAN UP CONFIG FILES:
  rm -rf ~/.config/gameblocker
  sudo rm -f /etc/gameblocker/*
  sudo rm -f /run/gameblocker/gameblocker.sock

RESTORE HOSTS FILE (if needed):
  sudo cp /etc/hosts.backup /etc/hosts

================================================================================
                                SUPPORT
================================================================================

For issues or feature requests:
- GitHub: https://github.com/your-repo/gameblocker

================================================================================
