"""
Public API routes - Downloads, Stripe webhooks, health checks.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.subscription import Subscription, SubscriptionStatus, PlanType, PLAN_CONFIG
from app.models.transaction import Transaction, TransactionStatus

# Initialize Stripe (optional)
try:
    import stripe
    stripe.api_key = settings.stripe_secret_key
    STRIPE_ENABLED = bool(settings.stripe_secret_key)
except ImportError:
    stripe = None
    STRIPE_ENABLED = False

router = APIRouter(tags=["Public"])

# Frontend URL for Stripe redirects
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

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
        return {"url": f"{FRONTEND_URL}/success?demo=true"}

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
            success_url=f"{FRONTEND_URL}/success?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}",
            cancel_url=f"{FRONTEND_URL}/pricing",
            customer_email=email,
            metadata={
                "product": f"ParentShield {plan_config['name']}",
                "plan": plan
            }
        )

        return {"sessionId": checkout_session.id, "url": checkout_session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
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
        customer_email = session.get("customer_email")
        stripe_customer_id = session.get("customer")
        stripe_subscription_id = session.get("subscription")
        plan = session.get("metadata", {}).get("plan", "pro")

        print(f"Subscription created for: {customer_email}, plan: {plan}")

        # Find user by email
        result = await db.execute(
            select(User).where(User.email == customer_email)
        )
        user = result.scalar_one_or_none()

        if user:
            # Determine plan config
            plan_type = PlanType.PRO if plan == "pro" else PlanType.BASIC
            plan_config = PLAN_CONFIG[plan_type]

            # Check for existing subscription to upgrade (e.g., trial -> paid)
            existing_result = await db.execute(
                select(Subscription).where(
                    Subscription.user_id == user.id
                ).order_by(Subscription.created_at.desc())
            )
            existing_sub = existing_result.scalar_one_or_none()

            if existing_sub:
                # Upgrade existing subscription
                existing_sub.status = SubscriptionStatus.ACTIVE
                existing_sub.plan_name = plan_config["name"]
                existing_sub.amount = plan_config["price"]
                existing_sub.stripe_subscription_id = stripe_subscription_id
                existing_sub.stripe_customer_id = stripe_customer_id
                existing_sub.current_period_start = datetime.utcnow()
                existing_sub.current_period_end = datetime.utcnow() + timedelta(days=30)
                existing_sub.updated_at = datetime.utcnow()
            else:
                # Create new subscription
                new_sub = Subscription(
                    user_id=user.id,
                    stripe_subscription_id=stripe_subscription_id,
                    stripe_customer_id=stripe_customer_id,
                    status=SubscriptionStatus.ACTIVE,
                    plan_name=plan_config["name"],
                    amount=plan_config["price"],
                    current_period_start=datetime.utcnow(),
                    current_period_end=datetime.utcnow() + timedelta(days=30),
                )
                db.add(new_sub)

            await db.commit()
        else:
            print(f"Warning: No user found for email {customer_email}")

    elif event["type"] == "customer.subscription.deleted":
        subscription_data = event["data"]["object"]
        stripe_sub_id = subscription_data["id"]
        print(f"Subscription cancelled: {stripe_sub_id}")

        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.CANCELED
            sub.canceled_at = datetime.utcnow()
            sub.updated_at = datetime.utcnow()
            await db.commit()

    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        print(f"Invoice paid: {invoice['id']}")

        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()

        if sub:
            # Update subscription period
            sub.status = SubscriptionStatus.ACTIVE
            sub.current_period_start = datetime.utcnow()
            sub.current_period_end = datetime.utcnow() + timedelta(days=30)
            sub.updated_at = datetime.utcnow()

            # Create transaction record
            transaction = Transaction(
                user_id=sub.user_id,
                subscription_id=sub.id,
                stripe_payment_intent_id=invoice.get("payment_intent"),
                stripe_invoice_id=invoice.get("id"),
                amount=invoice.get("amount_paid", 0) / 100,  # Stripe uses cents
                currency=(invoice.get("currency") or "usd").upper(),
                status=TransactionStatus.SUCCEEDED,
                description=f"Subscription payment - {sub.plan_name}",
                invoice_url=invoice.get("hosted_invoice_url"),
            )
            db.add(transaction)
            await db.commit()

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        print(f"Invoice payment failed: {invoice['id']}")

        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.PAST_DUE
            sub.updated_at = datetime.utcnow()
            await db.commit()

    return {"status": "success"}


# ============================================================================
# CONTACT FORM API
# ============================================================================

@router.post("/api/contact")
async def contact(form: ContactForm, background_tasks: BackgroundTasks):
    """Handle contact form submissions"""
    print(f"Contact form: {form.model_dump()}")
    return {"status": "success", "message": "We'll get back to you soon!"}


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
