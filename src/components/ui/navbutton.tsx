import * as React from "react";
import { Button as ButtonPrimitive } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export type NavProps = Omit<
	React.ComponentPropsWithoutRef<typeof ButtonPrimitive> & {
		label: string;
		href: string;
		external?: boolean;
	},
	"children"
>;

const NavButton = React.forwardRef<
	React.ElementRef<typeof ButtonPrimitive>,
	NavProps
>(({ href, external, className, label, ...props }, ref) => (
	<a href={href}>
		<ButtonPrimitive
			variant="ghost"
			size="lg"
			ref={ref}
			className={cn(
				"w-full justify-start md:w-[unset] md:justify-center",
				className,
			)}
			{...props}
		>
			{label}
			{!!external && (
				<ExternalLink
					className="inline-block pl-1 text-foreground/50"
					size="1rem"
				/>
			)}
		</ButtonPrimitive>
	</a>
));

NavButton.displayName = "NavButton";

export { NavButton };
