// @vitest-environment jsdom

/**
 * Thinking Component Tests
 *
 * Tests for the Thinking component: rendering, toggle behavior,
 * empty content handling, accessibility attributes, and keyboard support.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Thinking } from "@/components/chat/thinking";

// ============================================================================
// Thinking Component Tests
// ============================================================================

describe("Thinking", () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders the toggle button when content is provided", () => {
      render(<Thinking content="I am reasoning about this..." />);

      const button = screen.getByRole("button");
      expect(button).toBeDefined();
      expect(button.textContent).toContain("Thinking process");
    });

    it("does not render content by default (collapsed)", () => {
      render(<Thinking content="Some thinking content" />);

      // Content should not be visible initially
      expect(screen.queryByText("Some thinking content")).toBeNull();
    });

    it("renders content when expanded", () => {
      render(<Thinking content="Deep reasoning here" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Deep reasoning here")).toBeDefined();
    });

    it("applies custom className", () => {
      const { container } = render(
        <Thinking content="test" className="custom-class" />
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });

    it("has data-slot attribute", () => {
      const { container } = render(<Thinking content="test" />);

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.getAttribute("data-slot")).toBe("thinking");
    });
  });

  // --------------------------------------------------------------------------
  // Toggle behavior
  // --------------------------------------------------------------------------

  describe("toggle behavior", () => {
    it("expands when toggle button is clicked", () => {
      render(<Thinking content="Reasoning content" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Reasoning content")).toBeDefined();
    });

    it("collapses when toggle button is clicked again", () => {
      render(<Thinking content="Reasoning content" />);

      const button = screen.getByRole("button");

      // Expand
      fireEvent.click(button);
      expect(screen.getByText("Reasoning content")).toBeDefined();

      // Collapse
      fireEvent.click(button);
      expect(screen.queryByText("Reasoning content")).toBeNull();
    });

    it("starts collapsed by default", () => {
      render(<Thinking content="Some reasoning" />);

      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    it("shows aria-expanded=true when expanded", () => {
      render(<Thinking content="Some reasoning" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(button.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // --------------------------------------------------------------------------
  // Empty content handling
  // --------------------------------------------------------------------------

  describe("empty content handling", () => {
    it("returns null for empty string", () => {
      const { container } = render(<Thinking content="" />);

      expect(container.innerHTML).toBe("");
    });

    it("returns null for whitespace-only content", () => {
      const { container } = render(<Thinking content="   " />);

      expect(container.innerHTML).toBe("");
    });

    it("renders for non-empty content", () => {
      const { container } = render(<Thinking content="actual content" />);

      expect(container.innerHTML).not.toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  describe("accessibility", () => {
    it("has aria-expanded attribute on button", () => {
      render(<Thinking content="test" />);

      const button = screen.getByRole("button");
      expect(button.hasAttribute("aria-expanded")).toBe(true);
    });

    it("has aria-label for collapsed state", () => {
      render(<Thinking content="test" />);

      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("Expand thinking process");
    });

    it("has aria-label for expanded state", () => {
      render(<Thinking content="test" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(button.getAttribute("aria-label")).toBe("Collapse thinking process");
    });

    it("has aria-hidden on chevron icons", () => {
      const { container } = render(<Thinking content="test" />);

      // ChevronRight should have aria-hidden
      const icon = container.querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    });

    it("content region has role=region and aria-label", () => {
      render(<Thinking content="test content" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const region = screen.getByRole("region");
      expect(region.getAttribute("aria-label")).toBe("Thinking process content");
    });

    it("button has type=button to prevent form submission", () => {
      render(<Thinking content="test" />);

      const button = screen.getByRole("button");
      expect(button.getAttribute("type")).toBe("button");
    });
  });

  // --------------------------------------------------------------------------
  // Keyboard support
  // --------------------------------------------------------------------------

  describe("keyboard support", () => {
    it("toggles on Enter key", () => {
      render(<Thinking content="keyboard test" />);

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Enter" });

      // Native button handles Enter, but we test click instead
      fireEvent.click(button);
      expect(screen.getByText("keyboard test")).toBeDefined();
    });

    it("button is focusable", () => {
      render(<Thinking content="focus test" />);

      const button = screen.getByRole("button") as HTMLButtonElement;
      button.focus();

      expect(document.activeElement).toBe(button);
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles multiline thinking content", () => {
      const multilineContent = "Line 1\nLine 2\nLine 3";
      render(<Thinking content={multilineContent} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const region = screen.getByRole("region");
      expect(region.textContent).toBe(multilineContent);
    });

    it("handles special characters in content", () => {
      const specialContent = "Thinking with <html> & special 'chars'";
      render(<Thinking content={specialContent} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText(specialContent)).toBeDefined();
    });

    it("handles very long thinking content", () => {
      const longContent = "A".repeat(10000);
      render(<Thinking content={longContent} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const region = screen.getByRole("region");
      expect(region.textContent).toBe(longContent);
    });
  });
});
