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
from app.models import User, Download, Installation, Platform, DownloadSource, InstallationStatus, ActivationCode, DeviceLinkingCode
from app.services.user_service import UserService
from app.core.security import create_access_token, create_refresh_token

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
    version = "0.2.0"

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

    # Activate the user's trial subscription (if they have one and it hasn't started yet)
    await UserService.activate_trial(db, current_user.id)

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


# ============================================================================
# ACTIVATION CODES
# ============================================================================

def generate_activation_code() -> str:
    """Generate a random 6-character activation code in ABC-123 format."""
    import string
    letters = ''.join(secrets.choice(string.ascii_uppercase) for _ in range(3))
    numbers = ''.join(secrets.choice(string.digits) for _ in range(3))
    return f"{letters}-{numbers}"


class ActivationCodeResponse(BaseModel):
    id: str
    code: str
    expires_at: str
    is_used: bool
    used_at: str | None = None
    used_device_id: str | None = None
    created_at: str


@router.post("/activation-codes", response_model=ActivationCodeResponse)
async def create_activation_code(
    current_user: CurrentUser,
    db: DbSession,
):
    """Generate a new activation code for linking devices.

    The code can be entered in the desktop/mobile app to link
    the device to the user's account without entering credentials.
    Code expires in 15 minutes.
    """
    from datetime import timedelta

    # Generate unique code
    max_attempts = 10
    code = None
    for _ in range(max_attempts):
        candidate = generate_activation_code()
        # Check if code already exists
        existing = await db.execute(
            select(ActivationCode).where(ActivationCode.code == candidate)
        )
        if not existing.scalar_one_or_none():
            code = candidate
            break

    if not code:
        raise HTTPException(status_code=500, detail="Failed to generate unique code")

    # Create activation code with 15 minute expiry
    activation_code = ActivationCode(
        user_id=current_user.id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )

    db.add(activation_code)
    await db.commit()
    await db.refresh(activation_code)

    return ActivationCodeResponse(
        id=str(activation_code.id),
        code=activation_code.code,
        expires_at=activation_code.expires_at.isoformat(),
        is_used=activation_code.is_used,
        used_at=activation_code.used_at.isoformat() if activation_code.used_at else None,
        used_device_id=activation_code.used_device_id,
        created_at=activation_code.created_at.isoformat(),
    )


@router.get("/activation-codes")
async def list_activation_codes(
    current_user: CurrentUser,
    db: DbSession,
):
    """List all activation codes for the current user."""
    result = await db.execute(
        select(ActivationCode)
        .where(ActivationCode.user_id == current_user.id)
        .order_by(ActivationCode.created_at.desc())
    )
    codes = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "code": c.code,
            "expires_at": c.expires_at.isoformat(),
            "is_used": c.is_used,
            "is_expired": c.expires_at < datetime.utcnow(),
            "used_at": c.used_at.isoformat() if c.used_at else None,
            "used_device_id": c.used_device_id,
            "created_at": c.created_at.isoformat(),
        }
        for c in codes
    ]


@router.delete("/activation-codes/{code_id}")
async def delete_activation_code(
    code_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """Delete/revoke an activation code."""
    try:
        code_uuid = UUID(code_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid code ID")

    result = await db.execute(
        select(ActivationCode).where(
            ActivationCode.id == code_uuid,
            ActivationCode.user_id == current_user.id,
        )
    )
    code = result.scalar_one_or_none()

    if not code:
        raise HTTPException(status_code=404, detail="Activation code not found")

    await db.delete(code)
    await db.commit()

    return {"status": "deleted", "message": "Activation code revoked"}


# ============================================================================
# DEVICE LINKING (reverse flow - code displayed on app, entered on website)
# ============================================================================

class LinkDeviceRequest(BaseModel):
    code: str  # The code displayed on the device


class LinkDeviceResponse(BaseModel):
    success: bool
    device_id: str | None = None
    device_name: str | None = None
    platform: str | None = None
    message: str | None = None
    error: str | None = None


@router.post("/link-device", response_model=LinkDeviceResponse)
async def link_device_with_code(
    data: LinkDeviceRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Link a device to the user's account using a code displayed on the device.

    The app generates a linking code and displays it. The user enters this code
    on the website to link the device to their account.
    """
    from datetime import timedelta

    # Normalize the code
    code = data.code.upper().replace("-", "").replace(" ", "")
    if len(code) == 6:
        code = f"{code[:3]}-{code[3:]}"
    else:
        return LinkDeviceResponse(
            success=False,
            error="Invalid code format. Expected 6 characters (ABC-123)."
        )

    # Find the linking code
    result = await db.execute(
        select(DeviceLinkingCode).where(DeviceLinkingCode.code == code)
    )
    linking_code = result.scalar_one_or_none()

    if not linking_code:
        return LinkDeviceResponse(
            success=False,
            error="Invalid code. Please check and try again."
        )

    # Check if expired
    if linking_code.expires_at < datetime.utcnow():
        return LinkDeviceResponse(
            success=False,
            error="This code has expired. Please generate a new one on the device."
        )

    # Check if already linked
    if linking_code.is_linked:
        return LinkDeviceResponse(
            success=False,
            error="This code has already been used."
        )

    # Create or update installation for this device
    install_result = await db.execute(
        select(Installation).where(Installation.device_id == linking_code.device_id)
    )
    installation = install_result.scalar_one_or_none()

    platform = Platform.LINUX  # Default
    if linking_code.platform:
        try:
            platform = Platform(linking_code.platform.lower())
        except ValueError:
            pass

    if installation:
        # Update existing installation
        installation.user_id = current_user.id
        installation.device_name = linking_code.device_name
        installation.platform = platform
        installation.status = InstallationStatus.ACTIVE
        installation.last_seen = datetime.utcnow()
    else:
        # Create new installation
        installation = Installation(
            user_id=current_user.id,
            device_id=linking_code.device_id,
            device_name=linking_code.device_name,
            platform=platform,
            app_version="unknown",
            status=InstallationStatus.ACTIVE,
        )
        db.add(installation)

    # Generate tokens for the device
    access_token = create_access_token(
        data={"sub": str(current_user.id), "device_id": linking_code.device_id},
        expires_delta=timedelta(days=7)
    )
    refresh_token = create_refresh_token(
        data={"sub": str(current_user.id), "device_id": linking_code.device_id}
    )

    # Mark the linking code as linked and store tokens
    linking_code.is_linked = True
    linking_code.linked_at = datetime.utcnow()
    linking_code.linked_user_id = current_user.id
    linking_code.access_token = access_token
    linking_code.refresh_token = refresh_token

    await db.commit()

    # Activate the user's trial if applicable
    await UserService.activate_trial(db, current_user.id)

    return LinkDeviceResponse(
        success=True,
        device_id=linking_code.device_id,
        device_name=linking_code.device_name,
        platform=linking_code.platform,
        message="Device linked successfully! The app will automatically sign in."
    )


@router.get("/pending-links")
async def get_pending_link_requests(
    current_user: CurrentUser,
    db: DbSession,
):
    """Get pending device link requests (codes that haven't been used yet)."""
    # This shows devices that generated link codes but haven't been linked
    # Not strictly necessary but useful for dashboard
    result = await db.execute(
        select(DeviceLinkingCode).where(
            DeviceLinkingCode.is_linked == False,
            DeviceLinkingCode.expires_at > datetime.utcnow()
        ).order_by(DeviceLinkingCode.created_at.desc())
    )
    codes = result.scalars().all()

    return [
        {
            "code": c.code,
            "device_id": c.device_id,
            "device_name": c.device_name,
            "platform": c.platform,
            "expires_at": c.expires_at.isoformat(),
            "created_at": c.created_at.isoformat(),
        }
        for c in codes
    ]
