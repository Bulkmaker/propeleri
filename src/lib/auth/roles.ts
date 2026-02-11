/**
 * Централизованная проверка ролей для admin-доступа.
 * Используется в admin/layout.tsx и api/admin/players/route.ts.
 */
export function isAdminRole(
    profile: { app_role: string; team_role: string } | null | undefined
): boolean {
    if (!profile) return false;
    return (
        profile.app_role === "admin" ||
        profile.team_role === "captain" ||
        profile.team_role === "assistant_captain"
    );
}
