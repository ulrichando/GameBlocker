from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import csv
import io

from app.db.database import get_db
from app.core.dependencies import AdminUser, DbSession
from app.models import User, UserRole, Subscription, Transaction
from app.schemas.admin import DashboardStats, CustomerListResponse, CustomerWithSubscription
from app.schemas.user import UserResponse
from app.schemas.subscription import SubscriptionResponse
from app.schemas.transaction import TransactionResponse
from app.models.subscription import SubscriptionStatus
from app.models.transaction import TransactionStatus
from app.services.analytics_service import AnalyticsService
from app.services.user_service import UserService

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])
templates = Jinja2Templates(directory="templates")


# ============================================================================
# PAGE ENDPOINTS
# ============================================================================

@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard_page(
    request: Request,
    current_user: AdminUser,
    db: DbSession,
):
    """Admin dashboard page."""
    stats = await AnalyticsService.get_dashboard_stats(db)
    revenue_chart = await AnalyticsService.get_revenue_by_day(db, days=30)
    customer_chart = await AnalyticsService.get_customer_growth(db, days=30)

    return templates.TemplateResponse(
        "admin/dashboard.html",
        {
            "request": request,
            "user": current_user,
            "stats": stats,
            "revenue_chart": revenue_chart,
            "customer_chart": customer_chart,
        },
    )


@router.get("/customers", response_class=HTMLResponse)
async def admin_customers_page(
    request: Request,
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by email or name"),
):
    """Admin customers list page."""
    # Build query
    query = select(User).where(User.role == UserRole.CUSTOMER)

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") |
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%")
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    # Get subscriptions for each user
    customers = []
    for user in users:
        subscription = await UserService.get_user_subscription(db, user.id)
        total_spent = await UserService.get_user_total_spent(db, user.id)
        customers.append({
            "user": user,
            "subscription": subscription,
            "total_spent": total_spent,
        })

    total_pages = (total + per_page - 1) // per_page

    return templates.TemplateResponse(
        "admin/customers.html",
        {
            "request": request,
            "user": current_user,
            "customers": customers,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "search": search,
        },
    )


@router.get("/customers/{customer_id}", response_class=HTMLResponse)
async def admin_customer_detail_page(
    request: Request,
    customer_id: UUID,
    current_user: AdminUser,
    db: DbSession,
):
    """Admin customer detail page."""
    customer = await UserService.get_user_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    subscription = await UserService.get_user_subscription(db, customer_id)
    transactions = await UserService.get_user_transactions(db, customer_id)
    total_spent = await UserService.get_user_total_spent(db, customer_id)

    return templates.TemplateResponse(
        "admin/customer_detail.html",
        {
            "request": request,
            "user": current_user,
            "customer": customer,
            "subscription": subscription,
            "transactions": transactions,
            "total_spent": total_spent,
        },
    )


@router.get("/transactions", response_class=HTMLResponse)
async def admin_transactions_page(
    request: Request,
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    """Admin transactions list page."""
    # Count total
    count_result = await db.execute(select(func.count(Transaction.id)))
    total = count_result.scalar() or 0

    # Get transactions with user info
    query = (
        select(Transaction, User)
        .join(User, Transaction.user_id == User.id)
        .order_by(Transaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.all()

    transactions = [{"transaction": row[0], "user": row[1]} for row in rows]
    total_pages = (total + per_page - 1) // per_page

    return templates.TemplateResponse(
        "admin/transactions.html",
        {
            "request": request,
            "user": current_user,
            "transactions": transactions,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        },
    )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    current_user: AdminUser,
    db: DbSession,
):
    """Get dashboard statistics."""
    return await AnalyticsService.get_dashboard_stats(db)


@router.get("/stats/revenue")
async def get_revenue_chart(
    current_user: AdminUser,
    db: DbSession,
    days: int = Query(30, ge=1, le=365),
):
    """Get revenue chart data."""
    return await AnalyticsService.get_revenue_by_day(db, days)


@router.get("/stats/customers")
async def get_customer_chart(
    current_user: AdminUser,
    db: DbSession,
    days: int = Query(30, ge=1, le=365),
):
    """Get customer growth chart data."""
    return await AnalyticsService.get_customer_growth(db, days)


@router.get("/api/customers", response_model=CustomerListResponse)
async def list_customers(
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by email or name"),
):
    """List all customers (JSON API)."""
    query = select(User).where(User.role == UserRole.CUSTOMER)

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") |
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    customers = []
    for user in users:
        subscription = await UserService.get_user_subscription(db, user.id)
        total_spent = await UserService.get_user_total_spent(db, user.id)
        customers.append(CustomerWithSubscription(
            user=UserResponse.model_validate(user),
            subscription=subscription,
            total_spent=total_spent,
        ))

    total_pages = (total + per_page - 1) // per_page

    return CustomerListResponse(
        customers=customers,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.put("/customers/{customer_id}/suspend")
async def suspend_customer(
    customer_id: UUID,
    current_user: AdminUser,
    db: DbSession,
):
    """Suspend a customer account."""
    success = await UserService.suspend_user(db, customer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer suspended"}


@router.put("/customers/{customer_id}/activate")
async def activate_customer(
    customer_id: UUID,
    current_user: AdminUser,
    db: DbSession,
):
    """Activate a customer account."""
    success = await UserService.activate_user(db, customer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer activated"}


@router.get("/transactions/export")
async def export_transactions(
    current_user: AdminUser,
    db: DbSession,
):
    """Export all transactions as CSV."""
    query = (
        select(Transaction, User)
        .join(User, Transaction.user_id == User.id)
        .order_by(Transaction.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Date", "Customer Email", "Amount", "Currency", "Status", "Description"
    ])

    for transaction, user in rows:
        writer.writerow([
            str(transaction.id),
            transaction.created_at.isoformat(),
            user.email,
            transaction.amount,
            transaction.currency,
            transaction.status.value,
            transaction.description or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/api/subscriptions")
async def list_subscriptions(
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by status"),
):
    """List all subscriptions (JSON API)."""
    query = select(Subscription, User).join(User, Subscription.user_id == User.id)

    if status:
        try:
            status_enum = SubscriptionStatus(status)
            query = query.where(Subscription.status == status_enum)
        except ValueError:
            pass

    count_query = select(func.count(Subscription.id))
    if status:
        try:
            status_enum = SubscriptionStatus(status)
            count_query = count_query.where(Subscription.status == status_enum)
        except ValueError:
            pass
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Subscription.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()

    subscriptions = []
    for subscription, user in rows:
        subscriptions.append({
            "id": str(subscription.id),
            "user_id": str(subscription.user_id),
            "user_email": user.email,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or None,
            "status": subscription.status.value,
            "plan_name": subscription.plan_name,
            "amount": float(subscription.amount),
            "currency": subscription.currency,
            "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "canceled_at": subscription.canceled_at.isoformat() if subscription.canceled_at else None,
            "created_at": subscription.created_at.isoformat(),
        })

    total_pages = (total + per_page - 1) // per_page

    return {
        "subscriptions": subscriptions,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/api/transactions")
async def list_transactions(
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by status"),
):
    """List all transactions (JSON API)."""
    query = select(Transaction, User).join(User, Transaction.user_id == User.id)

    if status:
        try:
            status_enum = TransactionStatus(status)
            query = query.where(Transaction.status == status_enum)
        except ValueError:
            pass

    count_query = select(func.count(Transaction.id))
    if status:
        try:
            status_enum = TransactionStatus(status)
            count_query = count_query.where(Transaction.status == status_enum)
        except ValueError:
            pass
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Transaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()

    transactions = []
    for transaction, user in rows:
        transactions.append({
            "id": str(transaction.id),
            "user_id": str(transaction.user_id),
            "user_email": user.email,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or None,
            "amount": float(transaction.amount),
            "currency": transaction.currency,
            "status": transaction.status.value,
            "description": transaction.description,
            "invoice_url": transaction.invoice_url,
            "created_at": transaction.created_at.isoformat(),
        })

    total_pages = (total + per_page - 1) // per_page

    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }
