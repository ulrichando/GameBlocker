"""Webhook management endpoints."""

from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select

from app.core.dependencies import ActiveUser, DbSession
from app.core.security import generate_token
from app.models import Webhook, WebhookDelivery, WebhookEventType
from app.services.webhook_service import WebhookService


router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])


# ============================================================================
# SCHEMAS
# ============================================================================

class WebhookCreate(BaseModel):
    """Request to create a new webhook."""
    url: str = Field(..., max_length=500, description="URL to receive webhook events")
    events: list[str] = Field(..., min_length=1, description="Event types to subscribe to")
    description: str | None = Field(None, max_length=255, description="Optional description")


class WebhookUpdate(BaseModel):
    """Request to update a webhook."""
    url: str | None = Field(None, max_length=500)
    events: list[str] | None = None
    is_active: bool | None = None
    description: str | None = Field(None, max_length=255)


class WebhookResponse(BaseModel):
    """Webhook response (without secret)."""
    id: str
    url: str
    events: list[str]
    is_active: bool
    description: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_model(cls, webhook: Webhook) -> "WebhookResponse":
        return cls(
            id=str(webhook.id),
            url=webhook.url,
            events=webhook.events or [],
            is_active=webhook.is_active,
            description=webhook.description,
            created_at=webhook.created_at.isoformat(),
            updated_at=webhook.updated_at.isoformat(),
        )


class WebhookWithSecretResponse(WebhookResponse):
    """Webhook response with secret (only on creation)."""
    secret: str = Field(..., description="Webhook secret for HMAC verification - save this!")


class WebhookDeliveryResponse(BaseModel):
    """Webhook delivery audit log entry."""
    id: str
    event_type: str
    response_status: int | None
    error_message: str | None
    attempts: int
    delivered_at: str | None
    created_at: str

    @classmethod
    def from_model(cls, delivery: WebhookDelivery) -> "WebhookDeliveryResponse":
        return cls(
            id=str(delivery.id),
            event_type=delivery.event_type,
            response_status=delivery.response_status,
            error_message=delivery.error_message,
            attempts=delivery.attempts,
            delivered_at=delivery.delivered_at.isoformat() if delivery.delivered_at else None,
            created_at=delivery.created_at.isoformat(),
        )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/", response_model=WebhookWithSecretResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    request: WebhookCreate,
    current_user: ActiveUser,
    db: DbSession,
):
    """
    Create a new webhook.

    The webhook secret is only returned once upon creation.
    Use it to verify webhook signatures (X-Webhook-Signature header).
    """
    # Validate events
    valid_events = {e.value for e in WebhookEventType}
    invalid_events = set(request.events) - valid_events
    if invalid_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event types: {', '.join(invalid_events)}. Valid events: {', '.join(valid_events)}"
        )

    # Generate secret
    secret = generate_token()

    webhook = Webhook(
        user_id=current_user.id,
        url=request.url,
        secret=secret,
        events=request.events,
        description=request.description,
    )

    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)

    return WebhookWithSecretResponse(
        id=str(webhook.id),
        url=webhook.url,
        events=webhook.events or [],
        is_active=webhook.is_active,
        description=webhook.description,
        secret=secret,  # Only returned once
        created_at=webhook.created_at.isoformat(),
        updated_at=webhook.updated_at.isoformat(),
    )


@router.get("/", response_model=list[WebhookResponse])
async def list_webhooks(
    current_user: ActiveUser,
    db: DbSession,
):
    """List all webhooks for the current user."""
    result = await db.execute(
        select(Webhook)
        .where(Webhook.user_id == current_user.id)
        .order_by(Webhook.created_at.desc())
    )
    webhooks = result.scalars().all()

    return [WebhookResponse.from_model(w) for w in webhooks]


@router.get("/events")
async def list_available_events():
    """List all available webhook event types."""
    return {
        "events": [
            {
                "id": e.value,
                "name": e.value.replace(".", " ").replace("_", " ").title(),
                "description": _get_event_description(e.value),
            }
            for e in WebhookEventType
        ]
    }


def _get_event_description(event_type: str) -> str:
    """Get description for an event type."""
    descriptions = {
        "alert.created": "Triggered when any alert is created",
        "alert.blocked_site": "Triggered when a blocked website is accessed",
        "alert.blocked_app": "Triggered when a blocked app is launched",
        "alert.screen_time_limit": "Triggered when screen time limit is reached",
        "alert.tamper_attempt": "Triggered when someone tries to disable the app",
        "device.offline": "Triggered when a device goes offline",
        "device.online": "Triggered when a device comes online",
        "settings.changed": "Triggered when parental control settings are changed",
        "test": "Test event for verifying webhook configuration",
    }
    return descriptions.get(event_type, "No description available")


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Get details of a specific webhook."""
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.user_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )

    return WebhookResponse.from_model(webhook)


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    request: WebhookUpdate,
    current_user: ActiveUser,
    db: DbSession,
):
    """Update a webhook configuration."""
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.user_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )

    if request.url is not None:
        webhook.url = request.url

    if request.events is not None:
        # Validate events
        valid_events = {e.value for e in WebhookEventType}
        invalid_events = set(request.events) - valid_events
        if invalid_events:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid event types: {', '.join(invalid_events)}"
            )
        webhook.events = request.events

    if request.is_active is not None:
        webhook.is_active = request.is_active

    if request.description is not None:
        webhook.description = request.description

    await db.commit()
    await db.refresh(webhook)

    return WebhookResponse.from_model(webhook)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Delete a webhook."""
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.user_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )

    await db.delete(webhook)
    await db.commit()

    return None


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """Send a test webhook to verify configuration."""
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.user_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )

    delivery = await WebhookService.send_test_webhook(db, webhook)

    return {
        "success": delivery.is_successful,
        "delivery_id": str(delivery.id),
        "response_status": delivery.response_status,
        "error_message": delivery.error_message,
    }


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryResponse])
async def list_webhook_deliveries(
    webhook_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    limit: int = 50,
    offset: int = 0,
):
    """List recent deliveries for a webhook."""
    # Verify ownership
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.user_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )

    # Get deliveries
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    deliveries = result.scalars().all()

    return [WebhookDeliveryResponse.from_model(d) for d in deliveries]
