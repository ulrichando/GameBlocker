"""Add downloads and installations tables

Revision ID: 5e8f7a21bc3d
Revises: 4ddc6a50ce8b
Create Date: 2026-01-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e8f7a21bc3d'
down_revision: Union[str, Sequence[str], None] = '4ddc6a50ce8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum types
    op.execute("CREATE TYPE platform AS ENUM ('windows', 'macos', 'linux', 'android', 'ios')")
    op.execute("CREATE TYPE downloadsource AS ENUM ('website', 'dashboard', 'email', 'referral', 'other')")
    op.execute("CREATE TYPE installationstatus AS ENUM ('pending', 'active', 'inactive', 'uninstalled')")

    # Create downloads table
    op.create_table('downloads',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('download_token', sa.String(length=64), nullable=False),
        sa.Column('platform', sa.Enum('windows', 'macos', 'linux', 'android', 'ios', name='platform', create_type=False), nullable=False),
        sa.Column('app_version', sa.String(length=50), nullable=False),
        sa.Column('source', sa.Enum('website', 'dashboard', 'email', 'referral', 'other', name='downloadsource', create_type=False), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('referrer', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_downloads_download_token'), 'downloads', ['download_token'], unique=True)

    # Create installations table
    op.create_table('installations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('download_id', sa.UUID(), nullable=True),
        sa.Column('device_id', sa.String(length=255), nullable=False),
        sa.Column('device_name', sa.String(length=255), nullable=True),
        sa.Column('platform', sa.Enum('windows', 'macos', 'linux', 'android', 'ios', name='platform', create_type=False), nullable=False),
        sa.Column('os_version', sa.String(length=100), nullable=True),
        sa.Column('app_version', sa.String(length=50), nullable=False),
        sa.Column('status', sa.Enum('pending', 'active', 'inactive', 'uninstalled', name='installationstatus', create_type=False), nullable=False),
        sa.Column('last_seen', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['download_id'], ['downloads.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_installations_device_id'), 'installations', ['device_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_installations_device_id'), table_name='installations')
    op.drop_table('installations')
    op.drop_index(op.f('ix_downloads_download_token'), table_name='downloads')
    op.drop_table('downloads')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS installationstatus")
    op.execute("DROP TYPE IF EXISTS downloadsource")
    op.execute("DROP TYPE IF EXISTS platform")
