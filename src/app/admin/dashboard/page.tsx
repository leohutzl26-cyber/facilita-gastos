'use client';
import { ShieldUser, LogOut, Users, HardDrive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserCrud from '@/components/admin/UserCrud';
import GoogleLink from '@/components/admin/GoogleLink';

export default function AdminDashboard() {
    const router = useRouter();

    const handleLogout = () => {
        router.push('/admin/login');
    };

    return (
        <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans">
            <nav className="border-b border-[#8CC63F]/10 bg-[#1C2D54]/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#8CC63F]/20 rounded-lg text-[#8CC63F]">
                            <ShieldUser className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-zinc-200">Panel de Administración</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-[#8CC63F]" />
                        <h2 className="text-xl font-semibold">Gestión de Trabajadores</h2>
                    </div>
                    <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                        <UserCrud />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <HardDrive className="w-5 h-5 text-[#3EAE49]" />
                        <h2 className="text-xl font-semibold">Integración Google</h2>
                    </div>
                    <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <GoogleLink />
                    </div>
                </div>

            </main>
        </div>
    );
}
