from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import User, UserRole, EmailVerificationToken, PasswordResetToken, RefreshToken
from app.schemas.auth import RegisterRequest, Token
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    generate_token,
    hash_token,
)
from app.services.email_service import EmailService
from app.config import settings


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    async def register(db: AsyncSession, data: RegisterRequest) -> User | None:
        """Register a new user."""
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            return None

        # Create user
        user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            role=UserRole.CUSTOMER,
            is_verified=False,
        )
        db.add(user)
        await db.flush()

        # Create verification token
        token = generate_token()
        verification = EmailVerificationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(verification)
        await db.commit()

        # Send verification email
        await EmailService.send_verification_email(user.email, token)

        return user

    @staticmethod
    async def login(db: AsyncSession, email: str, password: str) -> Token | None:
        """Authenticate user and return tokens."""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            return None

        if not user.is_active:
            return None

        # Create tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token_str = create_refresh_token(data={"sub": str(user.id)})

        # Store refresh token hash
        refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token_str),
            expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
        db.add(refresh_token)
        await db.commit()

        return Token(
            access_token=access_token,
            refresh_token=refresh_token_str,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
        )

    @staticmethod
    async def verify_email(db: AsyncSession, token: str) -> bool:
        """Verify user email with token."""
        result = await db.execute(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.token == token)
            .where(EmailVerificationToken.expires_at > datetime.utcnow())
        )
        verification = result.scalar_one_or_none()

        if not verification:
            return False

        # Mark user as verified
        user_result = await db.execute(select(User).where(User.id == verification.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.is_verified = True

        # Delete verification token
        await db.delete(verification)
        await db.commit()

        return True

    @staticmethod
    async def resend_verification(db: AsyncSession, email: str) -> bool:
        """Resend verification email."""
        result = await db.execute(
            select(User).where(User.email == email).where(User.is_verified == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False

        # Delete old tokens
        await db.execute(
            delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )

        # Create new token
        token = generate_token()
        verification = EmailVerificationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(verification)
        await db.commit()

        # Send email
        await EmailService.send_verification_email(user.email, token)

        return True

    @staticmethod
    async def request_password_reset(db: AsyncSession, email: str) -> bool:
        """Request password reset email."""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            # Don't reveal if email exists
            return True

        # Delete old tokens
        await db.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )

        # Create new token
        token = generate_token()
        reset = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(reset)
        await db.commit()

        # Send email
        await EmailService.send_password_reset_email(user.email, token)

        return True

    @staticmethod
    async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
        """Reset password with token."""
        result = await db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token == token)
            .where(PasswordResetToken.expires_at > datetime.utcnow())
        )
        reset = result.scalar_one_or_none()

        if not reset:
            return False

        # Update password
        user_result = await db.execute(select(User).where(User.id == reset.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.password_hash = get_password_hash(new_password)

        # Delete reset token
        await db.delete(reset)

        # Revoke all refresh tokens
        await db.execute(
            delete(RefreshToken).where(RefreshToken.user_id == reset.user_id)
        )

        await db.commit()

        return True

    @staticmethod
    async def refresh_access_token(db: AsyncSession, refresh_token_str: str) -> Token | None:
        """Refresh access token using refresh token."""
        token_hash = hash_token(refresh_token_str)

        result = await db.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .where(RefreshToken.revoked == False)
            .where(RefreshToken.expires_at > datetime.utcnow())
        )
        refresh_token = result.scalar_one_or_none()

        if not refresh_token:
            return None

        # Get user
        user_result = await db.execute(select(User).where(User.id == refresh_token.user_id))
        user = user_result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        # Create new access token
        access_token = create_access_token(data={"sub": str(user.id)})

        return Token(
            access_token=access_token,
            refresh_token=refresh_token_str,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
        )

    @staticmethod
    async def logout(db: AsyncSession, refresh_token_str: str) -> bool:
        """Revoke refresh token (logout)."""
        token_hash = hash_token(refresh_token_str)

        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        refresh_token = result.scalar_one_or_none()

        if refresh_token:
            refresh_token.revoked = True
            await db.commit()

        return True

    @staticmethod
    async def create_admin(db: AsyncSession) -> User | None:
        """Create initial admin user if not exists."""
        result = await db.execute(
            select(User).where(User.email == settings.admin_email)
        )
        if result.scalar_one_or_none():
            return None

        admin = User(
            email=settings.admin_email,
            password_hash=get_password_hash(settings.admin_initial_password),
            role=UserRole.ADMIN,
            is_verified=True,
            is_active=True,
            first_name="Admin",
        )
        db.add(admin)
        await db.commit()

        return admin
