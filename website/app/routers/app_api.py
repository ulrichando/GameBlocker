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
from app.core.security import decode_token, create_access_token
from app.core.dependencies import get_current_user


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
    expires_at: datetime | None
    features: dict
    message: str | None = None


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
    features: dict | None = None
    message: str | None = None


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

    # Get user's subscription
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == uuid.UUID(user_id),
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
        ).order_by(Subscription.created_at.desc())
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        return LicenseCheckResponse(
            valid=False,
            plan="none",
            expires_at=None,
            features={},
            message="No active subscription found."
        )

    # Get plan features
    plan_config = PLAN_CONFIG.get(subscription.plan_type, {})
    features = plan_config.get("features", {})

    return LicenseCheckResponse(
        valid=True,
        plan=subscription.plan_type.value,
        expires_at=subscription.current_period_end,
        features=features,
        message=None
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

    # Get subscription
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
        ).order_by(Subscription.created_at.desc())
    )
    subscription = result.scalar_one_or_none()

    plan = "none"
    features = {}
    if subscription:
        plan = subscription.plan_type.value
        plan_config = PLAN_CONFIG.get(subscription.plan_type, {})
        features = plan_config.get("features", {})

    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "device_id": request.device_id}
    )

    return AppLoginResponse(
        success=True,
        access_token=access_token,
        user_id=str(user.id),
        plan=plan,
        features=features,
        message="Login successful."
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

    plan_config = PLAN_CONFIG.get(subscription.plan_type, {})
    return {
        "plan": subscription.plan_type.value,
        "features": plan_config.get("features", {}),
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
    Sync settings between the desktop app and cloud.
    Only available for Pro plan users.
    """
    # Check if user has Pro plan
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
            Subscription.plan_type == PlanType.PRO
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=403,
            detail="Cloud sync is only available for Pro plan users."
        )

    # TODO: Implement actual sync storage
    # For now, just acknowledge the sync
    return SyncResponse(
        success=True,
        blocked_sites=request.blocked_sites or [],
        blocked_games=request.blocked_games or [],
        schedules=request.schedules or {},
        last_sync=datetime.utcnow()
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
