'use client';
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'fg-theme';

const THEME_COLOR: Record<Theme, string> = {
    dark: '#121D38',
    light: '#F5F7F2',
};

function readTheme(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

// Aplica el tema al <html> y ajusta el color de la barra del navegador en el celular.
export function applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        setThemeState(readTheme());
        const observer = new MutationObserver(() => setThemeState(readTheme()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Sin almacenamiento (modo privado): el cambio vale solo para esta sesión.
        }
    }, []);

    const toggle = useCallback(() => setTheme(readTheme() === 'dark' ? 'light' : 'dark'), [setTheme]);

    return { theme, setTheme, toggle };
}
