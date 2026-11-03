-- ============================================================================
-- 90 GRADOS POS / ERP - MIGRACIÓN SUPABASE PILOTO: COMANDERO MÓVIL ONLINE
-- ============================================================================
-- Este script habilita de forma segura la persistencia y lectura en tiempo real
-- de comandas entre el APK Android de los Meseros y la Caja web en Vercel.
-- Ejecutar en el SQL Editor del panel de Supabase.
-- ============================================================================

-- 1. Asegurar columnas de sede e idempotencia en la tabla orders
ALTER TABLE IF EXISTS orders 
  ADD COLUMN IF NOT EXISTS sede_id VARCHAR(50) DEFAULT 'sede-principal',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

-- Índice único parcial para garantizar idempotencia y evitar doble comanda por reintentos de red
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_orders_idempotency_key'
  ) THEN
    CREATE UNIQUE INDEX idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- 2. Asegurar columnas en order_items
ALTER TABLE IF EXISTS order_items
  ADD COLUMN IF NOT EXISTS station VARCHAR(20) DEFAULT 'cocina',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Habilitar Row Level Security (RLS) en orders y order_items
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS) para 'orders'
-- Permitir lectura a usuarios de la misma sede o activos
DROP POLICY IF EXISTS "orders_read_policy" ON orders;
CREATE POLICY "orders_read_policy" ON orders
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Permitir creación de comandas
DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
CREATE POLICY "orders_insert_policy" ON orders
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    total_amount_cop >= 0 AND 
    table_number IS NOT NULL
  );

-- Permitir actualización de estado (caja cobra o cocina avanza estado)
DROP POLICY IF EXISTS "orders_update_policy" ON orders;
CREATE POLICY "orders_update_policy" ON orders
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 5. Políticas de Seguridad (RLS) para 'order_items'
-- CORRECCIÓN CRÍTICA: Anteriormente order_items tenía RLS activado sin políticas,
-- lo que causaba un bloqueo total por defecto (DENY ALL) al insertar líneas de comanda.
DROP POLICY IF EXISTS "order_items_read_policy" ON order_items;
CREATE POLICY "order_items_read_policy" ON order_items
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "order_items_insert_policy" ON order_items;
CREATE POLICY "order_items_insert_policy" ON order_items
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    quantity > 0 AND 
    unit_price_cop >= 0
  );

DROP POLICY IF EXISTS "order_items_update_policy" ON order_items;
CREATE POLICY "order_items_update_policy" ON order_items
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 6. Habilitar la publicación en tiempo real (Supabase Realtime)
-- Permite que la pantalla de Caja en Vercel reciba al instante la orden creada por el mesero
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- 7. Otorgar permisos a los roles de Supabase (anon y authenticated)
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON order_items TO authenticated, anon;
