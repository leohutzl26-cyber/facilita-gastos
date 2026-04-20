'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldUser, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError('Credenciales inválidas o error de conexión.');
            setLoading(false);
        } else {
            try {
                await fetch('/api/audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'Login Administrador', details: 'Inicio de sesión exitoso al panel.' })
                });
            } catch (e) { }
            router.push('/admin/dashboard');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C2D54] via-[#121D38] to-[#121D38]">

            <Link href="/" className="absolute top-8 left-8 text-zinc-400 flex items-center gap-2 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
            </Link>

            <div className="w-full max-w-md relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#3EAE49] to-[#8CC63F] rounded-[2rem] blur opacity-20 animate-pulse" />

                <div className="relative bg-[#1C2D54]/50 backdrop-blur-xl border border-[#8CC63F]/10 p-8 rounded-[2rem] shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="p-4 bg-[#8CC63F]/20 rounded-2xl text-[#8CC63F] mb-4">
                            <ShieldUser className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-300">
                            Acceso Administrador
                        </h1>
                        <p className="text-[#8CC63F]/80 text-sm mt-2 text-center font-medium">
                            Panel maestro de Facilita
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-zinc-300 ml-1">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 transition-all"
                                placeholder="admin@empresa.com"
                            />
                        </div>

                        <div className="space-y-1 mb-6">
                            <label className="text-sm font-medium text-zinc-300 ml-1">Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative overflow-hidden group bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] rounded-xl px-4 py-3 font-bold transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-zinc-600">
                        Solo personal autorizado por el administrador de Facilita.
                    </div>
                </div>
            </div>
        </div>
    );
}
