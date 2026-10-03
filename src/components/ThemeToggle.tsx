'use client';
import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, useTheme } from '@/utils/theme';

// Botón para alternar entre modo oscuro (predeterminado) y modo claro.
export default function ThemeToggle({ className = '', showLabel = true }: { className?: string; showLabel?: boolean }) {
    const { theme, toggle } = useTheme();
    const isDark = theme === 'dark';
    const label = isDark ? 'Modo claro' : 'Modo oscuro';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={`Cambiar a ${label.toLowerCase()}`}
            title={`Cambiar a ${label.toLowerCase()}`}
            className={`flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors ${className}`}
        >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {showLabel && <span className="hidden sm:inline">{label}</span>}
        </button>
    );
}

// Sincroniza el color de la barra del navegador con el tema guardado al cargar cualquier página.
export function ThemeSync() {
    useEffect(() => {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    }, []);
    return null;
}
