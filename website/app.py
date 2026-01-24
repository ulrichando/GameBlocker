"""
ParentShield Website - FastAPI Backend
Professional subscription-based parental control software
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Initialize Stripe (optional - for production)
try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_ENABLED = bool(stripe.api_key)
except ImportError:
    stripe = None
    STRIPE_ENABLED = False

STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# App configuration
app = FastAPI(
    title="ParentShield",
    description="Protect Your Family's Digital Life",
    version="1.0.0"
)

# Mount static files
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/downloads", StaticFiles(directory=BASE_DIR / "downloads"), name="downloads")

# Templates
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Download statistics (in production, use a database)
download_stats = {
    "windows": 0,
    "macos": 0,
    "linux": 0,
    "total": 0
}

# Pricing configuration
PRICING = {
    "monthly": {
        "amount": 9.48,
        "currency": "USD",
        "interval": "month"
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


class SubscribeRequest(BaseModel):
    email: str


# ============================================================================
# ROUTES
# ============================================================================

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Landing page with hero, features, pricing, and downloads"""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "pricing": PRICING,
        "downloads": DOWNLOAD_FILES,
        "stats": download_stats,
        "stripe_key": STRIPE_PUBLISHABLE_KEY
    })


@app.get("/pricing", response_class=HTMLResponse)
async def pricing_page(request: Request):
    """Dedicated pricing page"""
    return templates.TemplateResponse("pricing.html", {
        "request": request,
        "pricing": PRICING,
        "stripe_key": STRIPE_PUBLISHABLE_KEY
    })


@app.get("/download/{platform}")
async def download_file(platform: str, background_tasks: BackgroundTasks):
    """Handle file downloads with tracking"""
    if platform not in DOWNLOAD_FILES:
        raise HTTPException(status_code=404, detail="Platform not found")

    file_info = DOWNLOAD_FILES[platform]
    file_path = BASE_DIR / "downloads" / platform.split("-")[0] / file_info["filename"]

    # Track download
    background_tasks.add_task(track_download, platform)

    if not file_path.exists():
        # Return a placeholder response if file doesn't exist yet
        raise HTTPException(
            status_code=404,
            detail=f"Download file not available yet. Check back soon!"
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

    # Log download (in production, save to database)
    log_entry = {
        "platform": platform,
        "timestamp": datetime.now().isoformat()
    }
    print(f"Download tracked: {log_entry}")


@app.get("/api/stats")
async def get_stats():
    """Get download statistics"""
    return download_stats


# ============================================================================
# STRIPE INTEGRATION
# ============================================================================

@app.post("/create-checkout-session")
async def create_checkout_session(request: Request):
    """Create Stripe checkout session for subscription"""
    if not STRIPE_ENABLED or stripe is None:
        # Demo mode - redirect to success page
        return {"url": str(request.base_url) + "success?demo=true"}

    try:
        data = await request.json()

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1
            }],
            mode="subscription",
            success_url=str(request.base_url) + "success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=str(request.base_url) + "pricing",
            customer_email=data.get("email"),
            metadata={
                "product": "ParentShield Monthly"
            }
        )

        return {"sessionId": checkout_session.id, "url": checkout_session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, session_id: Optional[str] = None):
    """Subscription success page"""
    return templates.TemplateResponse("success.html", {
        "request": request,
        "session_id": session_id
    })


@app.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not STRIPE_ENABLED or stripe is None:
        return {"status": "stripe not configured"}

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        print(f"Subscription created for: {session.get('customer_email')}")

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        print(f"Subscription cancelled: {subscription['id']}")

    return {"status": "success"}


# ============================================================================
# CONTACT & SUPPORT
# ============================================================================

@app.post("/api/contact")
async def contact(form: ContactForm, background_tasks: BackgroundTasks):
    """Handle contact form submissions"""
    # In production, send email or save to database
    print(f"Contact form: {form.model_dump()}")
    return {"status": "success", "message": "We'll get back to you soon!"}


@app.get("/support", response_class=HTMLResponse)
async def support_page(request: Request):
    """Support page"""
    return templates.TemplateResponse("support.html", {"request": request})


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    """Privacy policy page"""
    return templates.TemplateResponse("privacy.html", {"request": request})


@app.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    """Terms of service page"""
    return templates.TemplateResponse("terms.html", {"request": request})


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
