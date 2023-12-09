import { Menu, MenuItem, Menubar } from "@/components/ui/menubar";
import {
	Disclosure,
	DisclosureContent,
	DisclosureProvider,
	MenuButtonArrow,
	useDisclosureStore,
	useMenuStore,
} from "@ariakit/react";
import { X, Menu as Burger, ChevronDown } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";
import { Button } from "./ui/button";
import { NavButton } from "./ui/navbutton";

export type NavMenuProps = {
	path: string;
};

export function NavMenu({ path }: NavMenuProps) {
	return (
		<Menubar>
			<DesktopMenu path={path} />
			<MobileMenu path={path} />
		</Menubar>
	);
}

function DesktopMenu({ path }: NavMenuProps) {
	return (
		<>
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
		</>
	);
}

function MobileMenu({ path }: NavMenuProps) {
	const [open, setOpen] = useState(false);
	const store = useDisclosureStore({ open, setOpen });
	return (
		<>
			<Disclosure
				store={store}
				className="inline-block md:hidden"
				title={!open ? "Expand Navigation Menu" : "Collapse Navigation Menu"}
			>
				{open == false ? <Burger /> : <X />}
			</Disclosure>
			<DisclosureContent store={store}>
				<div className="absolute left-0 top-0 mt-[4.5rem] flex w-full flex-col bg-zinc-900 shadow shadow-zinc-800 md:hidden">
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
			</DisclosureContent>
		</>
	);
}

function MobileDisclosure({
	label,
	...props
}: ComponentPropsWithoutRef<typeof DisclosureContent> & { label: string }) {
	const [open, setOpen] = useState(false);
	const menuStore = useMenuStore({ open, setOpen });
	const disclosureStore = useDisclosureStore({ open, setOpen });
	return (
		<DisclosureProvider>
			<Disclosure
				as={Button}
				store={disclosureStore}
				size="lg"
				variant="ghost"
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
