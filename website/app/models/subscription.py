import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, Enum, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class SubscriptionStatus(str, PyEnum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"
    INCOMPLETE = "incomplete"


class PlanType(str, PyEnum):
    TRIAL = "trial"       # Free trial - 7 days, all features
    BASIC = "basic"       # $4.99/mo - Website blocking only, 30 blocks limit
    PRO = "pro"           # $9.99/mo - Full features + platform access


# Plan configurations
PLAN_CONFIG = {
    PlanType.TRIAL: {
        "name": "Free Trial",
        "price": 0.00,
        "features": {
            "website_blocking": True,
            "game_blocking": True,
            "max_blocks": -1,  # Unlimited
            "web_dashboard": True,
            "activity_reports": True,
            "schedules": True,
            "tamper_protection": "advanced",
        },
        "trial_days": 7,
    },
    PlanType.BASIC: {
        "name": "Basic",
        "price": 4.99,
        "stripe_price_id": None,  # Set from env
        "features": {
            "website_blocking": True,
            "game_blocking": False,
            "max_blocks": 30,
            "web_dashboard": False,
            "activity_reports": False,
            "schedules": False,
            "tamper_protection": "basic",
        },
    },
    PlanType.PRO: {
        "name": "Pro",
        "price": 9.99,
        "stripe_price_id": None,  # Set from env
        "features": {
            "website_blocking": True,
            "game_blocking": True,
            "max_blocks": -1,  # Unlimited
            "web_dashboard": True,
            "activity_reports": True,
            "schedules": True,
            "tamper_protection": "advanced",
        },
    },
}


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.INCOMPLETE, nullable=False)
    plan_name: Mapped[str] = mapped_column(String(100), default="Free Trial", nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def features(self) -> dict:
        """Get the features for this subscription's plan."""
        # Match plan_name to PlanType
        plan_map = {
            "Free Trial": PlanType.TRIAL,
            "Basic": PlanType.BASIC,
            "Pro": PlanType.PRO,
        }
        plan_type = plan_map.get(self.plan_name, PlanType.TRIAL)
        return PLAN_CONFIG.get(plan_type, {}).get("features", {})

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="subscription")


# Import for type hints
from app.models.user import User
from app.models.transaction import Transaction
