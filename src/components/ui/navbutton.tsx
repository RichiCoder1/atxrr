import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import type * as React from "react";

export type NavProps = Omit<
	React.ComponentPropsWithoutRef<typeof LinkButton> & {
		label: string;
		href: string;
		external?: boolean;
	},
	"children"
>;

/**
 * Previously this wrapped a <button> in an <a href> and gave the anchor
 * `tabIndex={-1}` so the pair exposed a single tab stop. React Aria's
 * `LinkButton` renders a real anchor that is already styled and focusable as
 * one control, so the wrapper — and the nested-interactive-element it created —
 * is no longer needed.
 */
function NavButton({ href, external, className, label, ...props }: NavProps) {
	return (
		<LinkButton
			href={href}
			variant="ghost"
			size="lg"
			className={cn(
				"w-full justify-start lg:w-[unset] lg:justify-center",
				className,
			)}
			{...props}
		>
			{label}
			{!!external && (
				<ExternalLink
					data-icon="inline-end"
					className="inline-block pl-1 text-foreground/50"
					size="1rem"
				/>
			)}
		</LinkButton>
	);
}

export { NavButton };
