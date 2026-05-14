"use client";

/**
 * Agent Configuration Panel Component
 *
 * Slide-over panel for configuring agent properties. Wraps ConfigForm
 * in a Sheet component and handles save/cancel/close actions.
 *
 * @module components/agents/config
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfigForm } from "@/components/agents/config-form";
import type { FormConfig } from "@/components/agents/config-form";
import type { Agent } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/** Props for the ConfigPanel component */
export interface ConfigPanelProps {
  /** The agent to configure, or null if panel should be hidden */
  agent: Agent | null;
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback when agent config is saved */
  onSave: (agentId: string, config: FormConfig) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConfigPanel - Slide-over panel for editing agent configuration.
 *
 * Renders as a Sheet (sidebar) on the right side of the screen.
 * Shows agent name in the header and a ConfigForm for editing.
 *
 * @example
 * ```tsx
 * <ConfigPanel
 *   agent={selectedAgent}
 *   isOpen={isConfigOpen}
 *   onClose={() => setConfigOpen(false)}
 *   onSave={(id, config) => updateAgent(id, config)}
 * />
 * ```
 */
export function ConfigPanel({
  agent,
  isOpen,
  onClose,
  onSave,
}: ConfigPanelProps) {
  if (!agent) return null;

  const handleSave = (config: FormConfig) => {
    onSave(agent.id, config);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl">{agent.avatar}</span>
            Configure {agent.name}
          </SheetTitle>
          <SheetDescription>
            Edit agent properties and behavior settings.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <ConfigForm
            agent={agent}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
