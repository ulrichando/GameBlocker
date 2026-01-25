import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.parental_controls import ScreenTimeConfig, BlockedApp, WebFilterConfig, Alert


class Platform(str, PyEnum):
    WINDOWS = "windows"
    MACOS = "macos"
    LINUX = "linux"
    ANDROID = "android"
    IOS = "ios"


class DownloadSource(str, PyEnum):
    WEBSITE = "website"
    DASHBOARD = "dashboard"
    EMAIL = "email"
    REFERRAL = "referral"
    OTHER = "other"


class InstallationStatus(str, PyEnum):
    PENDING = "pending"  # Download started but not installed
    ACTIVE = "active"  # Installed and running
    INACTIVE = "inactive"  # Not seen for a while
    UNINSTALLED = "uninstalled"  # User uninstalled


class Download(Base):
    """Tracks download events - when users click download button"""
    __tablename__ = "downloads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    download_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform, values_callable=lambda x: [e.value for e in x]), nullable=False)
    app_version: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[DownloadSource] = mapped_column(Enum(DownloadSource, values_callable=lambda x: [e.value for e in x]), default=DownloadSource.WEBSITE, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 max length
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="downloads")
    installation: Mapped["Installation | None"] = relationship("Installation", back_populates="download", uselist=False)


class Installation(Base):
    """Tracks app installations on devices"""
    __tablename__ = "installations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    download_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("downloads.id", ondelete="SET NULL"), nullable=True)
    device_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)  # Unique device identifier
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # User-friendly device name
    platform: Mapped[Platform] = mapped_column(Enum(Platform, values_callable=lambda x: [e.value for e in x]), nullable=False)
    os_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    app_version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[InstallationStatus] = mapped_column(Enum(InstallationStatus, values_callable=lambda x: [e.value for e in x]), default=InstallationStatus.ACTIVE, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(default=False, nullable=False)  # Admin can block unpaid users
    blocked_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="installations")
    download: Mapped["Download | None"] = relationship("Download", back_populates="installation")

    # Parental control relationships
    screen_time_config: Mapped["ScreenTimeConfig | None"] = relationship("ScreenTimeConfig", back_populates="installation", uselist=False)
    blocked_apps: Mapped[list["BlockedApp"]] = relationship("BlockedApp", back_populates="installation", cascade="all, delete-orphan")
    web_filter_config: Mapped["WebFilterConfig | None"] = relationship("WebFilterConfig", back_populates="installation", uselist=False)
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="installation", cascade="all, delete-orphan")


