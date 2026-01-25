"""Parental Controls API - Screen Time, Blocked Apps, Web Filters, Alerts, Settings."""
from datetime import datetime, time
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload

from app.core.dependencies import ActiveUser, DbSession
from app.models import (
    Installation,
    ScreenTimeConfig,
    BlockedApp,
    WebFilterConfig,
    WebFilterRule,
    Alert,
    UserSettings,
    WebFilterCategory,
    AlertType,
    AlertSeverity,
)

router = APIRouter(prefix="/parental", tags=["Parental Controls"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ScreenTimeConfigSchema(BaseModel):
    is_enabled: bool = True
    monday_limit: int = 0
    tuesday_limit: int = 0
    wednesday_limit: int = 0
    thursday_limit: int = 0
    friday_limit: int = 0
    saturday_limit: int = 0
    sunday_limit: int = 0
    allowed_start_time: Optional[str] = None  # "HH:MM" format
    allowed_end_time: Optional[str] = None
    grace_period: int = 5


class ScreenTimeConfigResponse(BaseModel):
    id: str
    installation_id: str
    is_enabled: bool
    monday_limit: int
    tuesday_limit: int
    wednesday_limit: int
    thursday_limit: int
    friday_limit: int
    saturday_limit: int
    sunday_limit: int
    allowed_start_time: Optional[str]
    allowed_end_time: Optional[str]
    grace_period: int


class BlockedAppCreate(BaseModel):
    app_name: str
    app_identifier: str
    platform: str
    is_game: bool = False
    is_enabled: bool = True
    schedule: Optional[dict] = None


class BlockedAppUpdate(BaseModel):
    app_name: Optional[str] = None
    is_game: Optional[bool] = None
    is_enabled: Optional[bool] = None
    schedule: Optional[dict] = None


class BlockedAppResponse(BaseModel):
    id: str
    app_name: str
    app_identifier: str
    platform: str
    is_game: bool
    is_enabled: bool
    schedule: Optional[dict]
    created_at: str


class WebFilterConfigSchema(BaseModel):
    is_enabled: bool = True
    blocked_categories: list[str] = []
    enforce_safe_search: bool = True


class WebFilterConfigResponse(BaseModel):
    id: str
    installation_id: str
    is_enabled: bool
    blocked_categories: list[str]
    enforce_safe_search: bool
    rules_count: int = 0


class WebFilterRuleCreate(BaseModel):
    url_pattern: str
    is_blocked: bool = True
    is_enabled: bool = True
    notes: Optional[str] = None


class WebFilterRuleResponse(BaseModel):
    id: str
    url_pattern: str
    is_blocked: bool
    is_enabled: bool
    notes: Optional[str]
    created_at: str


class AlertResponse(BaseModel):
    id: str
    installation_id: str
    device_name: Optional[str]
    alert_type: str
    severity: str
    title: str
    message: str
    details: Optional[dict]
    is_read: bool
    is_dismissed: bool
    created_at: str


class UserSettingsSchema(BaseModel):
    email_alerts: bool = True
    email_weekly_report: bool = True
    email_security_alerts: bool = True
    alert_blocked_sites: bool = True
    alert_blocked_apps: bool = True
    alert_screen_time: bool = True
    alert_tamper_attempts: bool = True
    timezone: str = "UTC"


class UserSettingsResponse(BaseModel):
    email_alerts: bool
    email_weekly_report: bool
    email_security_alerts: bool
    alert_blocked_sites: bool
    alert_blocked_apps: bool
    alert_screen_time: bool
    alert_tamper_attempts: bool
    timezone: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def verify_installation_ownership(
    installation_id: UUID,
    user_id: UUID,
    db: DbSession,
) -> Installation:
    """Verify that the installation belongs to the user."""
    result = await db.execute(
        select(Installation).where(
            Installation.id == installation_id,
            Installation.user_id == user_id,
        )
    )
    installation = result.scalar_one_or_none()
    if not installation:
        raise HTTPException(status_code=404, detail="Device not found")
    return installation


def parse_time(time_str: Optional[str]) -> Optional[time]:
    """Parse time string (HH:MM) to time object."""
    if not time_str:
        return None
    try:
        parts = time_str.split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def format_time(t: Optional[time]) -> Optional[str]:
    """Format time object to string (HH:MM)."""
    if not t:
        return None
    return t.strftime("%H:%M")


# ============================================================================
# SCREEN TIME ENDPOINTS
# ============================================================================

@router.get("/screen-time/{installation_id}", response_model=ScreenTimeConfigResponse)
async def get_screen_time_config(
    installation_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Get screen time configuration for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(ScreenTimeConfig).where(ScreenTimeConfig.installation_id == installation_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        # Create default config
        config = ScreenTimeConfig(
            installation_id=installation_id,
            is_enabled=False,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return ScreenTimeConfigResponse(
        id=str(config.id),
        installation_id=str(config.installation_id),
        is_enabled=config.is_enabled,
        monday_limit=config.monday_limit,
        tuesday_limit=config.tuesday_limit,
        wednesday_limit=config.wednesday_limit,
        thursday_limit=config.thursday_limit,
        friday_limit=config.friday_limit,
        saturday_limit=config.saturday_limit,
        sunday_limit=config.sunday_limit,
        allowed_start_time=format_time(config.allowed_start_time),
        allowed_end_time=format_time(config.allowed_end_time),
        grace_period=config.grace_period,
    )


@router.put("/screen-time/{installation_id}", response_model=ScreenTimeConfigResponse)
async def update_screen_time_config(
    installation_id: UUID,
    data: ScreenTimeConfigSchema,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update screen time configuration for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(ScreenTimeConfig).where(ScreenTimeConfig.installation_id == installation_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = ScreenTimeConfig(installation_id=installation_id)
        db.add(config)

    config.is_enabled = data.is_enabled
    config.monday_limit = data.monday_limit
    config.tuesday_limit = data.tuesday_limit
    config.wednesday_limit = data.wednesday_limit
    config.thursday_limit = data.thursday_limit
    config.friday_limit = data.friday_limit
    config.saturday_limit = data.saturday_limit
    config.sunday_limit = data.sunday_limit
    config.allowed_start_time = parse_time(data.allowed_start_time)
    config.allowed_end_time = parse_time(data.allowed_end_time)
    config.grace_period = data.grace_period
    config.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(config)

    return ScreenTimeConfigResponse(
        id=str(config.id),
        installation_id=str(config.installation_id),
        is_enabled=config.is_enabled,
        monday_limit=config.monday_limit,
        tuesday_limit=config.tuesday_limit,
        wednesday_limit=config.wednesday_limit,
        thursday_limit=config.thursday_limit,
        friday_limit=config.friday_limit,
        saturday_limit=config.saturday_limit,
        sunday_limit=config.sunday_limit,
        allowed_start_time=format_time(config.allowed_start_time),
        allowed_end_time=format_time(config.allowed_end_time),
        grace_period=config.grace_period,
    )


# ============================================================================
# BLOCKED APPS ENDPOINTS
# ============================================================================

@router.get("/blocked-apps/{installation_id}", response_model=list[BlockedAppResponse])
async def list_blocked_apps(
    installation_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    is_game: Optional[bool] = None,
):
    """List blocked apps for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    query = select(BlockedApp).where(BlockedApp.installation_id == installation_id)
    if is_game is not None:
        query = query.where(BlockedApp.is_game == is_game)
    query = query.order_by(BlockedApp.app_name)

    result = await db.execute(query)
    apps = result.scalars().all()

    return [
        BlockedAppResponse(
            id=str(app.id),
            app_name=app.app_name,
            app_identifier=app.app_identifier,
            platform=app.platform,
            is_game=app.is_game,
            is_enabled=app.is_enabled,
            schedule=app.schedule,
            created_at=app.created_at.isoformat(),
        )
        for app in apps
    ]


@router.post("/blocked-apps/{installation_id}", response_model=BlockedAppResponse)
async def add_blocked_app(
    installation_id: UUID,
    data: BlockedAppCreate,
    current_user: ActiveUser,
    db: DbSession,
):
    """Add a blocked app to a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    # Check if app already exists
    existing = await db.execute(
        select(BlockedApp).where(
            BlockedApp.installation_id == installation_id,
            BlockedApp.app_identifier == data.app_identifier,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="App already blocked")

    app = BlockedApp(
        installation_id=installation_id,
        app_name=data.app_name,
        app_identifier=data.app_identifier,
        platform=data.platform,
        is_game=data.is_game,
        is_enabled=data.is_enabled,
        schedule=data.schedule,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)

    return BlockedAppResponse(
        id=str(app.id),
        app_name=app.app_name,
        app_identifier=app.app_identifier,
        platform=app.platform,
        is_game=app.is_game,
        is_enabled=app.is_enabled,
        schedule=app.schedule,
        created_at=app.created_at.isoformat(),
    )


@router.put("/blocked-apps/{installation_id}/{app_id}", response_model=BlockedAppResponse)
async def update_blocked_app(
    installation_id: UUID,
    app_id: UUID,
    data: BlockedAppUpdate,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update a blocked app."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(BlockedApp).where(
            BlockedApp.id == app_id,
            BlockedApp.installation_id == installation_id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Blocked app not found")

    if data.app_name is not None:
        app.app_name = data.app_name
    if data.is_game is not None:
        app.is_game = data.is_game
    if data.is_enabled is not None:
        app.is_enabled = data.is_enabled
    if data.schedule is not None:
        app.schedule = data.schedule

    app.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(app)

    return BlockedAppResponse(
        id=str(app.id),
        app_name=app.app_name,
        app_identifier=app.app_identifier,
        platform=app.platform,
        is_game=app.is_game,
        is_enabled=app.is_enabled,
        schedule=app.schedule,
        created_at=app.created_at.isoformat(),
    )


@router.delete("/blocked-apps/{installation_id}/{app_id}")
async def delete_blocked_app(
    installation_id: UUID,
    app_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Remove a blocked app."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(BlockedApp).where(
            BlockedApp.id == app_id,
            BlockedApp.installation_id == installation_id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Blocked app not found")

    await db.delete(app)
    await db.commit()

    return {"status": "deleted", "message": "App removed from blocklist"}


# ============================================================================
# WEB FILTERS ENDPOINTS
# ============================================================================

@router.get("/web-filters/{installation_id}", response_model=WebFilterConfigResponse)
async def get_web_filter_config(
    installation_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Get web filter configuration for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(WebFilterConfig)
        .options(selectinload(WebFilterConfig.custom_rules))
        .where(WebFilterConfig.installation_id == installation_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = WebFilterConfig(
            installation_id=installation_id,
            is_enabled=False,
            blocked_categories=[],
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return WebFilterConfigResponse(
        id=str(config.id),
        installation_id=str(config.installation_id),
        is_enabled=config.is_enabled,
        blocked_categories=config.blocked_categories or [],
        enforce_safe_search=config.enforce_safe_search,
        rules_count=len(config.custom_rules) if config.custom_rules else 0,
    )


@router.put("/web-filters/{installation_id}", response_model=WebFilterConfigResponse)
async def update_web_filter_config(
    installation_id: UUID,
    data: WebFilterConfigSchema,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update web filter configuration for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    result = await db.execute(
        select(WebFilterConfig)
        .options(selectinload(WebFilterConfig.custom_rules))
        .where(WebFilterConfig.installation_id == installation_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = WebFilterConfig(installation_id=installation_id)
        db.add(config)

    config.is_enabled = data.is_enabled
    config.blocked_categories = data.blocked_categories
    config.enforce_safe_search = data.enforce_safe_search
    config.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(config)

    return WebFilterConfigResponse(
        id=str(config.id),
        installation_id=str(config.installation_id),
        is_enabled=config.is_enabled,
        blocked_categories=config.blocked_categories or [],
        enforce_safe_search=config.enforce_safe_search,
        rules_count=len(config.custom_rules) if config.custom_rules else 0,
    )


@router.get("/web-filters/{installation_id}/rules", response_model=list[WebFilterRuleResponse])
async def list_web_filter_rules(
    installation_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """List custom web filter rules for a device."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    # Get config first
    config_result = await db.execute(
        select(WebFilterConfig).where(WebFilterConfig.installation_id == installation_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        return []

    result = await db.execute(
        select(WebFilterRule)
        .where(WebFilterRule.config_id == config.id)
        .order_by(WebFilterRule.created_at.desc())
    )
    rules = result.scalars().all()

    return [
        WebFilterRuleResponse(
            id=str(rule.id),
            url_pattern=rule.url_pattern,
            is_blocked=rule.is_blocked,
            is_enabled=rule.is_enabled,
            notes=rule.notes,
            created_at=rule.created_at.isoformat(),
        )
        for rule in rules
    ]


@router.post("/web-filters/{installation_id}/rules", response_model=WebFilterRuleResponse)
async def add_web_filter_rule(
    installation_id: UUID,
    data: WebFilterRuleCreate,
    current_user: ActiveUser,
    db: DbSession,
):
    """Add a custom web filter rule."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    # Get or create config
    config_result = await db.execute(
        select(WebFilterConfig).where(WebFilterConfig.installation_id == installation_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        config = WebFilterConfig(
            installation_id=installation_id,
            is_enabled=True,
            blocked_categories=[],
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    rule = WebFilterRule(
        config_id=config.id,
        url_pattern=data.url_pattern,
        is_blocked=data.is_blocked,
        is_enabled=data.is_enabled,
        notes=data.notes,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return WebFilterRuleResponse(
        id=str(rule.id),
        url_pattern=rule.url_pattern,
        is_blocked=rule.is_blocked,
        is_enabled=rule.is_enabled,
        notes=rule.notes,
        created_at=rule.created_at.isoformat(),
    )


@router.delete("/web-filters/{installation_id}/rules/{rule_id}")
async def delete_web_filter_rule(
    installation_id: UUID,
    rule_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Delete a web filter rule."""
    await verify_installation_ownership(installation_id, current_user.id, db)

    # Get config first
    config_result = await db.execute(
        select(WebFilterConfig).where(WebFilterConfig.installation_id == installation_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Rule not found")

    result = await db.execute(
        select(WebFilterRule).where(
            WebFilterRule.id == rule_id,
            WebFilterRule.config_id == config.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()

    return {"status": "deleted", "message": "Rule deleted"}


@router.get("/web-filters/categories")
async def get_filter_categories():
    """Get available web filter categories."""
    return {
        "categories": [
            {"id": cat.value, "name": cat.value.replace("_", " ").title()}
            for cat in WebFilterCategory
        ]
    }


# ============================================================================
# ALERTS ENDPOINTS
# ============================================================================

@router.get("/alerts", response_model=list[AlertResponse])
async def list_alerts(
    current_user: ActiveUser,
    db: DbSession,
    installation_id: Optional[UUID] = None,
    alert_type: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
):
    """List alerts for the current user."""
    query = (
        select(Alert)
        .options(selectinload(Alert.installation))
        .where(Alert.user_id == current_user.id, Alert.is_dismissed == False)
    )

    if installation_id:
        query = query.where(Alert.installation_id == installation_id)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
    if is_read is not None:
        query = query.where(Alert.is_read == is_read)

    query = query.order_by(Alert.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        AlertResponse(
            id=str(alert.id),
            installation_id=str(alert.installation_id),
            device_name=alert.installation.device_name if alert.installation else None,
            alert_type=alert.alert_type.value,
            severity=alert.severity.value,
            title=alert.title,
            message=alert.message,
            details=alert.details,
            is_read=alert.is_read,
            is_dismissed=alert.is_dismissed,
            created_at=alert.created_at.isoformat(),
        )
        for alert in alerts
    ]


@router.get("/alerts/unread-count")
async def get_unread_alert_count(
    current_user: ActiveUser,
    db: DbSession,
):
    """Get count of unread alerts."""
    result = await db.execute(
        select(func.count(Alert.id)).where(
            Alert.user_id == current_user.id,
            Alert.is_read == False,
            Alert.is_dismissed == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.put("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Mark an alert as read."""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_read = True
    await db.commit()

    return {"status": "ok", "message": "Alert marked as read"}


@router.put("/alerts/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Dismiss an alert."""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_dismissed = True
    await db.commit()

    return {"status": "ok", "message": "Alert dismissed"}


@router.post("/alerts/mark-all-read")
async def mark_all_alerts_read(
    current_user: ActiveUser,
    db: DbSession,
):
    """Mark all alerts as read."""
    await db.execute(
        update(Alert)
        .where(Alert.user_id == current_user.id, Alert.is_read == False)
        .values(is_read=True)
    )
    await db.commit()

    return {"status": "ok", "message": "All alerts marked as read"}


# ============================================================================
# USER SETTINGS ENDPOINTS
# ============================================================================

@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: ActiveUser,
    db: DbSession,
):
    """Get user settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create default settings
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return UserSettingsResponse(
        email_alerts=settings.email_alerts,
        email_weekly_report=settings.email_weekly_report,
        email_security_alerts=settings.email_security_alerts,
        alert_blocked_sites=settings.alert_blocked_sites,
        alert_blocked_apps=settings.alert_blocked_apps,
        alert_screen_time=settings.alert_screen_time,
        alert_tamper_attempts=settings.alert_tamper_attempts,
        timezone=settings.timezone,
    )


@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    data: UserSettingsSchema,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update user settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    settings.email_alerts = data.email_alerts
    settings.email_weekly_report = data.email_weekly_report
    settings.email_security_alerts = data.email_security_alerts
    settings.alert_blocked_sites = data.alert_blocked_sites
    settings.alert_blocked_apps = data.alert_blocked_apps
    settings.alert_screen_time = data.alert_screen_time
    settings.alert_tamper_attempts = data.alert_tamper_attempts
    settings.timezone = data.timezone
    settings.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(settings)

    return UserSettingsResponse(
        email_alerts=settings.email_alerts,
        email_weekly_report=settings.email_weekly_report,
        email_security_alerts=settings.email_security_alerts,
        alert_blocked_sites=settings.alert_blocked_sites,
        alert_blocked_apps=settings.alert_blocked_apps,
        alert_screen_time=settings.alert_screen_time,
        alert_tamper_attempts=settings.alert_tamper_attempts,
        timezone=settings.timezone,
    )
