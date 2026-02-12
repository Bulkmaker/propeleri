import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
    title: string;
    children?: React.ReactNode;
    className?: string;
}

/**
 * Unified sticky header for admin pages.
 * Sits below the mobile AdminShell header (h-14 = 3.5rem) on small screens
 * and sticks to the top on desktop where the shell header is hidden.
 */
export function AdminPageHeader({
    title,
    children,
    className,
}: AdminPageHeaderProps) {
    return (
        <div
            className={cn(
                "sticky top-14 md:top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between gap-4",
                className,
            )}
        >
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {children && (
                <div className="flex items-center gap-2 shrink-0">{children}</div>
            )}
        </div>
    );
}
