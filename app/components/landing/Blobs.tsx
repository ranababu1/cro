/** Soft decorative blobs. Purely visual, absolutely positioned so they never affect layout. */
export function Blobs({ variant }: { variant: 'hero' | 'band' }) {
    if (variant === 'hero') {
        return (
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="blob blob-a left-[-10%] top-[-8%] h-[28rem] w-[28rem] bg-sky-200/55" />
                <div className="blob blob-b right-[-12%] top-[5%] h-[34rem] w-[34rem] bg-teal-200/45" />
                <div className="blob blob-c left-[35%] top-[45%] h-[22rem] w-[30rem] bg-blue-100/70" />
            </div>
        );
    }
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="blob blob-b left-[-8%] top-[10%] h-[26rem] w-[30rem] bg-sky-200/50" />
            <div className="blob blob-a right-[5%] top-[30%] h-[22rem] w-[26rem] bg-teal-200/40" />
            <div className="blob blob-c left-[40%] bottom-[-10%] h-[18rem] w-[24rem] bg-teal-100/60" />
        </div>
    );
}
