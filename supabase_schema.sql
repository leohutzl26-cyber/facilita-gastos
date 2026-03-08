-- Copia y pega todo este código en el SQL Editor de tu Dashboard de Supabase --
-- https://supabase.com/dashboard/project/qdanwwehttjymevbvluc/sql/new

-- 1. Crear tabla para almacenar las llaves de Google temporal/permanente del administrador
CREATE TABLE IF NOT EXISTS public.google_integrations (
    admin_id UUID PRIMARY KEY REFERENCES auth.users(id),
    refresh_token TEXT,
    access_token TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb, -- Para almacenar la carpeta de Drive y url/id de Sheets elegidas
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Reglas de Accesibilidad Limitada (RLS) por seguridad
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para que el admin solo pueda ver y modificar sus propios tokens
CREATE POLICY "Admins can view own google tokens" ON public.google_integrations FOR SELECT USING (auth.uid() = admin_id);
CREATE POLICY "Admins can insert own google tokens" ON public.google_integrations FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admins can update own google tokens" ON public.google_integrations FOR UPDATE USING (auth.uid() = admin_id);
CREATE POLICY "Admins can delete own google tokens" ON public.google_integrations FOR DELETE USING (auth.uid() = admin_id);

-- Opcional: Crear rol de admin si necesitas aislar fuertemente a los trabajadores.
-- Por ahora asumiremos que una persona con acceso a `/admin/dashboard` tiene derechos porque no hemos proveído ruta pública de registro, así que todos los Auth.users creados manualmente en su Dashboard son Admins.

-- 2. Crear tabla global para el almacenamiento de los gastos/recibos enviados
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES auth.users(id),
    worker_email TEXT, -- Guardaremos el correo directamente para lectura rápida
    merchant TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT, -- Opcional, enlace de Drive o Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Reglas de Accesibilidad Limitada (RLS) para recibos
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Los trabajadores (cualquier usuario logueado en realidad) pueden insertar sus propios recibos
CREATE POLICY "Workers can insert their receipts" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = worker_id);

-- Los administradores (en este esquema simple: cualquier usuario logueado) pueden ver todos los recibos
-- NOTA REAL: En producción esto debería llevar a chequear una tabla `user_roles`, pero para PWA mantenemos simpleza:
CREATE POLICY "Admins can view all receipts" ON public.receipts FOR SELECT USING (auth.uid() IS NOT NULL);
