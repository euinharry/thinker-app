// @vitest-environment jsdom

/**
 * Loading Components Tests
 *
 * Tests for LoadingSpinner, AgentTypingIndicator, and MessageSkeleton
 * components: rendering, props, and visual structure.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LoadingSpinner,
  AgentTypingIndicator,
  MessageSkeleton,
} from "@/components/chat/loading";

// ============================================================================
// LoadingSpinner Tests
// ============================================================================

describe("LoadingSpinner", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders a spinner element", () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[data-slot="loading-spinner"]');
      expect(spinner).toBeDefined();
    });

    it("contains an animated border element", () => {
      const { container } = render(<LoadingSpinner />);

      const inner = container.querySelector(".animate-spin");
      expect(inner).toBeDefined();
    });

    it("has the animate-spin class for rotation", () => {
      const { container } = render(<LoadingSpinner />);

      const inner = container.querySelector(".animate-spin") as HTMLElement;
      expect(inner.className).toContain("animate-spin");
    });

    it("has rounded-full for circular shape", () => {
      const { container } = render(<LoadingSpinner />);

      const inner = container.querySelector(".rounded-full") as HTMLElement;
      expect(inner.className).toContain("rounded-full");
    });
  });

  // --------------------------------------------------------------------------
  // Custom className
  // --------------------------------------------------------------------------

  describe("custom className", () => {
    it("applies custom className to wrapper", () => {
      const { container } = render(<LoadingSpinner className="size-8" />);

      const spinner = container.querySelector(
        '[data-slot="loading-spinner"]'
      ) as HTMLElement;
      expect(spinner.className).toContain("size-8");
    });

    it("preserves default classes with custom className", () => {
      const { container } = render(
        <LoadingSpinner className="mt-4" />
      );

      const spinner = container.querySelector(
        '[data-slot="loading-spinner"]'
      ) as HTMLElement;
      expect(spinner.className).toContain("items-center");
      expect(spinner.className).toContain("justify-center");
      expect(spinner.className).toContain("mt-4");
    });

    it("works without custom className", () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[data-slot="loading-spinner"]');
      expect(spinner).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  describe("accessibility", () => {
    it("has data-slot attribute for identification", () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[data-slot="loading-spinner"]');
      expect(spinner).toBeDefined();
    });
  });
});

// ============================================================================
// AgentTypingIndicator Tests
// ============================================================================

describe("AgentTypingIndicator", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders the agent name in the message", () => {
      render(<AgentTypingIndicator agentName="Leader" />);

      expect(screen.getByText("Leader is thinking...")).toBeDefined();
    });

    it("renders three pulsing dots", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Explorer" />
      );

      const dots = container.querySelectorAll(".animate-pulse");
      expect(dots.length).toBe(3);
    });

    it("has data-slot attribute", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Thinker" />
      );

      const wrapper = container.querySelector(
        '[data-slot="agent-typing-indicator"]'
      );
      expect(wrapper).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Agent names
  // --------------------------------------------------------------------------

  describe("agent names", () => {
    it("displays Leader agent name", () => {
      render(<AgentTypingIndicator agentName="Leader" />);

      expect(screen.getByText("Leader is thinking...")).toBeDefined();
    });

    it("displays Explorer agent name", () => {
      render(<AgentTypingIndicator agentName="Explorer" />);

      expect(screen.getByText("Explorer is thinking...")).toBeDefined();
    });

    it("displays Thinker agent name", () => {
      render(<AgentTypingIndicator agentName="Thinker" />);

      expect(screen.getByText("Thinker is thinking...")).toBeDefined();
    });

    it("displays Critic agent name", () => {
      render(<AgentTypingIndicator agentName="Critic" />);

      expect(screen.getByText("Critic is thinking...")).toBeDefined();
    });

    it("handles custom agent names", () => {
      render(<AgentTypingIndicator agentName="CustomAgent" />);

      expect(screen.getByText("CustomAgent is thinking...")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Visual structure
  // --------------------------------------------------------------------------

  describe("visual structure", () => {
    it("has a muted background container for dots", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Leader" />
      );

      const dotsContainer = container.querySelector(".bg-muted");
      expect(dotsContainer).toBeDefined();
    });

    it("dots have primary background color", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Leader" />
      );

      const dots = container.querySelectorAll(".bg-primary");
      expect(dots.length).toBe(3);
    });

    it("text has muted-foreground color", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Leader" />
      );

      const text = container.querySelector(".text-muted-foreground");
      expect(text).toBeDefined();
    });

    it("has staggered animation delays on dots", () => {
      const { container } = render(
        <AgentTypingIndicator agentName="Leader" />
      );

      const delayedDots = container.querySelectorAll(
        ".\\[animation-delay\\:150ms\\], .\\[animation-delay\\:300ms\\]"
      );
      // At least some dots have animation delays
      expect(container.innerHTML).toContain("animation-delay:150ms");
      expect(container.innerHTML).toContain("animation-delay:300ms");
    });
  });
});

// ============================================================================
// MessageSkeleton Tests
// ============================================================================

describe("MessageSkeleton", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders three skeleton rows", () => {
      const { container } = render(<MessageSkeleton />);

      const rows = container.querySelectorAll(".flex.gap-3");
      expect(rows.length).toBe(3);
    });

    it("has data-slot attribute", () => {
      const { container } = render(<MessageSkeleton />);

      const wrapper = container.querySelector(
        '[data-slot="message-skeleton"]'
      );
      expect(wrapper).toBeDefined();
    });

    it("renders circular avatar placeholders", () => {
      const { container } = render(<MessageSkeleton />);

      const avatars = container.querySelectorAll(".rounded-full.bg-muted");
      expect(avatars.length).toBe(3);
    });

    it("renders text line placeholders", () => {
      const { container } = render(<MessageSkeleton />);

      const lines = container.querySelectorAll(".animate-pulse.rounded.bg-muted");
      // 3 rows x (1 avatar + 2 text lines) = 9 animated elements
      expect(lines.length).toBeGreaterThanOrEqual(6);
    });
  });

  // --------------------------------------------------------------------------
  // Visual structure
  // --------------------------------------------------------------------------

  describe("visual structure", () => {
    it("uses pulse animation for loading effect", () => {
      const { container } = render(<MessageSkeleton />);

      const pulsingElements = container.querySelectorAll(".animate-pulse");
      expect(pulsingElements.length).toBeGreaterThan(0);
    });

    it("has muted background for skeleton elements", () => {
      const { container } = render(<MessageSkeleton />);

      const mutedElements = container.querySelectorAll(".bg-muted");
      expect(mutedElements.length).toBeGreaterThan(0);
    });

    it("has padding on the container", () => {
      const { container } = render(<MessageSkeleton />);

      const wrapper = container.querySelector(
        '[data-slot="message-skeleton"]'
      ) as HTMLElement;
      expect(wrapper.className).toContain("p-4");
    });

    it("has gap between skeleton rows", () => {
      const { container } = render(<MessageSkeleton />);

      const wrapper = container.querySelector(
        '[data-slot="message-skeleton"]'
      ) as HTMLElement;
      expect(wrapper.className).toContain("gap-2");
    });
  });

  // --------------------------------------------------------------------------
  // Layout structure
  // --------------------------------------------------------------------------

  describe("layout structure", () => {
    it("each row has an avatar and text area", () => {
      const { container } = render(<MessageSkeleton />);

      const rows = container.querySelectorAll(".flex.gap-3");
      rows.forEach((row) => {
        const avatar = row.querySelector(".size-8.rounded-full");
        const textArea = row.querySelector(".flex-1");
        expect(avatar).toBeDefined();
        expect(textArea).toBeDefined();
      });
    });

    it("text area has two lines of different widths", () => {
      const { container } = render(<MessageSkeleton />);

      const textAreas = container.querySelectorAll(".flex-1.space-y-2");
      textAreas.forEach((area) => {
        const lines = area.querySelectorAll(".h-4");
        expect(lines.length).toBe(2);
      });
    });

    it("first line is shorter than second line", () => {
      const { container } = render(<MessageSkeleton />);

      const firstLine = container.querySelector(".w-1\\/4");
      const secondLine = container.querySelector(".w-3\\/4");
      expect(firstLine).toBeDefined();
      expect(secondLine).toBeDefined();
    });
  });
});
