import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import React from "react";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    icon?: LucideIcon | React.ElementType;
    description?: string;
    iconClassName?: string;
    titleClassName?: string;
}

export function PageHeader({
    title,
    icon: Icon,
    description,
    className,
    iconClassName,
    titleClassName,
    children,
    ...props
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col gap-1 mb-8", className)} {...props}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className={cn(
                        "h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0",
                        iconClassName
                    )}>
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                )}
                <h1 className={cn("text-3xl font-bold font-headline tracking-tight", titleClassName)}>
                    {title}
                </h1>
                {children}
            </div>
            {description && (
                <p className="text-muted-foreground ml-13">{description}</p>
            )}
        </div>
    );
}
