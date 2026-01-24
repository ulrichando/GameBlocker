"""Device and Installation tracking endpoints.

These endpoints are used by:
1. Website - to track downloads
2. Desktop/Mobile app - to register installations and send heartbeats
"""
import secrets
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.dependencies import CurrentUser, OptionalUser, DbSession
from app.models import User, Download, Installation, Platform, DownloadSource, InstallationStatus


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
    download_urls = {
        Platform.WINDOWS: f"/downloads/ParentShield-{data.app_version}-Setup.exe",
        Platform.MACOS: f"/downloads/ParentShield-{data.app_version}.dmg",
        Platform.LINUX: f"/downloads/ParentShield-{data.app_version}.AppImage",
        Platform.ANDROID: f"/downloads/ParentShield-{data.app_version}.apk",
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
            "last_seen": i.last_seen.isoformat(),
            "created_at": i.created_at.isoformat(),
        }
        for i in installations
    ]
