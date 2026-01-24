"""
ParentShield Website - FastAPI Backend
Professional subscription-based parental control software
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import engine, Base
from app.routers import auth_router, customer_router, admin_router, public_router
from app.routers.app_api import router as app_api_router
from app.routers.device import router as device_router
from app.services.auth_service import AuthService
from app.db.database import async_session_maker


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Create admin user if not exists
    async with async_session_maker() as db:
        await AuthService.create_admin(db)
        await db.commit()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title=settings.app_name,
    description="Protect Your Family's Digital Life",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/downloads", StaticFiles(directory=BASE_DIR / "downloads"), name="downloads")

# Include routers
app.include_router(public_router)
app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(admin_router)
app.include_router(app_api_router)  # Desktop app API
app.include_router(device_router)  # Device & installation tracking


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
