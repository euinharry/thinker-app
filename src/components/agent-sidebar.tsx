"use client";

import { getAllAgents } from "@/lib/agents/personalities";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AgentSidebar({ className }: { className?: string }) {
  const agents = getAllAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <aside className={cn("flex flex-col", className)}>
      <div className="px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Agents
        </h2>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              selectedAgent === agent.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <span className="text-lg">{agent.avatar}</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{agent.name}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {agent.personality}
              </span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
