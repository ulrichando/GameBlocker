"""Webhook models for event notifications."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSON

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class WebhookEventType(str, PyEnum):
    """Events that can trigger webhooks."""
    ALERT_CREATED = "alert.created"
    ALERT_BLOCKED_SITE = "alert.blocked_site"
    ALERT_BLOCKED_APP = "alert.blocked_app"
    ALERT_SCREEN_TIME_LIMIT = "alert.screen_time_limit"
    ALERT_TAMPER_ATTEMPT = "alert.tamper_attempt"
    DEVICE_OFFLINE = "device.offline"
    DEVICE_ONLINE = "device.online"
    SETTINGS_CHANGED = "settings.changed"
    TEST = "test"


class Webhook(Base):
    """Webhook configurations for event notifications."""
    __tablename__ = "webhooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    url: Mapped[str] = mapped_column(String(500), nullable=False)
    secret: Mapped[str] = mapped_column(String(255), nullable=False)  # For HMAC signature
    events: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)  # ["alert.created", ...]

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="webhooks")
    deliveries: Mapped[list["WebhookDelivery"]] = relationship(
        "WebhookDelivery",
        back_populates="webhook",
        cascade="all, delete-orphan",
        order_by="WebhookDelivery.created_at.desc()"
    )


class WebhookDelivery(Base):
    """Audit trail for webhook deliveries."""
    __tablename__ = "webhook_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("webhooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Delivery status
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Retry tracking
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    webhook: Mapped["Webhook"] = relationship("Webhook", back_populates="deliveries")

    @property
    def is_successful(self) -> bool:
        """Check if the delivery was successful."""
        return self.delivered_at is not None and self.response_status is not None and 200 <= self.response_status < 300

    @property
    def can_retry(self) -> bool:
        """Check if the delivery can be retried."""
        return self.delivered_at is None and self.attempts < self.max_attempts
