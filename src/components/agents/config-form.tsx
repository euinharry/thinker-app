"use client";

/**
 * Agent Configuration Form Component
 *
 * Form for editing agent properties: name, personality, system prompt,
 * model selection, temperature, and avatar. Includes validation for
 * required fields and temperature range.
 *
 * @module components/agents/config-form
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/** Form configuration combining display and model settings */
export interface FormConfig {
  name: string;
  personality: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  avatar: string;
}

/** Props for the ConfigForm component */
export interface ConfigFormProps {
  /** The agent being configured */
  agent: Agent;
  /** Callback when form is saved with valid data */
  onSave: (config: FormConfig) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
}

/** Validation errors for form fields */
type FormErrors = Partial<Record<keyof FormConfig, string>>;

// ============================================================================
// Constants
// ============================================================================

/** Available AI models for selection */
const AVAILABLE_MODELS = [
  { value: "mimo-v2.5-pro", label: "mimo-v2.5-pro" },
  { value: "deepseek-chat", label: "deepseek-chat" },
  { value: "gpt-4", label: "gpt-4" },
] as const;

/** Available emoji avatars */
const AVATAR_OPTIONS = ["👑", "🔍", "🧠", "🎯", "🤖", "👤", "💡", "🔬"] as const;

/** Default model when agent has no config */
const DEFAULT_MODEL = "mimo-v2.5-pro";

/** Default temperature */
const DEFAULT_TEMPERATURE = 0.7;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate form configuration and return errors.
 * Checks required fields and temperature range (0-2).
 */
function validateForm(config: FormConfig): FormErrors {
  const errors: FormErrors = {};

  if (!config.name.trim()) {
    errors.name = "Name is required";
  }

  if (!config.personality.trim()) {
    errors.personality = "Personality is required";
  }

  if (!config.systemPrompt.trim()) {
    errors.systemPrompt = "System prompt is required";
  }

  if (config.temperature < 0 || config.temperature > 2) {
    errors.temperature = "Temperature must be between 0 and 2";
  }

  return errors;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConfigForm - Form component for editing agent properties.
 *
 * Renders all editable agent fields with validation and save/cancel actions.
 * Uses shadcn/ui components for consistent styling.
 *
 * @example
 * ```tsx
 * <ConfigForm
 *   agent={leaderAgent}
 *   onSave={(config) => console.log("Saved:", config)}
 *   onCancel={() => setOpen(false)}
 * />
 * ```
 */
export function ConfigForm({ agent, onSave, onCancel }: ConfigFormProps) {
  const [config, setConfig] = useState<FormConfig>({
    name: agent.name,
    personality: agent.personality,
    systemPrompt: agent.systemPrompt,
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    avatar: agent.avatar,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when agent changes (e.g., switching between agents in sidebar)
  useEffect(() => {
    setConfig({
      name: agent.name,
      personality: agent.personality,
      systemPrompt: agent.systemPrompt,
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      avatar: agent.avatar,
    });
    setErrors({});
  }, [agent.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formErrors = validateForm(config);
    setErrors(formErrors);

    if (Object.keys(formErrors).length === 0) {
      onSave(config);
    }
  };

  const updateField = <K extends keyof FormConfig>(
    field: K,
    value: FormConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user edits it
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-slot="config-form">
      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          value={config.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Agent name"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Personality field */}
      <div className="space-y-2">
        <Label htmlFor="agent-personality">Personality</Label>
        <Textarea
          id="agent-personality"
          value={config.personality}
          onChange={(e) => updateField("personality", e.target.value)}
          placeholder="Short personality description"
          rows={2}
          aria-invalid={!!errors.personality}
        />
        {errors.personality && (
          <p className="text-sm text-destructive" role="alert">
            {errors.personality}
          </p>
        )}
      </div>

      {/* System Prompt field */}
      <div className="space-y-2">
        <Label htmlFor="agent-system-prompt">System Prompt</Label>
        <Textarea
          id="agent-system-prompt"
          value={config.systemPrompt}
          onChange={(e) => updateField("systemPrompt", e.target.value)}
          placeholder="System prompt that guides agent behavior"
          rows={6}
          aria-invalid={!!errors.systemPrompt}
        />
        {errors.systemPrompt && (
          <p className="text-sm text-destructive" role="alert">
            {errors.systemPrompt}
          </p>
        )}
      </div>

      {/* Model selection */}
      <div className="space-y-2">
        <Label htmlFor="agent-model">Model</Label>
        <Select
          value={config.model}
          onValueChange={(value) => {
            if (value != null) updateField("model", value);
          }}
        >
          <SelectTrigger id="agent-model" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature slider */}
      <div className="space-y-2">
        <Label>
          Temperature:{" "}
          <span className="font-mono text-muted-foreground">
            {config.temperature.toFixed(1)}
          </span>
        </Label>
        <Slider
          value={[config.temperature]}
          onValueChange={(val) => {
            const value = Array.isArray(val) ? val[0] : val;
            if (value != null) updateField("temperature", value);
          }}
          min={0}
          max={2}
          step={0.1}
          aria-label="Temperature"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
        {errors.temperature && (
          <p className="text-sm text-destructive" role="alert">
            {errors.temperature}
          </p>
        )}
      </div>

      {/* Avatar selection */}
      <div className="space-y-2">
        <Label>Avatar</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar selection">
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={config.avatar === emoji}
              aria-label={`Avatar ${emoji}`}
              onClick={() => updateField("avatar", emoji)}
              className={`size-10 rounded-lg border text-xl transition-colors ${
                config.avatar === emoji
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border hover:border-foreground/30 hover:bg-muted"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
