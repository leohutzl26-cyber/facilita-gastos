// Cinco roles: 'admin' (acceso total), 'aprobador' (ve todo el panel admin,
// exporta informes, y además puede aprobar/rechazar/revertir el estado de
// los gastos y comentarlos), 'pagador' (ve todo el panel admin, exporta
// informes, y además gestiona comprobantes de pago: subir, asociar,
// desasociar, eliminar y marcar gastos como Reembolsado), 'visor' (ve todo
// el panel admin y exporta informes, sin poder aprobar ni modificar nada) y
// 'colaborador' (solo la app de trabajador). El rol vive en user_metadata,
// igual que el resto de la app.
export type AppRole = 'admin' | 'aprobador' | 'pagador' | 'visor' | 'colaborador';

export const ROLES: AppRole[] = ['admin', 'aprobador', 'pagador', 'visor', 'colaborador'];

export function getRole(user: { user_metadata?: { role?: string } } | null | undefined): AppRole {
    const role = user?.user_metadata?.role;
    return role === 'admin' || role === 'aprobador' || role === 'pagador' || role === 'visor' ? role : 'colaborador';
}

// Puede entrar al panel de administración (verlo): admin, aprobador, pagador o visor.
export function canViewAdminPanel(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    const role = getRole(user);
    return role === 'admin' || role === 'aprobador' || role === 'pagador' || role === 'visor';
}

// Puede aprobar, rechazar o revertir el estado de un gasto, y comentarlo.
// Admin o aprobador.
export function canApprove(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    const role = getRole(user);
    return role === 'admin' || role === 'aprobador';
}

// Puede gestionar comprobantes de pago (subir, asociar, desasociar, eliminar)
// y marcar un gasto como Reembolsado. Admin o pagador.
export function canManagePayments(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    const role = getRole(user);
    return role === 'admin' || role === 'pagador';
}

// Puede crear, editar o eliminar cualquier otra cosa (proyectos, categorías,
// usuarios, papelera, zona de peligro). Solo admin.
export function isAdmin(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    return getRole(user) === 'admin';
}
