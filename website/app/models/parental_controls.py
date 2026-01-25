"""Parental control models for screen time, blocked apps, web filters, alerts, and settings."""
import uuid
from datetime import datetime, time
from enum import Enum as PyEnum
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, Integer, Boolean, JSON, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.device import Installation


class WebFilterCategory(str, PyEnum):
    """Predefined website filter categories."""
    ADULT = "adult"
    SOCIAL_MEDIA = "social_media"
    GAMING = "gaming"
    GAMBLING = "gambling"
    STREAMING = "streaming"
    SHOPPING = "shopping"
    NEWS = "news"
    FORUMS = "forums"


class AlertType(str, PyEnum):
    """Types of alerts that can be generated."""
    BLOCKED_SITE = "blocked_site"
    BLOCKED_APP = "blocked_app"
    SCREEN_TIME_LIMIT = "screen_time_limit"
    TAMPER_ATTEMPT = "tamper_attempt"
    DEVICE_OFFLINE = "device_offline"
    NEW_APP_INSTALLED = "new_app_installed"


class AlertSeverity(str, PyEnum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ScreenTimeConfig(Base):
    """Daily screen time limits per device/installation."""
    __tablename__ = "screen_time_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("installations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Daily limits in minutes (0 = unlimited)
    monday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tuesday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wednesday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    thursday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    friday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    saturday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sunday_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Allowed time windows (optional)
    allowed_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    allowed_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Grace period before enforcing (minutes)
    grace_period: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    installation: Mapped["Installation"] = relationship("Installation", back_populates="screen_time_config")


class BlockedApp(Base):
    """Blocked applications/games per device."""
    __tablename__ = "blocked_apps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("installations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    app_identifier: Mapped[str] = mapped_column(String(500), nullable=False)  # exe path, bundle ID, package name
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    is_game: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional schedule (JSON: {"monday": {"start": "09:00", "end": "17:00"}, ...})
    schedule: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    installation: Mapped["Installation"] = relationship("Installation", back_populates="blocked_apps")


class WebFilterConfig(Base):
    """Web filtering configuration per device."""
    __tablename__ = "web_filter_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("installations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Category filters (JSON array of WebFilterCategory values)
    blocked_categories: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Safe search enforcement
    enforce_safe_search: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    installation: Mapped["Installation"] = relationship("Installation", back_populates="web_filter_config")
    custom_rules: Mapped[list["WebFilterRule"]] = relationship("WebFilterRule", back_populates="config", cascade="all, delete-orphan")


class WebFilterRule(Base):
    """Custom URL blocking/allowing rules."""
    __tablename__ = "web_filter_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("web_filter_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    url_pattern: Mapped[str] = mapped_column(String(500), nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # True=block, False=allow
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    config: Mapped["WebFilterConfig"] = relationship("WebFilterConfig", back_populates="custom_rules")


class Alert(Base):
    """Notifications/alerts from devices."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("installations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, values_callable=lambda x: [e.value for e in x]),
        default=AlertSeverity.INFO,
        nullable=False
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    installation: Mapped["Installation"] = relationship("Installation", back_populates="alerts")
    user: Mapped["User"] = relationship("User", back_populates="alerts")


class UserSettings(Base):
    """Account-level user settings and preferences."""
    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # Notification preferences
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_weekly_report: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_security_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Alert preferences
    alert_blocked_sites: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    alert_blocked_apps: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    alert_screen_time: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    alert_tamper_attempts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Timezone for scheduling
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="settings")


