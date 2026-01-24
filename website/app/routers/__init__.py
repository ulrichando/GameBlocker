from .auth import router as auth_router
from .customer import router as customer_router
from .admin import router as admin_router
from .public import router as public_router

__all__ = [
    "auth_router",
    "customer_router",
    "admin_router",
    "public_router",
]
