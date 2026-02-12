"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectWithNoneOption {
  value: string;
  label: string;
}

interface SelectWithNoneProps {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  options: SelectWithNoneOption[];
  placeholder?: string;
  noneLabel?: string;
  className?: string;
  triggerClassName?: string;
}

const NONE_VALUE = "__none__";

export function SelectWithNone({
  value,
  onValueChange,
  options,
  placeholder,
  noneLabel = "—",
  className,
  triggerClassName,
}: SelectWithNoneProps) {
  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onValueChange(v === NONE_VALUE ? "" : v)}
    >
      <SelectTrigger className={triggerClassName ?? "bg-background"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={className}>
        <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
