#!/bin/bash
# Script to copy Tauri build artifacts to website downloads folder
# Run this after building on each platform

VERSION="0.2.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOWNLOADS_DIR="$PROJECT_ROOT/website/downloads"

echo "Copying ParentShield v$VERSION build artifacts to website downloads..."

# Create directories if they don't exist
mkdir -p "$DOWNLOADS_DIR/windows"
mkdir -p "$DOWNLOADS_DIR/macos"
mkdir -p "$DOWNLOADS_DIR/linux"

# Linux builds
if [ -d "$PROJECT_ROOT/src-tauri/target/release/bundle" ]; then
    echo "Copying Linux builds..."

    # AppImage
    if [ -f "$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/parent-shield_${VERSION}_amd64.AppImage" ]; then
        cp "$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/parent-shield_${VERSION}_amd64.AppImage" \
           "$DOWNLOADS_DIR/linux/ParentShield_${VERSION}_amd64.AppImage"
        echo "  - Copied AppImage"
    fi

    # DEB
    if [ -f "$PROJECT_ROOT/src-tauri/target/release/bundle/deb/parent-shield_${VERSION}_amd64.deb" ]; then
        cp "$PROJECT_ROOT/src-tauri/target/release/bundle/deb/parent-shield_${VERSION}_amd64.deb" \
           "$DOWNLOADS_DIR/linux/ParentShield_${VERSION}_amd64.deb"
        echo "  - Copied .deb"
    fi

    # RPM
    rpm_file=$(find "$PROJECT_ROOT/src-tauri/target/release/bundle/rpm" -name "*.rpm" 2>/dev/null | head -1)
    if [ -n "$rpm_file" ]; then
        cp "$rpm_file" "$DOWNLOADS_DIR/linux/ParentShield-${VERSION}-1.x86_64.rpm"
        echo "  - Copied .rpm"
    fi
fi

# Windows builds (run this part on Windows or copy manually)
# x64
if [ -f "$PROJECT_ROOT/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_x64-setup.exe" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_x64-setup.exe" \
       "$DOWNLOADS_DIR/windows/"
    echo "  - Copied Windows x64"
fi

# x86
if [ -f "$PROJECT_ROOT/src-tauri/target/i686-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_x86-setup.exe" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/i686-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_x86-setup.exe" \
       "$DOWNLOADS_DIR/windows/"
    echo "  - Copied Windows x86"
fi

# ARM64
if [ -f "$PROJECT_ROOT/src-tauri/target/aarch64-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_arm64-setup.exe" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/aarch64-pc-windows-msvc/release/bundle/nsis/ParentShield_${VERSION}_arm64-setup.exe" \
       "$DOWNLOADS_DIR/windows/"
    echo "  - Copied Windows ARM64"
fi

# macOS builds (run this part on macOS or copy manually)
# Universal
if [ -f "$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_universal.dmg" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_universal.dmg" \
       "$DOWNLOADS_DIR/macos/"
    echo "  - Copied macOS Universal"
fi

# Intel
if [ -f "$PROJECT_ROOT/src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_x64.dmg" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_x64.dmg" \
       "$DOWNLOADS_DIR/macos/"
    echo "  - Copied macOS Intel"
fi

# Apple Silicon
if [ -f "$PROJECT_ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_aarch64.dmg" ]; then
    cp "$PROJECT_ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/ParentShield_${VERSION}_aarch64.dmg" \
       "$DOWNLOADS_DIR/macos/"
    echo "  - Copied macOS Apple Silicon"
fi

echo ""
echo "Done! Current downloads:"
echo ""
echo "Linux:"
ls -lh "$DOWNLOADS_DIR/linux/" 2>/dev/null || echo "  (empty)"
echo ""
echo "Windows:"
ls -lh "$DOWNLOADS_DIR/windows/" 2>/dev/null || echo "  (empty)"
echo ""
echo "macOS:"
ls -lh "$DOWNLOADS_DIR/macos/" 2>/dev/null || echo "  (empty)"
