// Small 16px stroke icons. Kept local to avoid an icon dependency.
const P = (d: string) =>
    function Icon({ className = 'h-4 w-4' }: { className?: string }) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
                <path d={d} />
            </svg>
        );
    };

export const HomeIcon = P('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z');
export const FlaskIcon = P('M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9');
export const KeyIcon = P('M15.5 7.5a3.5 3.5 0 1 1-4.9 3.2L3 18.3V21h3v-2h2v-2h2l1.3-1.3A3.5 3.5 0 0 1 15.5 7.5zM16.5 8.5h.01');
export const ShieldIcon = P('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z');
export const UserIcon = P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0');
export const BookIcon = P('M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20');
export const MegaphoneIcon = P('M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12');
export const ChatIcon = P('M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5');
export const ChartIcon = P('M4 20V10M10 20V4M16 20v-7M22 20H2');
export const ChevronIcon = P('m8 10 4 4 4-4');
export const MenuIcon = P('M4 6h16M4 12h16M4 18h16');
export const PlusIcon = P('M12 5v14M5 12h14');
export const CheckIcon = P('m5 12 5 5L20 7');
export const XIcon = P('M6 6l12 12M18 6 6 18');
