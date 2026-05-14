import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";

export function Header() {
  return (
    <header
      className="flex h-14 items-center justify-between border-b bg-background px-3 sm:px-4 lg:px-6"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <MobileSidebar />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Thinker</h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
