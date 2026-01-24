import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings


class EmailService:
    """Service for sending emails via SMTP."""

    @staticmethod
    async def send_email(to_email: str, subject: str, html_content: str) -> bool:
        """Send an email using SMTP."""
        if not settings.smtp_user or not settings.smtp_password:
            # Log to console in development
            print(f"[EMAIL] To: {to_email}")
            print(f"[EMAIL] Subject: {subject}")
            print(f"[EMAIL] Content: {html_content[:200]}...")
            return True

        try:
            message = MIMEMultipart("alternative")
            message["From"] = settings.from_email
            message["To"] = to_email
            message["Subject"] = subject

            html_part = MIMEText(html_content, "html")
            message.attach(html_part)

            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=True,
            )
            return True
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send email: {e}")
            return False

    @staticmethod
    async def send_verification_email(to_email: str, token: str) -> bool:
        """Send email verification email."""
        verification_url = f"{settings.app_url}/auth/verify-email?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Verify Your Email</h1>
                <p>Thank you for signing up for {settings.app_name}!</p>
                <p>Please click the button below to verify your email address:</p>
                <p><a href="{verification_url}" class="button">Verify Email</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p>{verification_url}</p>
                <p>This link will expire in 24 hours.</p>
                <div class="footer">
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                    <p>&copy; {settings.app_name}</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await EmailService.send_email(
            to_email,
            f"Verify your {settings.app_name} account",
            html_content,
        )

    @staticmethod
    async def send_password_reset_email(to_email: str, token: str) -> bool:
        """Send password reset email."""
        reset_url = f"{settings.app_url}/auth/reset-password?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Reset Your Password</h1>
                <p>We received a request to reset your {settings.app_name} password.</p>
                <p>Click the button below to set a new password:</p>
                <p><a href="{reset_url}" class="button">Reset Password</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p>{reset_url}</p>
                <p>This link will expire in 1 hour.</p>
                <div class="footer">
                    <p>If you didn't request a password reset, you can safely ignore this email.</p>
                    <p>&copy; {settings.app_name}</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await EmailService.send_email(
            to_email,
            f"Reset your {settings.app_name} password",
            html_content,
        )

    @staticmethod
    async def send_welcome_email(to_email: str, first_name: str | None = None) -> bool:
        """Send welcome email after subscription."""
        name = first_name or "there"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Welcome to {settings.app_name}!</h1>
                <p>Hi {name},</p>
                <p>Thank you for subscribing to {settings.app_name}! Your subscription is now active.</p>
                <h2>Getting Started</h2>
                <ol>
                    <li>Download the app for your platform from your dashboard</li>
                    <li>Install and run the application</li>
                    <li>Follow the setup wizard to configure your preferences</li>
                </ol>
                <p><a href="{settings.app_url}/account/dashboard" class="button">Go to Dashboard</a></p>
                <div class="footer">
                    <p>Need help? Contact us at support@parentshield.app</p>
                    <p>&copy; {settings.app_name}</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await EmailService.send_email(
            to_email,
            f"Welcome to {settings.app_name}!",
            html_content,
        )
