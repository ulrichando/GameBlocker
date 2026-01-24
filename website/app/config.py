from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "ParentShield"
    app_url: str = "http://localhost:8000"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/parentshield"

    # JWT
    secret_key: str = "change-this-to-a-secure-secret-key-min-32-characters"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""  # Legacy, use plan-specific IDs
    stripe_basic_price_id: str = ""  # Basic plan price ID
    stripe_pro_price_id: str = ""    # Pro plan price ID

    # SMTP Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = "ParentShield <noreply@parentshield.app>"

    # Admin
    admin_email: str = "admin@parentshield.app"
    admin_initial_password: str = "change-me-immediately"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
