"""Device and Installation tracking endpoints.

These endpoints are used by:
1. Website - to track downloads
2. Desktop/Mobile app - to register installations and send heartbeats
"""
import secrets
import os
from pathlib import Path
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.dependencies import CurrentUser, OptionalUser, DbSession
from app.models import User, Download, Installation, Platform, DownloadSource, InstallationStatus

# Base directory for downloads
DOWNLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "downloads"


router = APIRouter(prefix="/device", tags=["Device & Installation"])


# ============================================================================
# SCHEMAS
# ============================================================================

class DownloadRequest(BaseModel):
    platform: str  # windows, macos, linux, android, ios
    source: str = "website"  # website, dashboard, email, referral, other
    app_version: str = "1.0.0"


class DownloadResponse(BaseModel):
    download_token: str
    download_url: str
    platform: str
    app_version: str


class InstallationRegisterRequest(BaseModel):
    download_token: str | None = None
    device_id: str
    device_name: str | None = None
    platform: str
    os_version: str | None = None
    app_version: str


class InstallationResponse(BaseModel):
    installation_id: str
    device_id: str
    status: str
    message: str


class HeartbeatRequest(BaseModel):
    device_id: str
    app_version: str | None = None


class HeartbeatResponse(BaseModel):
    status: str
    server_time: str


# ============================================================================
# DOWNLOAD AVAILABILITY
# ============================================================================

@router.get("/downloads/available")
async def get_available_downloads():
    """Get list of available download files.

    Checks the filesystem to see which builds are actually available.
    Used by frontend to show/hide download options.
    """
    version = "0.1.0"

    # Define all possible downloads
    downloads = {
        "windows": {
            "exe-x64": {
                "fileName": f"ParentShield_{version}_x64-setup.exe",
                "label": "64-bit (x64)",
                "description": "For most modern PCs",
            },
            "exe-x86": {
                "fileName": f"ParentShield_{version}_x86-setup.exe",
                "label": "32-bit (x86)",
                "description": "For older 32-bit systems",
            },
            "exe-arm64": {
                "fileName": f"ParentShield_{version}_arm64-setup.exe",
                "label": "ARM64",
                "description": "For Windows on ARM devices",
            },
        },
        "macos": {
            "dmg-universal": {
                "fileName": f"ParentShield_{version}_universal.dmg",
                "label": "Universal",
                "description": "Works on Intel & Apple Silicon",
            },
            "dmg-intel": {
                "fileName": f"ParentShield_{version}_x64.dmg",
                "label": "Intel (x64)",
                "description": "For Intel-based Macs",
            },
            "dmg-arm64": {
                "fileName": f"ParentShield_{version}_aarch64.dmg",
                "label": "Apple Silicon",
                "description": "For M1/M2/M3 Macs",
            },
        },
        "linux": {
            "appimage": {
                "fileName": f"ParentShield_{version}_amd64.AppImage",
                "label": "AppImage",
                "description": "Portable, works on most distros",
            },
            "deb": {
                "fileName": f"ParentShield_{version}_amd64.deb",
                "label": ".deb",
                "description": "For Ubuntu, Debian, Linux Mint",
            },
            "rpm": {
                "fileName": f"ParentShield-{version}-1.x86_64.rpm",
                "label": ".rpm",
                "description": "For Fedora, RHEL, openSUSE",
            },
        },
    }

    result = {}

    for platform, formats in downloads.items():
        platform_dir = DOWNLOADS_DIR / platform
        result[platform] = {
            "available": False,
            "formats": {}
        }

        for format_id, format_info in formats.items():
            file_path = platform_dir / format_info["fileName"]
            exists = file_path.exists()

            file_size = None
            if exists:
                size_bytes = file_path.stat().st_size
                if size_bytes >= 1024 * 1024:
                    file_size = f"{size_bytes / (1024 * 1024):.1f} MB"
                else:
                    file_size = f"{size_bytes / 1024:.1f} KB"
                result[platform]["available"] = True

            result[platform]["formats"][format_id] = {
                "id": format_id,
                "label": format_info["label"],
                "description": format_info["description"],
                "fileName": format_info["fileName"],
                "available": exists,
                "fileSize": file_size,
            }

    return {
        "version": version,
        "platforms": result,
    }


# ============================================================================
# DOWNLOAD TRACKING
# ============================================================================

@router.post("/download", response_model=DownloadResponse)
async def track_download(
    request: Request,
    data: DownloadRequest,
    db: DbSession,
    current_user: OptionalUser = None,
):
    """Track a download event and return download URL.

    Called when user clicks download button on website.
    Can be anonymous (no user) or authenticated.
    """
    # Validate platform
    try:
        platform = Platform(data.platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {data.platform}")

    # Validate source
    try:
        source = DownloadSource(data.source.lower())
    except ValueError:
        source = DownloadSource.OTHER

    # Generate unique download token
    download_token = secrets.token_urlsafe(32)

    # Get request info
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    referrer = request.headers.get("referer")

    # Create download record
    download = Download(
        user_id=current_user.id if current_user else None,
        download_token=download_token,
        platform=platform,
        app_version=data.app_version,
        source=source,
        ip_address=ip_address,
        user_agent=user_agent,
        referrer=referrer,
    )

    db.add(download)
    await db.commit()

    # Generate download URL based on platform
    # File naming: ParentShield_{version}_amd64.{ext}
    download_urls = {
        Platform.WINDOWS: f"/downloads/windows/ParentShield_{data.app_version}_x64-setup.exe",
        Platform.MACOS: f"/downloads/macos/ParentShield_{data.app_version}_universal.dmg",
        Platform.LINUX: f"/downloads/linux/ParentShield_{data.app_version}_amd64.AppImage",
        Platform.ANDROID: f"/downloads/android/ParentShield_{data.app_version}.apk",
        Platform.IOS: "https://apps.apple.com/app/parentshield/id123456789",
    }

    return DownloadResponse(
        download_token=download_token,
        download_url=download_urls.get(platform, "/downloads"),
        platform=platform.value,
        app_version=data.app_version,
    )


# ============================================================================
# INSTALLATION TRACKING
# ============================================================================

@router.post("/installation/register", response_model=InstallationResponse)
async def register_installation(
    data: InstallationRegisterRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Register a new app installation.

    Called by the app when it's first installed and user logs in.
    Requires authentication.
    """
    # Validate platform
    try:
        platform = Platform(data.platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {data.platform}")

    # Link to download if token provided
    download_id = None
    if data.download_token:
        download_result = await db.execute(
            select(Download).where(Download.download_token == data.download_token)
        )
        download = download_result.scalar_one_or_none()
        if download:
            download_id = download.id
            # Update download with user if it was anonymous
            if not download.user_id:
                download.user_id = current_user.id

    # Check if device already exists
    existing_result = await db.execute(
        select(Installation).where(Installation.device_id == data.device_id)
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Update existing installation
        existing.user_id = current_user.id
        existing.app_version = data.app_version
        existing.os_version = data.os_version
        existing.device_name = data.device_name
        existing.status = InstallationStatus.ACTIVE
        existing.last_seen = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        await db.commit()

        return InstallationResponse(
            installation_id=str(existing.id),
            device_id=existing.device_id,
            status="updated",
            message="Installation updated successfully",
        )

    # Create new installation
    installation = Installation(
        user_id=current_user.id,
        download_id=download_id,
        device_id=data.device_id,
        device_name=data.device_name,
        platform=platform,
        os_version=data.os_version,
        app_version=data.app_version,
        status=InstallationStatus.ACTIVE,
    )

    db.add(installation)
    await db.commit()
    await db.refresh(installation)

    return InstallationResponse(
        installation_id=str(installation.id),
        device_id=installation.device_id,
        status="registered",
        message="Installation registered successfully",
    )


@router.post("/installation/heartbeat", response_model=HeartbeatResponse)
async def installation_heartbeat(
    data: HeartbeatRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Send heartbeat to indicate app is still active.

    Called periodically by the app to update last_seen time.
    """
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == data.device_id,
            Installation.user_id == current_user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")

    # Update last seen and version if provided
    installation.last_seen = datetime.utcnow()
    installation.status = InstallationStatus.ACTIVE
    if data.app_version:
        installation.app_version = data.app_version

    await db.commit()

    return HeartbeatResponse(
        status="ok",
        server_time=datetime.utcnow().isoformat(),
    )


@router.post("/installation/unregister")
async def unregister_installation(
    data: HeartbeatRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Mark installation as uninstalled.

    Called when user uninstalls the app (if possible to detect).
    """
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == data.device_id,
            Installation.user_id == current_user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")

    installation.status = InstallationStatus.UNINSTALLED
    installation.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "unregistered", "message": "Installation marked as uninstalled"}


@router.get("/installations")
async def list_user_installations(
    current_user: CurrentUser,
    db: DbSession,
):
    """List all installations for the current user."""
    result = await db.execute(
        select(Installation)
        .where(Installation.user_id == current_user.id)
        .order_by(Installation.last_seen.desc())
    )
    installations = result.scalars().all()

    return [
        {
            "id": str(i.id),
            "device_id": i.device_id,
            "device_name": i.device_name,
            "platform": i.platform.value,
            "os_version": i.os_version,
            "app_version": i.app_version,
            "status": i.status.value,
            "is_blocked": i.is_blocked,
            "blocked_reason": i.blocked_reason,
            "last_seen": i.last_seen.isoformat(),
            "created_at": i.created_at.isoformat(),
        }
        for i in installations
    ]


@router.delete("/installation/{installation_id}")
async def delete_installation(
    installation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete an installation record.

    Allows users to remove a device from their account.
    """
    from uuid import UUID
    try:
        inst_uuid = UUID(installation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid installation ID")

    result = await db.execute(
        select(Installation).where(
            Installation.id == inst_uuid,
            Installation.user_id == current_user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")

    await db.delete(installation)
    await db.commit()

    return {"status": "deleted", "message": "Device removed successfully"}


@router.get("/installation/status")
async def get_installation_status(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Check if this installation is blocked."""
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == device_id,
            Installation.user_id == current_user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        return {"registered": False, "is_blocked": False, "blocked_reason": None}

    return {
        "registered": True,
        "is_blocked": installation.is_blocked,
        "blocked_reason": installation.blocked_reason,
        "status": installation.status.value,
    }
