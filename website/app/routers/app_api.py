"""
App API routes - Endpoints for the Tauri desktop app to communicate with the platform.
These routes handle license verification, feature access, and app-cloud sync.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.models.subscription import Subscription, SubscriptionStatus, PlanType, PLAN_CONFIG
from app.models.device import Installation
from app.models.parental_controls import Alert, AlertType, AlertSeverity
from app.core.security import decode_token, create_access_token
from app.core.dependencies import get_current_user
from app.services.user_service import UserService
from app.services.sync_service import SyncService
from app.services.webhook_service import WebhookService


router = APIRouter(prefix="/api/v1/app", tags=["App API"])


# ============================================================================
# SCHEMAS
# ============================================================================

class LicenseCheckRequest(BaseModel):
    license_key: str | None = None
    device_id: str


class LicenseCheckResponse(BaseModel):
    valid: bool
    plan: str
    status: str = "none"  # active, trialing, expired_trial, past_due, canceled, none
    is_locked: bool = True
    expires_at: datetime | None
    features: dict
    message: str | None = None
    upgrade_url: str | None = None


class DeviceRegisterRequest(BaseModel):
    device_name: str
    device_id: str
    platform: str  # windows, macos, linux


class AppLoginRequest(BaseModel):
    email: str
    password: str
    device_id: str


class AppLoginResponse(BaseModel):
    success: bool
    access_token: str | None = None
    refresh_token: str | None = None
    user_id: str | None = None
    plan: str | None = None
    status: str | None = None  # active, trialing, expired_trial, past_due, canceled, none
    is_locked: bool = True
    features: dict | None = None
    message: str | None = None
    upgrade_url: str | None = None


class SyncRequest(BaseModel):
    device_id: str
    blocked_sites: list[str] | None = None
    blocked_games: list[str] | None = None
    schedules: dict | None = None


class SyncResponse(BaseModel):
    success: bool
    blocked_sites: list[str] = []
    blocked_games: list[str] = []
    schedules: dict = {}
    last_sync: datetime


class CreateAlertRequest(BaseModel):
    alert_type: str  # blocked_site, blocked_app, screen_time, tamper_attempt, app_uninstall
    severity: str = "info"  # info, warning, critical
    title: str
    message: str
    details: dict | None = None


class CreateAlertResponse(BaseModel):
    success: bool
    alert_id: str | None = None
    message: str | None = None


# ============================================================================
# LICENSE VERIFICATION
# ============================================================================

@router.post("/license/check", response_model=LicenseCheckResponse)
async def check_license(
    request: LicenseCheckRequest,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if the user's license is valid and return their plan features.
    Used by the desktop app on startup to verify subscription status.
    """
    # Extract token from Authorization header
    if not authorization:
        return LicenseCheckResponse(
            valid=False,
            plan="none",
            expires_at=None,
            features={},
            message="No authorization provided. Please login."
        )

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    # Decode the token to get user info
    payload = decode_token(token)
    if not payload:
        return LicenseCheckResponse(
            valid=False,
            plan="none",
            expires_at=None,
            features={},
            message="Invalid or expired token. Please login again."
        )

    user_id = payload.get("sub")
    if not user_id:
        return LicenseCheckResponse(
            valid=False,
            plan="none",
            expires_at=None,
            features={},
            message="Invalid token."
        )

    # Get user's most recent subscription (any status)
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == uuid.UUID(user_id),
        ).order_by(Subscription.created_at.desc())
    )
    subscription = result.scalar_one_or_none()

    upgrade_url = "https://parentshield.app/pricing"

    if not subscription:
        return LicenseCheckResponse(
            valid=False,
            plan="none",
            status="none",
            is_locked=True,
            expires_at=None,
            features={},
            message="No subscription found. Please subscribe to use ParentShield.",
            upgrade_url=upgrade_url,
        )

    # Check if trial has expired
    if subscription.status == SubscriptionStatus.TRIALING:
        if subscription.current_period_end and subscription.current_period_end < datetime.utcnow():
            subscription.status = SubscriptionStatus.INCOMPLETE
            await db.commit()
            return LicenseCheckResponse(
                valid=False,
                plan="expired_trial",
                status="expired_trial",
                is_locked=True,
                expires_at=subscription.current_period_end,
                features={},
                message="Your 7-day free trial has expired. Subscribe to continue using ParentShield.",
                upgrade_url=upgrade_url,
            )

    # Check if active subscription period has expired
    if subscription.status == SubscriptionStatus.ACTIVE:
        if subscription.current_period_end and subscription.current_period_end < datetime.utcnow():
            subscription.status = SubscriptionStatus.PAST_DUE
            await db.commit()
            return LicenseCheckResponse(
                valid=False,
                plan=subscription.plan_name,
                status="past_due",
                is_locked=True,
                expires_at=subscription.current_period_end,
                features={},
                message="Your subscription payment is past due. Please update your payment method.",
                upgrade_url=upgrade_url,
            )

    # Handle already-expired statuses
    if subscription.status in (SubscriptionStatus.CANCELED, SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE):
        status_messages = {
            SubscriptionStatus.CANCELED: "Your subscription has been canceled. Resubscribe to continue.",
            SubscriptionStatus.PAST_DUE: "Your subscription payment is past due. Please update your payment method.",
            SubscriptionStatus.INCOMPLETE: "Your trial has expired. Subscribe to continue using ParentShield.",
        }
        return LicenseCheckResponse(
            valid=False,
            plan=subscription.plan_name if subscription.status != SubscriptionStatus.INCOMPLETE else "expired_trial",
            status=subscription.status.value if subscription.status != SubscriptionStatus.INCOMPLETE else "expired_trial",
            is_locked=True,
            expires_at=subscription.current_period_end,
            features={},
            message=status_messages.get(subscription.status, "Subscription inactive."),
            upgrade_url=upgrade_url,
        )

    # Valid subscription (ACTIVE or TRIALING)
    return LicenseCheckResponse(
        valid=True,
        plan=subscription.plan_name,
        status=subscription.status.value,
        is_locked=False,
        expires_at=subscription.current_period_end,
        features=subscription.features,
        message=None,
    )


# ============================================================================
# APP AUTHENTICATION
# ============================================================================

@router.post("/auth/login", response_model=AppLoginResponse)
async def app_login(
    request: AppLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login from the desktop app. Returns access token and user's plan features.
    """
    from app.core.security import verify_password

    # Find user
    result = await db.execute(
        select(User).where(User.email == request.email.lower())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        return AppLoginResponse(
            success=False,
            message="Invalid email or password."
        )

    if not user.is_active:
        return AppLoginResponse(
            success=False,
            message="Account is suspended."
        )

    # Get or create subscription, and activate trial on first app login
    subscription = await UserService.get_user_subscription(db, user.id)

    # Activate trial if this is the first time the app is being used
    if subscription and subscription.current_period_start is None:
        subscription = await UserService.activate_trial(db, user.id)

    upgrade_url = "https://parentshield.app/pricing"
    plan = "none"
    status = "none"
    features = {}
    is_locked = True
    message = "Login successful. Your 7-day free trial has started!"

    if subscription:
        # Check if trial has expired
        if subscription.status == SubscriptionStatus.TRIALING:
            if subscription.current_period_end and subscription.current_period_end < datetime.utcnow():
                subscription.status = SubscriptionStatus.INCOMPLETE
                await db.commit()
                plan = "expired_trial"
                status = "expired_trial"
                message = "Your 7-day free trial has expired. Subscribe to continue."
            else:
                plan = subscription.plan_name
                status = subscription.status.value
                features = subscription.features
                is_locked = False
                upgrade_url = None
                message = "Login successful."
        elif subscription.status == SubscriptionStatus.ACTIVE:
            if subscription.current_period_end and subscription.current_period_end < datetime.utcnow():
                subscription.status = SubscriptionStatus.PAST_DUE
                await db.commit()
                plan = subscription.plan_name
                status = "past_due"
                message = "Your subscription payment is past due."
            else:
                plan = subscription.plan_name
                status = subscription.status.value
                features = subscription.features
                is_locked = False
                upgrade_url = None
        elif subscription.status == SubscriptionStatus.CANCELED:
            plan = subscription.plan_name
            status = "canceled"
            message = "Your subscription has been canceled. Resubscribe to continue."
        elif subscription.status in (SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE):
            plan = "expired_trial" if subscription.status == SubscriptionStatus.INCOMPLETE else subscription.plan_name
            status = "expired_trial" if subscription.status == SubscriptionStatus.INCOMPLETE else "past_due"
            message = "Your trial has expired. Subscribe to continue." if subscription.status == SubscriptionStatus.INCOMPLETE else "Payment past due."

    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "device_id": request.device_id}
    )

    return AppLoginResponse(
        success=True,
        access_token=access_token,
        user_id=str(user.id),
        plan=plan,
        status=status,
        is_locked=is_locked,
        features=features,
        message=message,
        upgrade_url=upgrade_url,
    )


@router.post("/auth/refresh")
async def app_refresh_token(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    """Refresh the access token for the desktop app."""
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    device_id = payload.get("device_id", "unknown")

    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or suspended")

    # Create new token
    new_token = create_access_token(
        data={"sub": str(user.id), "device_id": device_id},
        expires_delta=timedelta(days=7)  # Longer expiry for app
    )

    return {"access_token": new_token}


# ============================================================================
# FEATURE ACCESS CHECK
# ============================================================================

@router.get("/features")
async def get_user_features(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the features available for the current user's plan.
    Used by the app to enable/disable functionality.
    """
    # Get subscription
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
        ).order_by(Subscription.created_at.desc())
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        return {
            "plan": "none",
            "features": {
                "website_blocking": False,
                "game_blocking": False,
                "max_blocks": 0,
                "web_dashboard": False,
                "activity_reports": False,
                "schedules": False,
                "tamper_protection": None,
            },
            "message": "No active subscription"
        }

    return {
        "plan": subscription.plan_name,
        "features": subscription.features,
        "expires_at": subscription.current_period_end,
        "status": subscription.status.value
    }


# ============================================================================
# SYNC (for Pro users with web dashboard)
# ============================================================================

@router.post("/sync", response_model=SyncResponse)
async def sync_settings(
    request: SyncRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync settings between the desktop app and cloud (push).
    Only available for Pro plan users.
    """
    # Check if user has Pro plan or Premium plan (which includes Pro features)
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
            Subscription.plan_name.in_(["Pro", "Premium Monthly", "Premium Yearly"])
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=403,
            detail="Cloud sync is only available for Pro plan users."
        )

    # Get installation by device_id
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == request.device_id,
            Installation.user_id == user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(
            status_code=404,
            detail="Device not found. Please register the device first."
        )

    # Push settings to cloud
    await SyncService.push_settings(
        db=db,
        installation=installation,
        blocked_sites=request.blocked_sites,
        blocked_games=request.blocked_games,
        schedules=request.schedules,
    )

    return SyncResponse(
        success=True,
        blocked_sites=request.blocked_sites or [],
        blocked_games=request.blocked_games or [],
        schedules=request.schedules or {},
        last_sync=datetime.utcnow()
    )


@router.get("/sync/{device_id}")
async def pull_sync_settings(
    device_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Pull settings from cloud to device.
    Only available for Pro plan users.
    """
    # Check if user has Pro plan
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
            Subscription.plan_name.in_(["Pro", "Premium Monthly", "Premium Yearly"])
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=403,
            detail="Cloud sync is only available for Pro plan users."
        )

    # Get installation
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == device_id,
            Installation.user_id == user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(
            status_code=404,
            detail="Device not found."
        )

    # Pull settings from cloud
    return await SyncService.pull_settings(db=db, installation=installation)


@router.get("/sync/status/{device_id}")
async def get_sync_status(
    device_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get sync status for a device."""
    # Get installation
    result = await db.execute(
        select(Installation).where(
            Installation.device_id == device_id,
            Installation.user_id == user.id,
        )
    )
    installation = result.scalar_one_or_none()

    if not installation:
        raise HTTPException(
            status_code=404,
            detail="Device not found."
        )

    status = await SyncService.get_sync_status(db=db, installation_id=installation.id)

    if not status:
        return {
            "synced": False,
            "message": "Device has never been synced."
        }

    return {
        "synced": True,
        **status
    }


# ============================================================================
# ALERTS (from desktop app)
# ============================================================================

@router.post("/alerts", response_model=CreateAlertResponse)
async def create_alert(
    request: CreateAlertRequest,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Create an alert from the desktop app.
    Used when the app detects blocked content, screen time limits, tamper attempts, etc.
    """
    if not authorization:
        return CreateAlertResponse(
            success=False,
            message="No authorization provided."
        )

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    payload = decode_token(token)
    if not payload:
        return CreateAlertResponse(
            success=False,
            message="Invalid or expired token."
        )

    user_id = payload.get("sub")
    device_id = payload.get("device_id")

    if not user_id:
        return CreateAlertResponse(
            success=False,
            message="Invalid token."
        )

    # Get the user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user:
        return CreateAlertResponse(
            success=False,
            message="User not found."
        )

    # Get the installation by device_id
    installation = None
    if device_id:
        result = await db.execute(
            select(Installation).where(
                Installation.user_id == user.id,
                Installation.device_id == device_id
            )
        )
        installation = result.scalar_one_or_none()

    # Validate alert_type
    try:
        alert_type = AlertType(request.alert_type)
    except ValueError:
        return CreateAlertResponse(
            success=False,
            message=f"Invalid alert_type. Must be one of: {[t.value for t in AlertType]}"
        )

    # Validate severity
    try:
        severity = AlertSeverity(request.severity)
    except ValueError:
        return CreateAlertResponse(
            success=False,
            message=f"Invalid severity. Must be one of: {[s.value for s in AlertSeverity]}"
        )

    # Create the alert
    alert = Alert(
        user_id=user.id,
        installation_id=installation.id if installation else None,
        alert_type=alert_type,
        severity=severity,
        title=request.title,
        message=request.message,
        details=request.details or {}
    )

    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    # Trigger webhooks for this alert (fire and forget)
    try:
        # Map alert type to webhook event
        webhook_event = f"alert.{alert_type.value}"
        webhook_payload = {
            "alert_id": str(alert.id),
            "alert_type": alert_type.value,
            "severity": severity.value,
            "title": request.title,
            "message": request.message,
            "details": request.details,
            "device_id": device_id,
            "device_name": installation.device_name if installation else None,
        }

        # Trigger webhooks - don't await to avoid blocking response
        import asyncio
        asyncio.create_task(
            WebhookService.trigger_webhooks(db, user.id, webhook_event, webhook_payload)
        )
        # Also trigger generic alert.created event
        asyncio.create_task(
            WebhookService.trigger_webhooks(db, user.id, "alert.created", webhook_payload)
        )
    except Exception:
        # Webhooks should never block the main flow
        pass

    return CreateAlertResponse(
        success=True,
        alert_id=str(alert.id),
        message="Alert created successfully."
    )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def app_api_health():
    """Health check for the app API."""
    return {
        "status": "healthy",
        "api_version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }
