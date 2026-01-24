from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models import User, UserRole, Subscription, SubscriptionStatus, Transaction, TransactionStatus
from app.schemas.admin import DashboardStats


class AnalyticsService:
    """Service for analytics and reporting."""

    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
        """Get dashboard statistics."""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)

        # Total customers
        total_customers_result = await db.execute(
            select(func.count(User.id)).where(User.role == UserRole.CUSTOMER)
        )
        total_customers = total_customers_result.scalar() or 0

        # Active subscriptions
        active_subs_result = await db.execute(
            select(func.count(Subscription.id)).where(
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        active_subscriptions = active_subs_result.scalar() or 0

        # Revenue today
        revenue_today_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                and_(
                    Transaction.status == TransactionStatus.SUCCEEDED,
                    Transaction.created_at >= today,
                )
            )
        )
        revenue_today = float(revenue_today_result.scalar() or 0)

        # Revenue this month
        revenue_month_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                and_(
                    Transaction.status == TransactionStatus.SUCCEEDED,
                    Transaction.created_at >= month_start,
                )
            )
        )
        revenue_this_month = float(revenue_month_result.scalar() or 0)

        # Revenue total
        revenue_total_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.status == TransactionStatus.SUCCEEDED
            )
        )
        revenue_total = float(revenue_total_result.scalar() or 0)

        # New customers today
        new_today_result = await db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.role == UserRole.CUSTOMER,
                    User.created_at >= today,
                )
            )
        )
        new_customers_today = new_today_result.scalar() or 0

        # New customers this month
        new_month_result = await db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.role == UserRole.CUSTOMER,
                    User.created_at >= month_start,
                )
            )
        )
        new_customers_this_month = new_month_result.scalar() or 0

        return DashboardStats(
            total_customers=total_customers,
            active_subscriptions=active_subscriptions,
            revenue_today=revenue_today,
            revenue_this_month=revenue_this_month,
            revenue_total=revenue_total,
            new_customers_today=new_customers_today,
            new_customers_this_month=new_customers_this_month,
        )

    @staticmethod
    async def get_revenue_by_day(
        db: AsyncSession,
        days: int = 30,
    ) -> list[dict]:
        """Get daily revenue for the last N days."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await db.execute(
            select(
                func.date(Transaction.created_at).label("date"),
                func.sum(Transaction.amount).label("revenue"),
            )
            .where(
                and_(
                    Transaction.status == TransactionStatus.SUCCEEDED,
                    Transaction.created_at >= start_date,
                )
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )

        return [
            {"date": str(row.date), "revenue": float(row.revenue)}
            for row in result.all()
        ]

    @staticmethod
    async def get_customer_growth(
        db: AsyncSession,
        days: int = 30,
    ) -> list[dict]:
        """Get daily customer signups for the last N days."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await db.execute(
            select(
                func.date(User.created_at).label("date"),
                func.count(User.id).label("signups"),
            )
            .where(
                and_(
                    User.role == UserRole.CUSTOMER,
                    User.created_at >= start_date,
                )
            )
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )

        return [
            {"date": str(row.date), "signups": row.signups}
            for row in result.all()
        ]
