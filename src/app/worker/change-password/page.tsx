'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function ChangePassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const supabase = createClient();

    // Check if user is logged in
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/worker/login');
            }
        };
        checkUser();
    }, [router, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            setLoading(false);
            return;
        }

        try {
            // 1. Update Password in Supabase Auth
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            // 2. Remove the "requires_password_change" flag from user_metadata
            const { data: { user } } = await supabase.auth.getUser();
            const currentMetadata = user?.user_metadata || {};

            const { error: metadataError } = await supabase.auth.updateUser({
                data: {
                    ...currentMetadata,
                    requires_password_change: false
                }
            });

            if (metadataError) throw metadataError;

            setSuccess(true);
            setTimeout(() => {
                router.push('/worker/capture');
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al actualizar la contraseña. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[#121D38]">
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="w-16 h-16 bg-[#8CC63F]/20 text-[#8CC63F] rounded-full flex items-center justify-center mx-auto mb-6">
                        <KeyRound className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">¡Contraseña Actualizada!</h2>
                    <p className="text-zinc-400">Ingresando a tu panel de colaborador...</p>
                    <Loader2 className="w-6 h-6 text-[#8CC63F] animate-spin mx-auto mt-4" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C2D54] via-[#121D38] to-[#121D38]">
            <div className="w-full max-w-md relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-[#8CC63F] rounded-[2rem] blur opacity-20 animate-pulse" />

                <div className="relative bg-[#1C2D54]/80 backdrop-blur-xl border border-yellow-500/10 p-8 rounded-[2rem] shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="p-4 bg-yellow-500/20 rounded-2xl text-yellow-500 mb-4">
                            <KeyRound className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-300 text-center">
                            Seguridad de la Cuenta
                        </h1>
                        <p className="text-yellow-500/80 text-sm mt-3 text-center font-medium leading-relaxed px-4">
                            Por tu seguridad, debes cambiar tu contraseña temporal antes de continuar usando Facilita.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-zinc-300 ml-1">Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                                placeholder="Escribe tu nueva clave secreta"
                            />
                        </div>

                        <div className="space-y-1 mb-6">
                            <label className="text-sm font-medium text-zinc-300 ml-1">Repetir Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                                placeholder="Confirma tu clave secreta"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-[#121D38] rounded-xl px-4 py-3 font-bold transition-colors disabled:opacity-70 flex justify-center items-center gap-2 mt-8"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>Validar y Continuar <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
