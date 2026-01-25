"""Add parental controls tables

Revision ID: 6f9a8b32cd4e
Revises: 5e8f7a21bc3d
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision: str = '6f9a8b32cd4e'
down_revision: Union[str, Sequence[str], None] = '5e8f7a21bc3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum types for alerts
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE alerttype AS ENUM (
                'blocked_site', 'blocked_app', 'screen_time_limit',
                'tamper_attempt', 'device_offline', 'new_app_installed'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE alertseverity AS ENUM ('info', 'warning', 'critical');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 1. Create screen_time_configs table
    op.create_table('screen_time_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.UUID(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('monday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tuesday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('wednesday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('thursday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('friday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('saturday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sunday_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('allowed_start_time', sa.Time(), nullable=True),
        sa.Column('allowed_end_time', sa.Time(), nullable=True),
        sa.Column('grace_period', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['installation_id'], ['installations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('installation_id')
    )

    # 2. Create blocked_apps table
    op.create_table('blocked_apps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.UUID(), nullable=False),
        sa.Column('app_name', sa.String(length=255), nullable=False),
        sa.Column('app_identifier', sa.String(length=500), nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=False),
        sa.Column('is_game', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('schedule', JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['installation_id'], ['installations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_blocked_apps_installation_id'), 'blocked_apps', ['installation_id'], unique=False)

    # 3. Create web_filter_configs table
    op.create_table('web_filter_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.UUID(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('blocked_categories', JSON(), nullable=False, server_default='[]'),
        sa.Column('enforce_safe_search', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['installation_id'], ['installations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('installation_id')
    )

    # 4. Create web_filter_rules table
    op.create_table('web_filter_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('config_id', sa.UUID(), nullable=False),
        sa.Column('url_pattern', sa.String(length=500), nullable=False),
        sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['config_id'], ['web_filter_configs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_web_filter_rules_config_id'), 'web_filter_rules', ['config_id'], unique=False)

    # 5. Create alerts table
    op.create_table('alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('alert_type', sa.Enum('blocked_site', 'blocked_app', 'screen_time_limit', 'tamper_attempt', 'device_offline', 'new_app_installed', name='alerttype', create_type=False), nullable=False),
        sa.Column('severity', sa.Enum('info', 'warning', 'critical', name='alertseverity', create_type=False), nullable=False, server_default='info'),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('details', JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_dismissed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['installation_id'], ['installations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_installation_id'), 'alerts', ['installation_id'], unique=False)
    op.create_index(op.f('ix_alerts_user_id'), 'alerts', ['user_id'], unique=False)
    op.create_index(op.f('ix_alerts_created_at'), 'alerts', ['created_at'], unique=False)

    # 6. Create user_settings table
    op.create_table('user_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('email_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_weekly_report', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_security_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_blocked_sites', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_blocked_apps', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_screen_time', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_tamper_attempts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default="'UTC'"),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )

    # Add is_blocked and blocked_reason columns to installations if they don't exist
    # These are already in the model but may not be in the database
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE installations ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT false;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE installations ADD COLUMN blocked_reason VARCHAR(255);
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns from installations
    op.execute("ALTER TABLE installations DROP COLUMN IF EXISTS blocked_reason")
    op.execute("ALTER TABLE installations DROP COLUMN IF EXISTS is_blocked")

    # Drop tables in reverse order
    op.drop_table('user_settings')
    op.drop_index(op.f('ix_alerts_created_at'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_user_id'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_installation_id'), table_name='alerts')
    op.drop_table('alerts')
    op.drop_index(op.f('ix_web_filter_rules_config_id'), table_name='web_filter_rules')
    op.drop_table('web_filter_rules')
    op.drop_table('web_filter_configs')
    op.drop_index(op.f('ix_blocked_apps_installation_id'), table_name='blocked_apps')
    op.drop_table('blocked_apps')
    op.drop_table('screen_time_configs')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS alertseverity")
    op.execute("DROP TYPE IF EXISTS alerttype")
