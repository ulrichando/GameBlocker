"""Webhook delivery service with HMAC signing and retry logic."""

import hmac
import hashlib
import json
import asyncio
from datetime import datetime, timedelta
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Webhook, WebhookDelivery, User


class WebhookService:
    """Service for webhook delivery with retry logic."""

    @staticmethod
    def generate_signature(payload: str, secret: str) -> str:
        """Generate HMAC-SHA256 signature for payload verification."""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    @staticmethod
    async def trigger_webhooks(
        db: AsyncSession,
        user_id: UUID,
        event_type: str,
        payload: dict,
    ) -> list[WebhookDelivery]:
        """
        Trigger all webhooks for a user matching the event type.

        This is a fire-and-forget operation - deliveries are attempted
        asynchronously without blocking the main flow.
        """
        # Find matching webhooks
        result = await db.execute(
            select(Webhook).where(
                Webhook.user_id == user_id,
                Webhook.is_active == True,
                Webhook.events.contains([event_type]),
            )
        )
        webhooks = result.scalars().all()

        if not webhooks:
            return []

        deliveries = []
        for webhook in webhooks:
            delivery = await WebhookService.deliver(db, webhook, event_type, payload)
            deliveries.append(delivery)

        return deliveries

    @staticmethod
    async def deliver(
        db: AsyncSession,
        webhook: Webhook,
        event_type: str,
        payload: dict,
    ) -> WebhookDelivery:
        """
        Attempt to deliver a webhook.

        Creates a delivery record and attempts to POST to the webhook URL.
        On failure, schedules a retry.
        """
        # Add metadata to payload
        full_payload = {
            **payload,
            "event": event_type,
            "webhook_id": str(webhook.id),
            "timestamp": datetime.utcnow().isoformat(),
        }

        payload_json = json.dumps(full_payload, default=str)
        signature = WebhookService.generate_signature(payload_json, webhook.secret)

        # Create delivery record
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=full_payload,
            attempts=1,
        )
        db.add(delivery)
        await db.commit()
        await db.refresh(delivery)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook.url,
                    content=payload_json,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": f"sha256={signature}",
                        "X-Webhook-Event": event_type,
                        "X-Webhook-Delivery-Id": str(delivery.id),
                    },
                )

                delivery.response_status = response.status_code
                delivery.response_body = response.text[:1000]  # Limit stored response

                if 200 <= response.status_code < 300:
                    delivery.delivered_at = datetime.utcnow()
                else:
                    # Schedule retry with exponential backoff
                    retry_delay = 5 * (2 ** (delivery.attempts - 1))  # 5, 10, 20 minutes
                    delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=retry_delay)

        except httpx.TimeoutException:
            delivery.error_message = "Request timed out"
            delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=5)
        except httpx.RequestError as e:
            delivery.error_message = str(e)[:500]
            delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=5)
        except Exception as e:
            delivery.error_message = f"Unexpected error: {str(e)[:450]}"
            delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=5)

        await db.commit()
        await db.refresh(delivery)

        return delivery

    @staticmethod
    async def retry_delivery(
        db: AsyncSession,
        delivery: WebhookDelivery,
    ) -> WebhookDelivery:
        """Retry a failed webhook delivery."""
        if not delivery.can_retry:
            return delivery

        # Get the webhook
        result = await db.execute(
            select(Webhook).where(Webhook.id == delivery.webhook_id)
        )
        webhook = result.scalar_one_or_none()

        if not webhook or not webhook.is_active:
            delivery.error_message = "Webhook no longer active"
            await db.commit()
            return delivery

        delivery.attempts += 1

        payload_json = json.dumps(delivery.payload, default=str)
        signature = WebhookService.generate_signature(payload_json, webhook.secret)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook.url,
                    content=payload_json,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": f"sha256={signature}",
                        "X-Webhook-Event": delivery.event_type,
                        "X-Webhook-Delivery-Id": str(delivery.id),
                        "X-Webhook-Retry": str(delivery.attempts),
                    },
                )

                delivery.response_status = response.status_code
                delivery.response_body = response.text[:1000]

                if 200 <= response.status_code < 300:
                    delivery.delivered_at = datetime.utcnow()
                    delivery.next_retry_at = None
                else:
                    # Schedule next retry
                    if delivery.attempts < delivery.max_attempts:
                        retry_delay = 5 * (2 ** (delivery.attempts - 1))
                        delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=retry_delay)
                    else:
                        delivery.next_retry_at = None

        except Exception as e:
            delivery.error_message = str(e)[:500]
            if delivery.attempts < delivery.max_attempts:
                retry_delay = 5 * (2 ** (delivery.attempts - 1))
                delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=retry_delay)
            else:
                delivery.next_retry_at = None

        await db.commit()
        await db.refresh(delivery)

        return delivery

    @staticmethod
    async def send_test_webhook(
        db: AsyncSession,
        webhook: Webhook,
    ) -> WebhookDelivery:
        """Send a test webhook to verify configuration."""
        test_payload = {
            "message": "This is a test webhook from ParentShield",
            "webhook_name": webhook.description or "Unnamed webhook",
        }
        return await WebhookService.deliver(db, webhook, "test", test_payload)

    @staticmethod
    async def get_pending_retries(
        db: AsyncSession,
        limit: int = 100,
    ) -> list[WebhookDelivery]:
        """Get webhook deliveries that need to be retried."""
        result = await db.execute(
            select(WebhookDelivery).where(
                WebhookDelivery.delivered_at == None,
                WebhookDelivery.attempts < WebhookDelivery.max_attempts,
                WebhookDelivery.next_retry_at <= datetime.utcnow(),
            ).limit(limit)
        )
        return list(result.scalars().all())


async def trigger_webhooks_background(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    payload: dict,
) -> None:
    """
    Fire-and-forget webhook triggering.

    Use this when you don't need to wait for webhook delivery results.
    """
    try:
        await WebhookService.trigger_webhooks(db, user_id, event_type, payload)
    except Exception as e:
        # Log but don't raise - webhooks should never break the main flow
        print(f"Webhook trigger error: {e}")
