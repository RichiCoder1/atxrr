import { Menu, MenuGroup, MenuItem, Menubar } from '@/components/ui/menubar';

export function NavMenu({ path }: { path: string }) {
    return (
        <Menubar>
            <Menu href="/" label="Home" aria-current={path === '/'} />
            <Menu href="https://www.tickettailor.com/events/boopsocietyctx/1001871" label="Register" />
            <Menu
                label="Hotel"
            >
                <MenuItem href="https://tinyurl.com/ARRHotelRes" label="Reservations" description="Book with our hotel block" />
                <MenuItem
                    href="https://www.ihg.com/hotelindigo/hotels/us/en/austin/ausit/hoteldetail/amenities"
                    label="Hotel Information"
                    description="Learn about our host hotel and it's amenities"
                />
            </Menu>
            <Menu label="Participate">
                <MenuItem href="https://docs.google.com/forms/d/e/1FAIpQLSf3H1Wv6Xqnxb5P6Orjb-J1TkTsLdWEA18sPZqpgyClRX2pvQ/viewform?usp=sharing" label="Vendor Application" />
                <MenuItem href="https://docs.google.com/forms/d/e/1FAIpQLSdqkhzz24s1DVNlzAcSy6Er3sig5WJ7JOOp-i2tp20bx1PsNw/viewform?usp=sharing" label="Educators Application" />
                <MenuItem href="https://signup.com/go/kpKjZsJ" label="Volunteer Application" description="Sign up to help out! (6 hours for entry | 8 for keynote added)" />
            </Menu>
            <Menu href="https://tr.ee/ANAufovI-T" label="Donate" />
        </Menubar>
    );
}
