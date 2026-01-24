from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.models.subscription import SubscriptionStatus


class SubscriptionResponse(BaseModel):
    id: UUID
    status: SubscriptionStatus
    plan_name: str
    amount: float
    currency: str
    current_period_start: datetime | None
    current_period_end: datetime | None
    canceled_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True

    @property
    def is_active(self) -> bool:
        return self.status == SubscriptionStatus.ACTIVE

    @property
    def days_remaining(self) -> int | None:
        if self.current_period_end:
            delta = self.current_period_end - datetime.utcnow()
            return max(0, delta.days)
        return None
