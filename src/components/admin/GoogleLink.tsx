'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Link as LinkIcon, Folder, FileSpreadsheet, AlertCircle } from 'lucide-react';

export default function GoogleLink() {
    const [isLinked, setIsLinked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [folderSelected, setFolderSelected] = useState(false);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/admin/google-status');
                const data = await res.json();
                if (res.ok && data.isLinked) {
                    setIsLinked(true);
                }
            } catch (err) {
                console.error('Error checking Google status:', err);
            } finally {
                setIsLoading(false);
            }
        };

        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('success') === 'GoogleLinked') {
            setIsLinked(true);
            setIsLoading(false);
        } else if (searchParams.get('error')) {
            setAuthError(searchParams.get('error') || 'Unknown');
            setIsLoading(false);
        } else {
            checkStatus();
        }
    }, []);

    const simulateSelectFolder = () => {
        setFolderSelected(true);
    };

    if (!isLinked) {
        return (
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-2 ring-1 ring-white/10">
                    <svg className="w-8 h-8" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-zinc-200 font-medium">Vincular Cuenta</h3>
                    <p className="text-xs text-zinc-400 mt-1">Conecta tu Google Workspace (Drive & Sheets)</p>
                </div>
                <a
                    href="/api/auth/google"
                    className="w-full bg-white text-black font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition"
                >
                    <LinkIcon className="w-4 h-4" /> Conectar con Google
                </a>
                {authError && (
                    <div className="w-full mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        Error devuelto: {authError}
                        {authError === 'DBError' && ' (Falta crear tabla SQL en Supabase)'}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Cuenta vinculada correctamente a <strong>admin@empresa.com</strong></p>
            </div>

            <div className="space-y-4">
                {/* Drive Config */}
                <div>
                    <label className="text-xs text-zinc-400 block mb-2 uppercase tracking-wider font-semibold">Almacenamiento (Drive)</label>
                    {folderSelected ? (
                        <div className="flex items-center justify-between p-3 bg-zinc-900 border border-white/5 rounded-xl">
                            <div className="flex items-center gap-2 text-sm text-zinc-300">
                                <Folder className="w-4 h-4 text-blue-400" />
                                /Recibos_Gastos_2026
                            </div>
                            <button onClick={() => setFolderSelected(false)} className="text-xs text-[#8CC63F] hover:text-[#3EAE49]">Cambiar</button>
                        </div>
                    ) : (
                        <button
                            onClick={simulateSelectFolder}
                            className="w-full border border-dashed border-white/20 hover:border-[#8CC63F]/50 hover:bg-[#8CC63F]/5 p-4 rounded-xl text-sm text-zinc-400 transition flex flex-col items-center gap-2"
                        >
                            <Folder className="w-5 h-5" />
                            Seleccionar Carpeta Destino
                        </button>
                    )}
                </div>

                {/* Sheets Config */}
                <div>
                    <label className="text-xs text-zinc-400 block mb-2 uppercase tracking-wider font-semibold">Base de Datos (Sheets)</label>
                    <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-white/5 rounded-xl text-sm text-zinc-300">
                        <FileSpreadsheet className="w-4 h-4 text-green-500" />
                        Gastos_Reportes_Global
                        <span className="ml-auto text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">Automático</span>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-white/10">
                <button
                    onClick={() => { setIsLinked(false); setFolderSelected(false); }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                    <AlertCircle className="w-3 h-3" /> Desvincular cuenta
                </button>
            </div>
        </div>
    );
}
