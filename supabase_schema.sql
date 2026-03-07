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
