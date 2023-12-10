import { Button } from "./ui/button";
import { NavButton } from "./ui/navbutton";
import { Menu, MenuItem, Menubar } from "@/components/ui/menubar";
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
};

export function DesktopMenu({ path }: NavMenuProps) {
	return (
		<>
			<Menubar>
				<Menu
					href="/"
					label="Home"
					aria-current={path === "/"}
					className="hidden md:flex"
				/>
				<Menu
					href="https://www.tickettailor.com/events/boopsocietyctx/1001871"
					label="Register"
					external
					className="hidden md:flex"
				/>
				<Menu label="Hotel" className="hidden md:flex">
					<MenuItem
						href="https://tinyurl.com/ARRHotelRes"
						label="Reservations"
						description="Book with our hotel block"
						external
					/>
					<MenuItem
						href="https://www.ihg.com/hotelindigo/hotels/us/en/austin/ausit/hoteldetail/amenities"
						label="Hotel Information"
						description="Learn about our host hotel and it's amenities"
						external
					/>
				</Menu>
				<Menu label="Participate" className="hidden md:flex">
					<MenuItem
						href="https://docs.google.com/forms/d/e/1FAIpQLSf3H1Wv6Xqnxb5P6Orjb-J1TkTsLdWEA18sPZqpgyClRX2pvQ/viewform?usp=sharing"
						label="Vendor Application"
						external
					/>
					<MenuItem
						href="https://docs.google.com/forms/d/e/1FAIpQLSdqkhzz24s1DVNlzAcSy6Er3sig5WJ7JOOp-i2tp20bx1PsNw/viewform?usp=sharing"
						label="Educators Application"
						external
					/>
					<MenuItem
						href="https://signup.com/go/kpKjZsJ"
						label="Volunteer Application"
						description="Sign up to help out! (6 hours for entry | 8 for keynote added)"
						external
					/>
				</Menu>
				<Menu
					href="https://tr.ee/ANAufovI-T"
					label="Donate"
					external
					className="hidden md:flex"
				/>
			</Menubar>
		</>
	);
}

export function MobileMenu({ path }: NavMenuProps) {
	const [open, setOpen] = useState(false);
	const dialog = useDialogStore({ animated: true });
	return (
		<>
			<Button
				className="inline-block md:hidden"
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
				className="fixed left-0 top-0 z-50 m-auto flex h-[fit-content] max-h-[calc(100vh-4.5rem)] w-screen gap-4 mt-[4.5rem] transition opacity-50 data-enter:opacity-100 translate-y-2 data-enter:translate-y-0 border-b-2 border-alternate"
			>
				<div className=" w-screen flex flex-col bg-zinc-900 shadow shadow-zinc-800 md:hidden">
					<NavButton href="/" label="Home" aria-current={path === "/"} />
					<NavButton
						href="https://www.tickettailor.com/events/boopsocietyctx/1001871"
						label="Register"
						external
					/>
					<MobileDisclosure label="Hotel">
						<NavButton
							href="https://tinyurl.com/ARRHotelRes"
							label="Reservations"
							external
						/>
						<NavButton
							href="https://www.ihg.com/hotelindigo/hotels/us/en/austin/ausit/hoteldetail/amenities"
							label="Hotel Information"
							external
						/>
					</MobileDisclosure>
					<MobileDisclosure label="Participate">
						<NavButton
							href="https://docs.google.com/forms/d/e/1FAIpQLSf3H1Wv6Xqnxb5P6Orjb-J1TkTsLdWEA18sPZqpgyClRX2pvQ/viewform?usp=sharing"
							label="Vendor Application"
							external
						/>
						<NavButton
							href="https://docs.google.com/forms/d/e/1FAIpQLSdqkhzz24s1DVNlzAcSy6Er3sig5WJ7JOOp-i2tp20bx1PsNw/viewform?usp=sharing"
							label="Educators Application"
							external
						/>
						<NavButton
							href="https://signup.com/go/kpKjZsJ"
							label="Volunteer Application"
							external
						/>
					</MobileDisclosure>
					<NavButton href="https://tr.ee/ANAufovI-T" label="Donate" external />
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
				className="group w-full justify-start gap-2 md:w-[unset] md:justify-center"
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
