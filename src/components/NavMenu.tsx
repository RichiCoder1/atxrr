import { Button } from "./ui/button";
import { NavButton } from "./ui/navbutton";
import { Menu, MenuItem, Menubar } from "@/components/ui/menubar";
import type { NavigationItem } from "@/lib/collections";
import {
	Dialog,
	Disclosure,
	DisclosureContent,
	DisclosureProvider,
	useDialogStore,
	useDisclosureStore,
} from "@ariakit/react";
import { X, Menu as Burger, ChevronDown } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";

export type NavMenuProps = {
	path: string;
	items: NavigationItem[];
};

export function DesktopMenu({ path, items }: NavMenuProps) {
	return (
		<>
			<Menubar className="hidden lg:flex">
				{items.map((item) => (
					<Menu
						key={item.id}
						href={item.href}
						label={item.name}
						aria-current={item.href != null && path === item.href}
					>
						{item?.children.length === 0
							? undefined
							: item.children?.map((child) => (
									<MenuItem
										key={child.id}
										href={child.href}
										label={child.name}
										description={child.description}
										external={child.is_external === true}
									/>
								))}
					</Menu>
				))}
			</Menubar>
		</>
	);
}

export function MobileMenu({ path, items }: NavMenuProps) {
	const [open, setOpen] = useState(false);
	const dialog = useDialogStore({ animated: true });
	return (
		<>
			<Button
				className="inline-block lg:hidden"
				variant="ghost"
				title={!open ? "Expand Navigation Menu" : "Collapse Navigation Menu"}
				onClick={() => setOpen(true)}
			>
				{open == false ? <Burger /> : <X />}
			</Button>
			<Dialog
				store={dialog}
				open={open}
				onClose={() => setOpen(false)}
				className="fixed left-0 top-0 z-50 m-auto flex h-fit max-h-[calc(100vh-4.5rem)] w-screen gap-4 mt-18 transition opacity-50 data-enter:opacity-100 translate-y-2 data-enter:translate-y-0 border-b-2 border-alternate"
			>
				<div className=" w-screen flex flex-col bg-zinc-900 shadow-sm shadow-zinc-800 lg:hidden">
					{items.map((item) =>
						item.children?.length > 0 ? (
							<MobileDisclosure key={item.id} label={item.name}>
								{item.children.map((child) => (
									<NavButton
										key={item.id}
										href={child.href!}
										label={child.name}
										external={child.is_external === true}
									/>
								))}
							</MobileDisclosure>
						) : (
							<NavButton
								key={item.id}
								href={item.href!}
								label={item.name}
								aria-current={item.href != null && path === item.href}
							/>
						),
					)}
				</div>
			</Dialog>
		</>
	);
}

function MobileDisclosure({
	label,
	...props
}: ComponentPropsWithoutRef<typeof DisclosureContent> & { label: string }) {
	const [open, setOpen] = useState(false);
	const disclosureStore = useDisclosureStore({ open, setOpen });
	return (
		<DisclosureProvider>
			<Disclosure
				render={<Button size="lg" variant="ghost" />}
				store={disclosureStore}
				className="group w-full justify-start gap-2 lg:w-[unset] lg:justify-center"
			>
				{label}
				<ChevronDown className="transition-transform group-aria-expanded:rotate-180" />
			</Disclosure>
			<DisclosureContent
				store={disclosureStore}
				className="ml-4 border-l border-l-accent"
				{...props}
			></DisclosureContent>
		</DisclosureProvider>
	);
}
