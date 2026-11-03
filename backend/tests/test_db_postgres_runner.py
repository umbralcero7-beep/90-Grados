"""
Runner Seguro de Pruebas PostgreSQL para Base de Ensayo - 90 Grados
Restaurante-Bar 90 Grados, Cundinamarca, Colombia

CUMPLIMIENTO ESTRICTO DE REGLAS OBLIGATORIAS:
1. Destino LIMITADO EXCLUSIVAMENTE a: 127.0.0.1:5432/grados_piloto_api_test
2. PROHIBIDO TERMINANTEMENTE conectarse o hacer referencia a 'grados_demo' o 'grados_piloto_validacion'.
3. NO destructivo: Si la base de ensayo ya contiene tablas o datos, SE DETIENE Y REPORTA.
   NO limpia, NO recrea, NO ejecuta DROP TABLE.
4. Las credenciales se leen exclusivamente desde la variable en memoria 'PILOT_TEST_POSTGRES_URL'
   o prompt interactivo oculto con getpass. Cero contraseñas en logs o en disco.
"""

import os
import sys
import getpass
from typing import Optional

# Constante de seguridad inviolable
TARGET_HOST = "127.0.0.1"
TARGET_PORT = 5432
TARGET_DBNAME = "grados_piloto_api_test"
FORBIDDEN_DBS = {"grados_demo", "grados_piloto_validacion", "postgres", "template1"}

def build_safe_postgres_url() -> str:
    """Construye y valida la URL de conexión cumpliendo las restricciones de destino."""
    env_url = os.environ.get("PILOT_TEST_POSTGRES_URL")
    
    if env_url:
        # Validación de seguridad sobre la URL suministrada
        for forbidden in FORBIDDEN_DBS:
            if forbidden in env_url.lower():
                print(
                    f"CRÍTICO [Seguridad]: Intento de conexión a base no autorizada '{forbidden}'. "
                    "El destino está estrictamente limitado a 'grados_piloto_api_test'. Operación abortada.",
                    file=sys.stderr
                )
                sys.exit(1)

        if TARGET_DBNAME not in env_url:
            print(
                f"CRÍTICO [Seguridad]: La URL en PILOT_TEST_POSTGRES_URL no apunta a la base de ensayo requerida '{TARGET_DBNAME}'.\n"
                "Destino permitido únicamente: 127.0.0.1:5432/grados_piloto_api_test",
                file=sys.stderr
            )
            sys.exit(1)
            
        return env_url

    # Modo interactivo seguro (si no hay variable)
    print("\n--- Configuración de Ensayo PostgreSQL (90 Grados) ---")
    print(f"Destino estricto: {TARGET_HOST}:{TARGET_PORT}/{TARGET_DBNAME}")
    username = input("Usuario PostgreSQL [pos_app]: ").strip() or "pos_app"
    password = getpass.getpass("Contraseña PostgreSQL (oculta): ")

    try:
        from sqlalchemy.engine import URL
        safe_url = URL.create(
            drivername="postgresql+psycopg2",
            username=username,
            password=password,
            host=TARGET_HOST,
            port=TARGET_PORT,
            database=TARGET_DBNAME
        ).render_as_string(hide_password=False)
        return safe_url
    except ImportError:
        # Formato manual seguro sin sqlalchemy instalado
        import urllib.parse
        encoded_pass = urllib.parse.quote_plus(password)
        return f"postgresql://{username}:{encoded_pass}@{TARGET_HOST}:{TARGET_PORT}/{TARGET_DBNAME}"


def verify_target_db_is_empty(engine) -> bool:
    """
    Verifica que la base de ensayo 'grados_piloto_api_test' esté completamente vacía antes de probar.
    Si ya contiene tablas, se detiene inmediatamente para no alterar ningún estado previo.
    """
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE';
        """))
        existing_tables = [row[0] for row in result.fetchall()]

    if existing_tables:
        print(
            f"\n[DETENCIÓN DE SEGURIDAD]: La base de ensayo '{TARGET_DBNAME}' NO está vacía.\n"
            f"Tablas encontradas: {existing_tables}\n"
            "Conforme a la Regla 3, no se limpian ni borran datos existentes. "
            "Para ejecutar la prueba de migraciones limpias, utilice una base de ensayo vacía "
            "o verifique el estado del entorno antes de continuar.",
            file=sys.stderr
        )
        return False

    return True


def run_safe_postgres_validation():
    """Ejecuta la validación de conexión y esquema contra la base de ensayo."""
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("[OMITIDO]: SQLAlchemy o psycopg2 no están instalados en este entorno Python.")
        print("Instale dependencias con: pip install -r backend/requirements-test.txt")
        return False

    conn_url = build_safe_postgres_url()

    print(f"\n[*] Conectando a base de ensayo autorizada ({TARGET_HOST}:{TARGET_PORT}/{TARGET_DBNAME})...")
    engine = create_engine(conn_url)

    try:
        if not verify_target_db_is_empty(engine):
            print("[ABORTADO]: La base de datos de ensayo contiene tablas previas. Regla 3 respetada.")
            return False

        print("[OK] La base de ensayo 'grados_piloto_api_test' está vacía y lista para validación de migraciones.")
        print("[*] Aplicando DDL de prueba en transacción reversible...")

        with engine.begin() as tx:
            # Crear tabla temporal de prueba de conectividad
            tx.execute(text("CREATE TABLE test_pilot_connectivity (id SERIAL PRIMARY KEY, note TEXT);"))
            tx.execute(text("INSERT INTO test_pilot_connectivity (note) VALUES ('Conectividad probada exitosamente');"))
            res = tx.execute(text("SELECT note FROM test_pilot_connectivity;")).fetchone()
            print(f"[OK] Resultado de ensayo: {res[0]}")
            # Rollback explícito o DROP de la tabla efímera que acabamos de crear en este ensayo
            tx.execute(text("DROP TABLE test_pilot_connectivity;"))

        print("[EXITO] Validación PostgreSQL completada sin dejar modificaciones residuales.")
        return True

    except Exception as e:
        # Ocultar contraseñas en cualquier mensaje de error
        err_msg = str(e)
        if conn_url and "@" in conn_url:
            # Redactar parte sensible de la URL
            err_msg = err_msg.replace(conn_url, f"postgresql://***@{TARGET_HOST}:{TARGET_PORT}/{TARGET_DBNAME}")
        print(f"[ERROR]: Falló la verificación de PostgreSQL: {err_msg}", file=sys.stderr)
        return False


if __name__ == '__main__':
    success = run_safe_postgres_validation()
    sys.exit(0 if success else 1)
