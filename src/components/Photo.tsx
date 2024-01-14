import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export interface PhotoProps extends ComponentPropsWithoutRef<"img"> {}

export function Photo({ className, ...props }: PhotoProps) {
	return (
		<img
			{...props}
			className={cn(
				className,
				"rounded-2xl border-primary border-2 shadow-[1rem_-1rem_0_0_var(--tw-shadow)] shadow-alternate",
			)}
		/>
	);
}
