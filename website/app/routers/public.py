"""
Public routes - Landing page, pricing, downloads, etc.
These routes are accessible without authentication.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.config import settings

# Initialize Stripe (optional)
try:
    import stripe
    stripe.api_key = settings.stripe_secret_key
    STRIPE_ENABLED = bool(settings.stripe_secret_key)
except ImportError:
    stripe = None
    STRIPE_ENABLED = False

router = APIRouter(tags=["Public"])
templates = Jinja2Templates(directory="templates")

# Download statistics (in production, use a database)
download_stats = {
    "windows": 0,
    "macos": 0,
    "linux": 0,
    "total": 0
}

# Pricing configuration - 3 tiers
PRICING = {
    "trial": {
        "name": "Free Trial",
        "amount": 0.00,
        "currency": "USD",
        "interval": "once",
        "trial_days": 7,
        "features": {
            "website_blocking": True,
            "game_blocking": True,
            "max_blocks": -1,
            "web_dashboard": True,
        }
    },
    "basic": {
        "name": "Basic",
        "amount": 4.99,
        "currency": "USD",
        "interval": "month",
        "stripe_price_id": getattr(settings, 'stripe_basic_price_id', None),
        "features": {
            "website_blocking": True,
            "game_blocking": False,
            "max_blocks": 30,
            "web_dashboard": False,
        }
    },
    "pro": {
        "name": "Pro",
        "amount": 9.99,
        "currency": "USD",
        "interval": "month",
        "stripe_price_id": getattr(settings, 'stripe_pro_price_id', None),
        "features": {
            "website_blocking": True,
            "game_blocking": True,
            "max_blocks": -1,
            "web_dashboard": True,
        }
    }
}

# Download files mapping
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
    }
}


class ContactForm(BaseModel):
    name: str
    email: str
    message: str


# ============================================================================
# LANDING PAGE
# ============================================================================

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Landing page with hero, features, pricing, and downloads"""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "pricing": PRICING,
        "downloads": DOWNLOAD_FILES,
        "stats": download_stats,
        "stripe_key": settings.stripe_publishable_key
    })


@router.get("/pricing", response_class=HTMLResponse)
async def pricing_page(request: Request):
    """Dedicated pricing page"""
    return templates.TemplateResponse("pricing.html", {
        "request": request,
        "pricing": PRICING,
        "stripe_key": settings.stripe_publishable_key
    })


# ============================================================================
# PUBLIC DOWNLOADS
# ============================================================================

@router.get("/download/{platform}")
async def download_file(platform: str, background_tasks: BackgroundTasks):
    """Handle file downloads with tracking (public - redirects to login if premium)"""
    if platform not in DOWNLOAD_FILES:
        raise HTTPException(status_code=404, detail="Platform not found")

    file_info = DOWNLOAD_FILES[platform]
    file_path = Path("downloads") / platform.split("-")[0] / file_info["filename"]

    # Track download
    background_tasks.add_task(track_download, platform)

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Download file not available yet. Check back soon!"
        )

    return FileResponse(
        path=file_path,
        filename=file_info["filename"],
        media_type="application/octet-stream"
    )


async def track_download(platform: str):
    """Track download statistics"""
    base_platform = platform.split("-")[0]
    if base_platform in download_stats:
        download_stats[base_platform] += 1
    download_stats["total"] += 1

    log_entry = {
        "platform": platform,
        "timestamp": datetime.now().isoformat()
    }
    print(f"Download tracked: {log_entry}")


@router.get("/api/stats")
async def get_stats():
    """Get download statistics"""
    return download_stats


# ============================================================================
# STRIPE CHECKOUT
# ============================================================================

class CheckoutRequest(BaseModel):
    plan: str = "pro"
    email: str | None = None


@router.post("/create-checkout-session")
async def create_checkout_session(request: Request):
    """Create Stripe checkout session for subscription"""
    if not STRIPE_ENABLED or stripe is None:
        return {"url": str(request.base_url) + "success?demo=true"}

    try:
        data = await request.json()
        plan = data.get("plan", "pro")
        email = data.get("email")

        # Validate plan
        if plan not in ["basic", "pro"]:
            raise HTTPException(status_code=400, detail="Invalid plan")

        plan_config = PRICING.get(plan)
        if not plan_config:
            raise HTTPException(status_code=400, detail="Plan not found")

        # Get stripe price ID from config or settings
        stripe_price_id = plan_config.get("stripe_price_id")
        if not stripe_price_id:
            # Fallback to settings
            if plan == "basic":
                stripe_price_id = getattr(settings, 'stripe_basic_price_id', settings.stripe_price_id)
            else:
                stripe_price_id = getattr(settings, 'stripe_pro_price_id', settings.stripe_price_id)

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": stripe_price_id,
                "quantity": 1
            }],
            mode="subscription",
            success_url=str(request.base_url) + f"success?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}",
            cancel_url=str(request.base_url) + "pricing",
            customer_email=email,
            metadata={
                "product": f"ParentShield {plan_config['name']}",
                "plan": plan
            }
        )

        return {"sessionId": checkout_session.id, "url": checkout_session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, session_id: Optional[str] = None):
    """Subscription success page"""
    return templates.TemplateResponse("success.html", {
        "request": request,
        "session_id": session_id
    })


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not STRIPE_ENABLED or stripe is None:
        return {"status": "stripe not configured"}

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        print(f"Subscription created for: {session.get('customer_email')}")
        # TODO: Create user and subscription in database

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        print(f"Subscription cancelled: {subscription['id']}")
        # TODO: Update subscription status in database

    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        print(f"Invoice paid: {invoice['id']}")
        # TODO: Create transaction record

    return {"status": "success"}


# ============================================================================
# CONTACT & SUPPORT
# ============================================================================

@router.post("/api/contact")
async def contact(form: ContactForm, background_tasks: BackgroundTasks):
    """Handle contact form submissions"""
    print(f"Contact form: {form.model_dump()}")
    return {"status": "success", "message": "We'll get back to you soon!"}


@router.get("/support", response_class=HTMLResponse)
async def support_page(request: Request):
    """Support page"""
    return templates.TemplateResponse("support.html", {"request": request})


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    """Privacy policy page"""
    return templates.TemplateResponse("privacy.html", {"request": request})


@router.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    """Terms of service page"""
    return templates.TemplateResponse("terms.html", {"request": request})


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }
