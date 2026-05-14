// @vitest-environment jsdom

/**
 * Agent Configuration Panel Tests
 *
 * Tests for ConfigForm and ConfigPanel components:
 * rendering, validation, save/cancel actions, avatar selection,
 * form field updates, and accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ============================================================================
// Mocks - Mock components that have @base-ui/jsdom issues
// ============================================================================

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    defaultValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    ...props
  }: any) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;

    const handleChange = (e: any) => {
      const newValue = parseFloat(e.target.value);
      onValueChange?.([newValue]);
    };

    return (
      <input
        type="range"
        data-mock="slider"
        value={currentValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  },
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    defaultValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    ...props
  }: any) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;

    const handleChange = (e: any) => {
      const newValue = parseFloat(e.target.value);
      onValueChange?.([newValue]);
    };

    return (
      <input
        type="range"
        data-mock="slider"
        value={currentValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  },
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { ConfigForm } from "@/components/agents/config-form";
import { ConfigPanel } from "@/components/agents/config";
import type { Agent } from "@/types/agent";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockAgent: Agent = {
  id: "leader",
  name: "Leader",
  personality: "Strategic visionary who sees the big picture",
  systemPrompt: "You are the Leader, a strategic visionary...",
  avatar: "👑",
};

const mockExplorerAgent: Agent = {
  id: "explorer",
  name: "Explorer",
  personality: "Tech researcher who gathers information",
  systemPrompt: "You are the Explorer, a technical researcher...",
  avatar: "🔍",
};

// ============================================================================
// ConfigForm Tests
// ============================================================================

describe("ConfigForm", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders all form fields", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByLabelText("Name")).toBeDefined();
      expect(screen.getByLabelText("Personality")).toBeDefined();
      expect(screen.getByLabelText("System Prompt")).toBeDefined();
      expect(screen.getByLabelText("Model")).toBeDefined();
    });

    it("pre-fills fields with agent data", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByLabelText("Name").getAttribute("value")).toBe(
        mockAgent.name
      );
      expect(
        (screen.getByLabelText("Personality") as HTMLTextAreaElement).value
      ).toBe(mockAgent.personality);
      expect(
        (screen.getByLabelText("System Prompt") as HTMLTextAreaElement).value
      ).toBe(mockAgent.systemPrompt);
    });

    it("renders temperature display", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByText(/Temperature:/)).toBeDefined();
      expect(screen.getByText("0.7")).toBeDefined();
    });

    it("renders precise/creative labels", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByText("Precise (0)")).toBeDefined();
      expect(screen.getByText("Creative (2)")).toBeDefined();
    });

    it("renders avatar options", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByLabelText("Avatar 👑")).toBeDefined();
      expect(screen.getByLabelText("Avatar 🔍")).toBeDefined();
      expect(screen.getByLabelText("Avatar 🧠")).toBeDefined();
      expect(screen.getByLabelText("Avatar 🎯")).toBeDefined();
      expect(screen.getByLabelText("Avatar 🤖")).toBeDefined();
      expect(screen.getByLabelText("Avatar 👤")).toBeDefined();
    });

    it("renders save and cancel buttons", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    });

    it("has data-slot attribute on form", () => {
      const { container } = render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const form = container.querySelector('[data-slot="config-form"]');
      expect(form).toBeDefined();
    });

    it("renders default model in trigger", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      // The Select trigger shows the current model value
      expect(screen.getByText("mimo-v2.5-pro")).toBeDefined();
    });

    it("select trigger has role=combobox", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  describe("validation", () => {
    it("shows error when name is empty", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(screen.getByText("Name is required")).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("shows error when personality is empty", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const personalityField = screen.getByLabelText("Personality");
      fireEvent.change(personalityField, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(screen.getByText("Personality is required")).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("shows error when system prompt is empty", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const systemPromptField = screen.getByLabelText("System Prompt");
      fireEvent.change(systemPromptField, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(screen.getByText("System prompt is required")).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("clears error when field is edited after validation", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);
      expect(screen.getByText("Name is required")).toBeDefined();

      fireEvent.change(nameInput, { target: { value: "New Name" } });
      expect(screen.queryByText("Name is required")).toBeNull();
    });

    it("does not call onSave when validation fails", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).not.toHaveBeenCalled();
    });

    it("validation errors have role=alert for accessibility", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((el) => el.textContent === "Name is required")).toBe(
        true
      );
    });

    it("sets aria-invalid on fields with errors", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    });
  });

  // --------------------------------------------------------------------------
  // Save action
  // --------------------------------------------------------------------------

  describe("save action", () => {
    it("calls onSave with form data when validation passes", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith({
        name: mockAgent.name,
        personality: mockAgent.personality,
        systemPrompt: mockAgent.systemPrompt,
        model: "mimo-v2.5-pro",
        temperature: 0.7,
        avatar: mockAgent.avatar,
      });
    });

    it("calls onSave with updated name", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "New Leader" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Leader" })
      );
    });

    it("calls onSave with updated personality", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const personalityField = screen.getByLabelText("Personality");
      fireEvent.change(personalityField, {
        target: { value: "New personality" },
      });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ personality: "New personality" })
      );
    });

    it("calls onSave with updated system prompt", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const systemPromptField = screen.getByLabelText("System Prompt");
      fireEvent.change(systemPromptField, {
        target: { value: "New system prompt" },
      });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ systemPrompt: "New system prompt" })
      );
    });

    it("saves with default model when no change", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ model: "mimo-v2.5-pro" })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Cancel action
  // --------------------------------------------------------------------------

  describe("cancel action", () => {
    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={onCancel} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not trigger validation on cancel", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={onCancel} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "" } });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalled();
      expect(screen.queryByText("Name is required")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Avatar selection
  // --------------------------------------------------------------------------

  describe("avatar selection", () => {
    it("highlights the current agent avatar", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const avatarButton = screen.getByLabelText("Avatar 👑");
      expect(avatarButton.getAttribute("aria-checked")).toBe("true");
    });

    it("does not highlight other avatars", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const avatarButton = screen.getByLabelText("Avatar 🔍");
      expect(avatarButton.getAttribute("aria-checked")).toBe("false");
    });

    it("updates selected avatar on click", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      fireEvent.click(screen.getByLabelText("Avatar 🧠"));

      expect(
        screen.getByLabelText("Avatar 🧠").getAttribute("aria-checked")
      ).toBe("true");
      expect(
        screen.getByLabelText("Avatar 👑").getAttribute("aria-checked")
      ).toBe("false");
    });

    it("saves with updated avatar", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      fireEvent.click(screen.getByLabelText("Avatar 🔬"));

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: "🔬" })
      );
    });

    it("avatar group has radiogroup role", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const avatarGroup = screen.getByRole("radiogroup");
      expect(avatarGroup.getAttribute("aria-label")).toBe("Avatar selection");
    });

    it("avatar buttons have radio role", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBe(8);
    });
  });

  // --------------------------------------------------------------------------
  // Temperature slider
  // --------------------------------------------------------------------------

  describe("temperature slider", () => {
    it("displays initial temperature value", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      expect(screen.getByText("0.7")).toBeDefined();
    });

    it("updates temperature display when slider changes", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      const slider = screen.getByLabelText("Temperature") as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "1.5" } });

      expect(screen.getByText("1.5")).toBeDefined();
    });

    it("saves with updated temperature", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const slider = screen.getByLabelText("Temperature") as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "1.2" } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 1.2 })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles agent with different avatar", () => {
      render(
        <ConfigForm
          agent={mockExplorerAgent}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(
        screen.getByLabelText("Avatar 🔍").getAttribute("aria-checked")
      ).toBe("true");
    });

    it("handles submitting with whitespace-only fields", () => {
      const onSave = vi.fn();
      render(
        <ConfigForm agent={mockAgent} onSave={onSave} onCancel={vi.fn()} />
      );

      const nameInput = screen.getByLabelText("Name");
      fireEvent.change(nameInput, { target: { value: "   " } });

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(screen.getByText("Name is required")).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("handles rapid avatar switching", () => {
      render(
        <ConfigForm agent={mockAgent} onSave={vi.fn()} onCancel={vi.fn()} />
      );

      fireEvent.click(screen.getByLabelText("Avatar 🔍"));
      fireEvent.click(screen.getByLabelText("Avatar 🧠"));
      fireEvent.click(screen.getByLabelText("Avatar 🎯"));

      expect(
        screen.getByLabelText("Avatar 🎯").getAttribute("aria-checked")
      ).toBe("true");
    });
  });
});

// ============================================================================
// ConfigPanel Tests
// ============================================================================

describe("ConfigPanel", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders when open with agent", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText(/Configure Leader/)).toBeDefined();
    });

    it("returns null when agent is null", () => {
      const { container } = render(
        <ConfigPanel
          agent={null}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(container.innerHTML).toBe("");
    });

    it("does not render content when closed", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={false}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.queryByText(/Configure Leader/)).toBeNull();
    });

    it("shows agent avatar in header", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      const avatarElements = screen.getAllByText("👑");
      expect(avatarElements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows agent name in title", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText(/Configure Leader/)).toBeDefined();
    });

    it("shows description text", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(
        screen.getByText("Edit agent properties and behavior settings.")
      ).toBeDefined();
    });

    it("renders the config form inside the panel", () => {
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByLabelText("Name")).toBeDefined();
      expect(screen.getByLabelText("Personality")).toBeDefined();
      expect(screen.getByLabelText("System Prompt")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Save action
  // --------------------------------------------------------------------------

  describe("save action", () => {
    it("calls onSave with agent ID and config", () => {
      const onSave = vi.fn();
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={onSave}
        />
      );

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith("leader", {
        name: mockAgent.name,
        personality: mockAgent.personality,
        systemPrompt: mockAgent.systemPrompt,
        model: "mimo-v2.5-pro",
        temperature: 0.7,
        avatar: mockAgent.avatar,
      });
    });

    it("passes different agent ID for explorer", () => {
      const onSave = vi.fn();
      render(
        <ConfigPanel
          agent={mockExplorerAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={onSave}
        />
      );

      const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith(
        "explorer",
        expect.objectContaining({ name: "Explorer" })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Close/Cancel action
  // --------------------------------------------------------------------------

  describe("close/cancel action", () => {
    it("calls onClose when cancel is clicked", () => {
      const onClose = vi.fn();
      render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={onClose}
          onSave={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Agent switching
  // --------------------------------------------------------------------------

  describe("agent switching", () => {
    it("updates form when agent changes", () => {
      const { rerender } = render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByLabelText("Name").getAttribute("value")).toBe(
        "Leader"
      );

      rerender(
        <ConfigPanel
          agent={mockExplorerAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByLabelText("Name").getAttribute("value")).toBe(
        "Explorer"
      );
    });

    it("shows different avatar for different agent", () => {
      const { rerender } = render(
        <ConfigPanel
          agent={mockAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText("Configure Leader")).toBeDefined();

      rerender(
        <ConfigPanel
          agent={mockExplorerAgent}
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText("Configure Explorer")).toBeDefined();
    });
  });
});
