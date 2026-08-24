// Tres roles: 'admin' (acceso total), 'revisor' (ve todo el panel admin,
// exporta informes, pero no puede crear/editar/eliminar nada) y 'colaborador'
// (solo la app de trabajador). El rol vive en user_metadata, igual que el
// resto de la app.
export type AppRole = 'admin' | 'revisor' | 'colaborador';

export const ROLES: AppRole[] = ['admin', 'revisor', 'colaborador'];

export function getRole(user: { user_metadata?: { role?: string } } | null | undefined): AppRole {
    const role = user?.user_metadata?.role;
    return role === 'admin' || role === 'revisor' ? role : 'colaborador';
}

// Puede entrar al panel de administración (verlo), sea admin o revisor.
export function canViewAdminPanel(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    const role = getRole(user);
    return role === 'admin' || role === 'revisor';
}

// Puede crear, editar o eliminar algo. Solo admin.
export function isAdmin(user: { user_metadata?: { role?: string } } | null | undefined): boolean {
    return getRole(user) === 'admin';
}
