import { cn } from "@/lib/utils";
import * as Ariakit from "@ariakit/react";
import { ExternalLink } from "lucide-react";
import * as React from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export type { MenuProviderProps } from "@ariakit/react";
export { MenuProvider } from "@ariakit/react";

// These contexts allow us to set the props on the parent menu component from a
// child component.
const SetShiftContext = React.createContext<Dispatch<SetStateAction<number>>>(
	() => {},
);
const SetPlacementContext = React.createContext<
	Dispatch<SetStateAction<Ariakit.MenuProviderProps["placement"]>>
>(() => {});

export interface MenubarProps extends Ariakit.MenubarProps {
	children?: ReactNode;
}

export const Menubar = React.forwardRef<HTMLDivElement, MenubarProps>(
	function Menubar(props, ref) {
		const [shift, setShift] = React.useState(0);
		const [placement, setPlacement] =
			React.useState<Ariakit.MenuProviderProps["placement"]>("bottom");
		return (
			<Ariakit.Menubar
				ref={ref}
				{...props}
				className={cn("flex items-center gap-1", props.className)}
			>
				<SetShiftContext.Provider value={setShift}>
					<SetPlacementContext.Provider value={setPlacement}>
						<Ariakit.MenuProvider
							placement={placement}
							showTimeout={100}
							hideTimeout={250}
						>
							{props.children}
							<Ariakit.Menu
								// This menu component is shared across all menus in the
								// menubar. This enables us to animate the menu position when
								// the user hovers over a menu item.
								portal
								shift={shift}
								tabIndex={-1}
								unmountOnHide
								className={cn(
									"relative z-50 max-h-(--popover-available-height) max-w-(--popover-available-width) rounded-md border border-solid bg-popover p-4 opacity-0 transition-opacity data-enter:opacity-100 data-enter:animate-in data-enter:zoom-in-90 focus-visible:text-primary",
									props.className,
								)}
							>
								<Ariakit.MenuArrow className="transition-[left]" />
							</Ariakit.Menu>
						</Ariakit.MenuProvider>
					</SetPlacementContext.Provider>
				</SetShiftContext.Provider>
			</Ariakit.Menubar>
		);
	},
);

export interface MenuProps extends Ariakit.MenuItemProps {
	label: string;
	placement?: Ariakit.MenuStoreProps["placement"];
	children?: ReactNode;
	shift?: number;
	href?: string;
}

export const Menu = React.forwardRef<
	HTMLDivElement,
	MenuProps & { external?: boolean }
>(function Menu(
	{
		shift = 0,
		placement = "bottom",
		label,
		href,
		children,
		external,
		...props
	},
	ref,
) {
	const [menuButton, setMenuButton] = React.useState<HTMLDivElement | null>(
		null,
	);

	const setShift = React.useContext(SetShiftContext);
	const setPlacement = React.useContext(SetPlacementContext);
	// By passing the menu context from the MenuProvider component, which is
	// rendered in the Menubar component above, to our menu store, they'll share
	// the same state. In this way, we can control the parent menu store from
	// within this component.
	const context = Ariakit.useMenuContext();
	const menu = Ariakit.useMenuStore({ store: context });
	// Get the menu element rendered by the parent component (contentElement) and
	// use it as the portal element for this menu's contents.
	const parentMenu = menu.useState("contentElement");
	// Compare the menu button element with the current anchor element set when
	// the menu opens to ascertain whether the menu is open.
	const open = menu.useState(
		(state) => state.mounted && state.anchorElement === menuButton,
	);

	React.useLayoutEffect(() => {
		if (!open) return;
		setShift(shift);
		setPlacement(placement);
	}, [open, setShift, shift, setPlacement, placement]);

	const item = (
		<Ariakit.MenuItem
			ref={ref}
			store={menu.menubar || undefined}
			tabbable
			blurOnHoverEnd={false}
			{...props}
			className={cn(
				"group flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded px-3 underline-offset-4 outline-solid outline-2 outline-transparent transition-colors hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent/50 aria-expanded:text-accent-foreground focus-visible:bg-accent/80",
				props.className,
			)}
			render={href ? <a href={href} /> : undefined}
		>
			{label}
			{!children && !!external && (
				<ExternalLink className="text-foreground/50" size="1rem" />
			)}
			{!!children && (
				<Ariakit.MenuButtonArrow className="transition-transform group-aria-expanded:rotate-180" />
			)}
		</Ariakit.MenuItem>
	);

	// If there are no children, this means that this menu item is a leaf node in
	// the menubar, and we can render it as a simple menu item.
	if (!children) return item;

	return (
		// By default, nested menu providers will automatically assign the parent
		// menu store. We need to manually set the parent to null in this case
		// because the parent menu provider isn't really a parent menu, but rather
		// an aggregator.
		<Ariakit.MenuProvider store={menu} parent={null}>
			<Ariakit.MenuButton
				ref={setMenuButton}
				showOnHover
				render={item}
				// Always show the menu when the menu button gets keyboard focus. Also,
				// it's necessary to define the disclosure and anchor elements as this
				// menu can have various potential anchor elements.
				onFocusVisible={(event) => {
					menu.setDisclosureElement(event.currentTarget);
					menu.setAnchorElement(event.currentTarget);
					menu.show();
				}}
				// Ensure the menu is always shown, not toggled, when the menu button is
				// clicked. If the menu button is a link, we don't want to show the menu
				// upon clicking, only on hovering or using arrow keys.
				toggleOnClick={() => {
					if (href) return false;
					menu.show();
					return false;
				}}
			/>
			{open && (
				// Render this menu's contents into the parent menu.
				<Ariakit.Portal portalElement={parentMenu} className="flex flex-col">
					{children}
				</Ariakit.Portal>
			)}
		</Ariakit.MenuProvider>
	);
});

export interface MenuItemProps extends Ariakit.MenuItemProps {
	label: string;
	href?: string;
	description?: string;
}

export const MenuItem = React.forwardRef<
	HTMLDivElement,
	MenuItemProps & { external?: boolean }
>(function MenuItem({ ...props }, ref) {
	const menu = Ariakit.useMenuContext();
	const id = React.useId();
	const labelId = `${id}-label`;
	const descriptionId = `${id}-description`;
	const { external, ...menuProps } = props;
	return (
		<Ariakit.MenuItem
			ref={ref}
			store={menu}
			tabbable
			focusOnHover={false}
			aria-labelledby={labelId}
			aria-describedby={props.description ? descriptionId : undefined}
			{...menuProps}
			className={cn(
				"flex cursor-pointer flex-col items-start gap-1 rounded-sm p-4 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-hidden",
				props.className,
			)}
			render={props.href ? <a href={props.href} /> : undefined}
		>
			<div id={labelId} className="inline-flex items-center font-medium">
				{props.label}
				{!!external && (
					<ExternalLink
						className="inline-block pl-1 text-foreground/50"
						size="1rem"
					/>
				)}
			</div>
			{props.description && (
				<div id={descriptionId} className="font-light opacity-70">
					{props.description}
				</div>
			)}
		</Ariakit.MenuItem>
	);
});

export interface MenuGroupProps extends Ariakit.MenuGroupProps {
	label: string;
	children?: ReactNode;
}

export const MenuGroup = React.forwardRef<HTMLDivElement, MenuGroupProps>(
	function MenuGroup({ label, ...props }, ref) {
		return (
			<Ariakit.MenuGroup
				ref={ref}
				{...props}
				className={cn("flex flex-col", props.className)}
			>
				<Ariakit.MenuGroupLabel className="cursor-default p-2 px-4 font-medium opacity-60">
					{label}
				</Ariakit.MenuGroupLabel>
				{props.children}
			</Ariakit.MenuGroup>
		);
	},
);
