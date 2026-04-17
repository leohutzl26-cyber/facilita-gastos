'use client';
import { ShieldUser, LogOut, Users, FileText, LayoutDashboard, Settings, ReceiptText, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import UserCrud from '@/components/admin/UserCrud';
import AdminReceipts from '@/components/admin/AdminReceipts';
import ProjectCrud from '@/components/admin/ProjectCrud';
import DangerZone from '@/components/admin/DangerZone';
import AdminDashboardCharts from '@/components/admin/AdminDashboardCharts';
import CategoryCrud from '@/components/admin/CategoryCrud';

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('dashboard');

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    const tabs = [
        { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
        { id: 'management', label: 'Gestión Básica', icon: Settings },
        { id: 'reports', label: 'Reportes', icon: ReceiptText },
        { id: 'advanced', label: 'Avanzado', icon: AlertTriangle },
    ];

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
                {/* Tabs Header */}
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto -mb-px">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                            ? 'border-[#8CC63F] text-[#8CC63F]'
                                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'dashboard' && (
                    <div className="animate-in fade-in duration-300">
                        <AdminDashboardCharts />
                    </div>
                )}

                {activeTab === 'management' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in duration-300">
                        {/* Columna 1: Trabajadores */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-5 h-5 text-[#8CC63F]" />
                                <h2 className="text-xl font-semibold">Gestión de Colaboradores</h2>
                            </div>
                            <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl h-full">
                                <UserCrud />
                            </div>
                        </div>

                        {/* Columna 2: Proyectos */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-[#8CC63F]" />
                                <h2 className="text-xl font-semibold">Proyectos Activos</h2>
                            </div>
                            <div className="h-[400px]">
                                <ProjectCrud />
                            </div>
                        </div>

                        {/* Columna 3: Categorías */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-[#8CC63F]" />
                                <h2 className="text-xl font-semibold">Categorías y Límites</h2>
                            </div>
                            <div className="h-[400px]">
                                <CategoryCrud />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-[#8CC63F]" />
                            <h2 className="text-xl font-semibold">Reporte General de Gastos</h2>
                        </div>
                        <div>
                            <AdminReceipts />
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="animate-in fade-in duration-300">
                        <DangerZone />
                    </div>
                )}
            </main>
        </div>
    );
}
