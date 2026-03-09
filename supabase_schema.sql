-- Copia y pega todo este código en el SQL Editor de tu Dashboard de Supabase --
-- https://supabase.com/dashboard/project/qdanwwehttjymevbvluc/sql/new

-- 1. Eliminar tabla antigua de integraciones de Google (Si existe)
DROP TABLE IF EXISTS public.google_integrations CASCADE;

-- 2. Crear tabla global para el almacenamiento de los gastos/recibos enviados
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES auth.users(id),
    worker_email TEXT, -- Guardaremos el correo directamente para lectura rápida
    merchant TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT, -- Enlace público de Supabase Storage
    status TEXT DEFAULT 'Pendiente', -- Para el nuevo flujo de aprobación sugerido (Pendiente, Aprobado por Supervisor, Reembolsado)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Si la tabla receipts existía ANTES y no tenía la columna status, la añadimos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipts' AND column_name='status') THEN
    ALTER TABLE public.receipts ADD COLUMN status TEXT DEFAULT 'Pendiente';
  END IF;
END
$$;

-- Habilitar Reglas de Accesibilidad Limitada (RLS) para recibos
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Evitar errores de "Policy ya existe" eliminándolas previamente
DROP POLICY IF EXISTS "Workers can insert their receipts" ON public.receipts;
DROP POLICY IF EXISTS "Admins can view all receipts" ON public.receipts;

-- Los trabajadores pueden insertar sus propios recibos
CREATE POLICY "Workers can insert their receipts" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = worker_id);

-- Los administradores/supervisores pueden ver todos los recibos
CREATE POLICY "Admins can view all receipts" ON public.receipts FOR SELECT USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 3. Configuración del Supabase Storage
-- ==========================================

-- Insertar el nuevo bucket llamado "receipts" si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Evitar errores de "Policy ya existe" en Storage
DROP POLICY IF EXISTS "Workers can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Crear política para permitir subir archivos a los trabajadores
CREATE POLICY "Workers can upload receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'receipts' 
    AND auth.uid() IS NOT NULL
);

-- Crear política para permitir la lectura pública/general de los recibos
CREATE POLICY "Anyone can view receipts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');
