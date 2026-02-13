import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { COUNTRY_OPTIONS, countryFlagEmoji } from "@/lib/utils/country"

interface CountrySelectProps {
    value?: string | null
    onChange: (value: string | null) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function CountrySelect({
    value,
    onChange,
    placeholder,
    className,
    disabled,
}: CountrySelectProps) {
    const t = useTranslations("common")

    return (
        <Select
            value={value || "none"}
            onValueChange={(val) => onChange(val === "none" ? null : val)}
            disabled={disabled}
        >
            <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={placeholder || t("selectCountry")} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">
                    <span className="text-muted-foreground">{t("notSelected")}</span>
                </SelectItem>
                {COUNTRY_OPTIONS.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                            <span className="text-lg">{countryFlagEmoji(country.code)}</span>
                            <span>{country.label}</span>
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
