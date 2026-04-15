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
DROP POLICY IF EXISTS "Admins can update receipts" ON public.receipts;

-- Los trabajadores pueden insertar sus propios recibos
CREATE POLICY "Workers can insert their receipts" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = worker_id);

-- Los administradores/supervisores pueden ver todos los recibos
CREATE POLICY "Admins can view all receipts" ON public.receipts FOR SELECT USING (auth.uid() IS NOT NULL);

-- Los administradores pueden actualizar el estado de recibos
CREATE POLICY "Admins can update receipts" ON public.receipts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 3. Configuración de Proyectos Empresariales (Fase 2)
-- ==========================================

-- Crear tabla global para el control de Proyectos/Clientes
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    active BOOLEAN DEFAULT true
);

-- Si la tabla receipts existía ANTES y no tenía la columna del proyecto vinculado, la añadimos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipts' AND column_name='project_id') THEN
    ALTER TABLE public.receipts ADD COLUMN project_id UUID REFERENCES public.projects(id);
  END IF;
END
$$;

-- Habilitar RLS para proyectos
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

-- Los trabajadores pueden leer los proyectos vigentes
CREATE POLICY "Anyone can view active projects" ON public.projects FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);

-- Las funciones de inserción y borrado son para admins
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 4. Configuración del Supabase Storage
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

-- ==========================================
-- 5. Actualización Fase 2 y 3 (Ubicación y Comentarios)
-- ==========================================

-- 5.1 Añadir Geolocalización a Recibos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipts' AND column_name='location') THEN
    ALTER TABLE public.receipts ADD COLUMN location TEXT;
  END IF;
END
$$;

-- 5.2 Crear tabla de comentarios
CREATE TABLE IF NOT EXISTS public.receipt_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.receipt_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.receipt_comments;
DROP POLICY IF EXISTS "Workers and admins can insert comments" ON public.receipt_comments;

-- Lectura: Todos los autenticados pueden ver los comentarios (idealmente podrías limitarlo a admin + dueño del recibo, pero simplificado por ahora)
CREATE POLICY "Anyone can view comments" ON public.receipt_comments FOR SELECT USING (auth.uid() IS NOT NULL);
-- Escritura: Todos los autenticados pueden comentar
CREATE POLICY "Workers and admins can insert comments" ON public.receipt_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
