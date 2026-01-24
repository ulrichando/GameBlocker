from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.models.transaction import TransactionStatus


class TransactionResponse(BaseModel):
    id: UUID
    amount: float
    currency: str
    status: TransactionStatus
    description: str | None
    invoice_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True
