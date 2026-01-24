from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from app.db.database import get_db
from app.core.dependencies import ActiveUser, Subscriber, DbSession
from app.schemas.user import UserResponse, UserProfileUpdate
from app.schemas.auth import PasswordChangeRequest
from app.schemas.subscription import SubscriptionResponse
from app.schemas.transaction import TransactionResponse
from app.services.user_service import UserService
from app.models import User

router = APIRouter(prefix="/account", tags=["Customer Portal"])
templates = Jinja2Templates(directory="templates")

# Download files configuration
DOWNLOAD_FILES = {
    "windows": {
        "filename": "parentshield_1.0.0_x64-setup.exe",
        "display_name": "Windows Installer",
        "size": "45 MB",
        "requirements": "Windows 10 or later (64-bit)"
    },
    "macos": {
        "filename": "ParentShield_1.0.0_universal.dmg",
        "display_name": "macOS Installer",
        "size": "52 MB",
        "requirements": "macOS 11 Big Sur or later"
    },
    "linux-appimage": {
        "filename": "parentshield_1.0.0_amd64.AppImage",
        "display_name": "Linux AppImage",
        "size": "48 MB",
        "requirements": "Most Linux distributions"
    },
    "linux-deb": {
        "filename": "parentshield_1.0.0_amd64.deb",
        "display_name": "Debian/Ubuntu Package",
        "size": "42 MB",
        "requirements": "Ubuntu, Debian, Linux Mint"
    },
}


# ============================================================================
# PAGE ENDPOINTS
# ============================================================================

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(
    request: Request,
    current_user: ActiveUser,
    db: DbSession,
):
    """Customer dashboard page."""
    subscription = await UserService.get_user_subscription(db, current_user.id)
    transactions = await UserService.get_user_transactions(db, current_user.id, limit=5)

    return templates.TemplateResponse(
        "customer/dashboard.html",
        {
            "request": request,
            "user": current_user,
            "subscription": subscription,
            "transactions": transactions,
        },
    )


@router.get("/subscription", response_class=HTMLResponse)
async def subscription_page(
    request: Request,
    current_user: ActiveUser,
    db: DbSession,
):
    """Subscription management page."""
    subscription = await UserService.get_user_subscription(db, current_user.id)

    return templates.TemplateResponse(
        "customer/subscription.html",
        {
            "request": request,
            "user": current_user,
            "subscription": subscription,
        },
    )


@router.get("/transactions", response_class=HTMLResponse)
async def transactions_page(
    request: Request,
    current_user: ActiveUser,
    db: DbSession,
):
    """Transaction history page."""
    transactions = await UserService.get_user_transactions(db, current_user.id)

    return templates.TemplateResponse(
        "customer/transactions.html",
        {
            "request": request,
            "user": current_user,
            "transactions": transactions,
        },
    )


@router.get("/downloads", response_class=HTMLResponse)
async def downloads_page(
    request: Request,
    current_user: ActiveUser,
    db: DbSession,
):
    """Downloads page."""
    subscription = await UserService.get_user_subscription(db, current_user.id)
    has_active_subscription = subscription and subscription.status.value == "active"

    return templates.TemplateResponse(
        "customer/downloads.html",
        {
            "request": request,
            "user": current_user,
            "subscription": subscription,
            "has_active_subscription": has_active_subscription,
            "downloads": DOWNLOAD_FILES,
        },
    )


@router.get("/settings", response_class=HTMLResponse)
async def settings_page(
    request: Request,
    current_user: ActiveUser,
):
    """Account settings page."""
    return templates.TemplateResponse(
        "customer/settings.html",
        {
            "request": request,
            "user": current_user,
        },
    )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: ActiveUser):
    """Get current user profile."""
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: UserProfileUpdate,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update user profile."""
    updated_user = await UserService.update_profile(db, current_user, data)
    return updated_user


@router.put("/password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: ActiveUser,
    db: DbSession,
):
    """Change password."""
    success = await UserService.change_password(
        db, current_user, data.current_password, data.new_password
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"message": "Password changed successfully"}


@router.get("/subscription/details", response_model=SubscriptionResponse | None)
async def get_subscription(
    current_user: ActiveUser,
    db: DbSession,
):
    """Get subscription details."""
    subscription = await UserService.get_user_subscription(db, current_user.id)
    return subscription


@router.get("/transactions/list", response_model=list[TransactionResponse])
async def get_transactions(
    current_user: ActiveUser,
    db: DbSession,
    limit: int = 50,
    offset: int = 0,
):
    """Get transaction history."""
    transactions = await UserService.get_user_transactions(db, current_user.id, limit, offset)
    return transactions


@router.get("/download/{platform}")
async def download_file(
    platform: str,
    current_user: Subscriber,
):
    """Download software (requires active subscription)."""
    if platform not in DOWNLOAD_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid platform",
        )

    file_info = DOWNLOAD_FILES[platform]
    file_path = Path("downloads") / platform.split("-")[0] / file_info["filename"]

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    return FileResponse(
        path=file_path,
        filename=file_info["filename"],
        media_type="application/octet-stream",
    )
