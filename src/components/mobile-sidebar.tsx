"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AgentSidebar } from "@/components/agent-sidebar";

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Menu className="size-5" />
        <span className="sr-only">Toggle sidebar</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Thinker</SheetTitle>
        </SheetHeader>
        <AgentSidebar className="py-2" />
      </SheetContent>
    </Sheet>
  );
}
