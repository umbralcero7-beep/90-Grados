"""
Alembic Environment Script - Sistema POS 90 Grados
Restaurante-Bar 90 Grados, Cundinamarca, Colombia

Reglas obligatorias:
1. Lee estrictamente DATABASE_URL de las variables de entorno.
2. Si DATABASE_URL no está configurada, se detiene con error explicativo antes de conectar.
3. No expone contraseñas en logs ni trazas de error.
4. Soporta ejecución en modo offline y online.
"""

import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Ensure DATABASE_URL is present in environment
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print(
        "CRÍTICO [Alembic]: La variable de entorno 'DATABASE_URL' no está configurada.\n"
        "El runner debe definir DATABASE_URL antes de invocar migraciones.\n"
        "Ejemplo: postgresql://pos_app:***@127.0.0.1:5432/grados_pos",
        file=sys.stderr
    )
    sys.exit(1)

# Set sqlalchemy.url dynamically without writing secrets to disk
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = None

def run_migrations_offline() -> None:
    """Ejecuta migraciones en modo 'offline' generando SQL sin conexión viva."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Ejecuta migraciones en modo 'online' con conexión al motor."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
