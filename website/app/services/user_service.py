from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import User, Subscription, Transaction, SubscriptionStatus
from app.schemas.user import UserProfileUpdate
from app.core.security import get_password_hash, verify_password


class UserService:
    """Service for user operations."""

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
        """Get user by ID."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
        """Get user by email."""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_profile(db: AsyncSession, user: User, data: UserProfileUpdate) -> User:
        """Update user profile."""
        if data.first_name is not None:
            user.first_name = data.first_name
        if data.last_name is not None:
            user.last_name = data.last_name
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        current_password: str,
        new_password: str,
    ) -> bool:
        """Change user password."""
        if not verify_password(current_password, user.password_hash):
            return False

        user.password_hash = get_password_hash(new_password)
        await db.commit()
        return True

    @staticmethod
    async def get_user_subscription(db: AsyncSession, user_id: UUID) -> Subscription | None:
        """Get user's active subscription."""
        result = await db.execute(
            select(Subscription)
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_transactions(
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        """Get user's transactions."""
        result = await db.execute(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_user_total_spent(db: AsyncSession, user_id: UUID) -> float:
        """Get total amount spent by user."""
        result = await db.execute(
            select(func.sum(Transaction.amount))
            .where(Transaction.user_id == user_id)
            .where(Transaction.status == "succeeded")
        )
        total = result.scalar()
        return float(total) if total else 0.0

    @staticmethod
    async def suspend_user(db: AsyncSession, user_id: UUID) -> bool:
        """Suspend a user account."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.is_active = False
        await db.commit()
        return True

    @staticmethod
    async def activate_user(db: AsyncSession, user_id: UUID) -> bool:
        """Activate a user account."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.is_active = True
        await db.commit()
        return True
