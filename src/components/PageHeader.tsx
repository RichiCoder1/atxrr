import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export function PageHeader({
	children,
	className,
	...props
}: ComponentPropsWithoutRef<"h1">) {
	return (
		<h1
			{...props}
			className={cn(
				"rainbow-text my-8 text-center text-4xl font-semibold leading-normal",
				className,
			)}
		>
			{children}
		</h1>
	);
}
