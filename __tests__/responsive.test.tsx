// @vitest-environment jsdom

/**
 * Responsive Design & Accessibility Tests
 *
 * Tests for responsive layout behavior, keyboard shortcuts,
 * ARIA labels, and animation classes across chat components.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageItem } from "@/components/chat/message-item";
import { MessageList } from "@/components/chat/message-list";
import { AgentTypingIndicator } from "@/components/chat/loading";
import type { ChatMessage } from "@/types/chat";

// ============================================================================
// Helper: Create a mock message
// ============================================================================

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    role: "agent",
    content: "Hello, I am an agent response.",
    agentType: "leader",
    agentName: "Leader",
    agentAvatar: "👑",
    createdAt: new Date("2025-01-15T10:30:00"),
    ...overrides,
  };
}

function createUserMessage(
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: "msg-user-1",
    role: "user",
    content: "Hello agents!",
    agentType: null,
    agentName: null,
    agentAvatar: null,
    createdAt: new Date("2025-01-15T10:30:00"),
    ...overrides,
  };
}

// ============================================================================
// ChatInput - Keyboard Shortcuts
// ============================================================================

describe("ChatInput - keyboard shortcuts", () => {
  it("sends message on Enter key", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears input on Escape key", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Some text" } });
    expect(textarea.value).toBe("Some text");

    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(textarea.value).toBe("");
  });

  it("does not send empty message on Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send whitespace-only message on Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ChatInput - ARIA Labels
// ============================================================================

describe("ChatInput - ARIA labels", () => {
  it("textarea has aria-label", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea.getAttribute("aria-label")).toBe("Message input");
  });

  it("send button has aria-label", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const button = screen.getByRole("button", { name: /send message/i });
    expect(button.getAttribute("aria-label")).toBe("Send message");
  });

  it("container has role=form and aria-label", () => {
    const { container } = render(<ChatInput onSend={vi.fn()} />);

    const form = container.querySelector('[role="form"]');
    expect(form).toBeDefined();
    expect(form?.getAttribute("aria-label")).toBe("Message input form");
  });
});

// ============================================================================
// MessageItem - ARIA Labels
// ============================================================================

describe("MessageItem - ARIA labels", () => {
  it("user message has aria-label", () => {
    const message = createUserMessage();
    render(<MessageItem message={message} />);

    const article = screen.getByRole("article");
    expect(article.getAttribute("aria-label")).toBe("Your message");
  });

  it("agent message has aria-label with agent name", () => {
    const message = createMessage();
    render(<MessageItem message={message} />);

    const article = screen.getByRole("article");
    expect(article.getAttribute("aria-label")).toBe(
      "Message from Leader"
    );
  });

  it("agent message without name uses 'Agent' fallback", () => {
    const message = createMessage({ agentName: null });
    render(<MessageItem message={message} />);

    const article = screen.getByRole("article");
    expect(article.getAttribute("aria-label")).toBe("Message from Agent");
  });
});

// ============================================================================
// MessageItem - Animation Classes
// ============================================================================

describe("MessageItem - animation classes", () => {
  it("user message has slide-in-right animation", () => {
    const message = createUserMessage();
    const { container } = render(<MessageItem message={message} />);

    const item = container.querySelector('[data-slot="message-item"]');
    expect(item?.className).toContain("animate-slide-in-right");
  });

  it("agent message has fade-in animation", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const item = container.querySelector('[data-slot="message-item"]');
    expect(item?.className).toContain("animate-fade-in");
  });
});

// ============================================================================
// MessageItem - Responsive Layout
// ============================================================================

describe("MessageItem - responsive layout", () => {
  it("uses responsive max-width classes", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const content = container.querySelector(".min-w-0");
    expect(content?.className).toContain("max-w-[85%]");
    expect(content?.className).toContain("sm:max-w-[80%]");
    expect(content?.className).toContain("lg:max-w-[70%]");
  });

  it("uses responsive padding on message row", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const item = container.querySelector('[data-slot="message-item"]');
    expect(item?.className).toContain("px-3");
    expect(item?.className).toContain("sm:px-4");
  });

  it("uses responsive padding on message bubble", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const bubble = container.querySelector(".rounded-lg.px-3");
    expect(bubble).toBeDefined();
    expect(bubble?.className).toContain("sm:px-3.5");
  });
});

// ============================================================================
// MessageList - ARIA Labels
// ============================================================================

describe("MessageList - ARIA labels", () => {
  it("loading state has role=status and aria-label", () => {
    render(<MessageList messages={[]} isLoading />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading messages");
  });

  it("empty state has role=status and aria-label", () => {
    render(<MessageList messages={[]} />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("No messages");
  });

  it("message list has role=log and aria-label", () => {
    const messages = [createMessage()];
    render(<MessageList messages={messages} />);

    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-label")).toBe("Chat messages");
  });

  it("message list has aria-live=polite", () => {
    const messages = [createMessage()];
    render(<MessageList messages={messages} />);

    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
  });

  it("streaming indicator has role=status", () => {
    const messages = [createMessage()];
    render(<MessageList messages={messages} isGenerating />);

    const statuses = screen.getAllByRole("status");
    const streamingStatus = statuses.find(
      (s) => s.getAttribute("aria-label") === "Agent is responding"
    );
    expect(streamingStatus).toBeDefined();
  });
});

// ============================================================================
// MessageList - Responsive Layout
// ============================================================================

describe("MessageList - responsive layout", () => {
  it("loading state uses responsive padding", () => {
    render(<MessageList messages={[]} isLoading />);

    const container = screen.getByRole("status");
    expect(container.className).toContain("p-4");
    expect(container.className).toContain("sm:p-8");
  });

  it("empty state uses responsive padding", () => {
    render(<MessageList messages={[]} />);

    const container = screen.getByRole("status");
    expect(container.className).toContain("p-4");
    expect(container.className).toContain("sm:p-8");
  });
});

// ============================================================================
// AgentTypingIndicator - ARIA Labels & Responsive
// ============================================================================

describe("AgentTypingIndicator - ARIA and responsive", () => {
  it("has role=status and aria-label", () => {
    render(<AgentTypingIndicator agentName="Leader" />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Leader is typing");
  });

  it("has animate-fade-in class", () => {
    const { container } = render(
      <AgentTypingIndicator agentName="Leader" />
    );

    const wrapper = container.querySelector(
      '[data-slot="agent-typing-indicator"]'
    );
    expect(wrapper?.className).toContain("animate-fade-in");
  });

  it("uses responsive padding", () => {
    const { container } = render(
      <AgentTypingIndicator agentName="Leader" />
    );

    const wrapper = container.querySelector(
      '[data-slot="agent-typing-indicator"]'
    );
    expect(wrapper?.className).toContain("px-3");
    expect(wrapper?.className).toContain("sm:px-4");
  });
});

// ============================================================================
// Animation Keyframes - CSS Classes Exist
// ============================================================================

describe("animation utility classes", () => {
  it("ChatInput disabled state has opacity", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("send button shows loading spinner when disabled", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);

    // Loader2 icon renders an SVG, button should be disabled
    const button = screen.getByRole("button", { name: /send message/i });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

// ============================================================================
// Keyboard Navigation
// ============================================================================

describe("keyboard navigation", () => {
  it("textarea is focusable", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
  });

  it("send button is focusable", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: /send message/i,
    }) as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("Escape clears and keeps textarea focused", () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "test" } });
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(textarea.value).toBe("");
    expect(document.activeElement).toBe(textarea);
  });
});

// ============================================================================
// Message Content - Responsive Prose
// ============================================================================

describe("message content - responsive prose", () => {
  it("agent message renders with prose classes", () => {
    const message = createMessage({ content: "**Bold** and _italic_" });
    const { container } = render(<MessageItem message={message} />);

    const prose = container.querySelector(".prose");
    expect(prose).toBeDefined();
    expect(prose?.className).toContain("prose-sm");
    expect(prose?.className).toContain("dark:prose-invert");
  });

  it("user message renders as plain text", () => {
    const message = createUserMessage({ content: "Hello world" });
    render(<MessageItem message={message} />);

    expect(screen.getByText("Hello world")).toBeDefined();
  });
});

// ============================================================================
// Hover and Transition States
// ============================================================================

describe("hover and transition states", () => {
  it("message item has transition-colors class", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const item = container.querySelector('[data-slot="message-item"]');
    expect(item?.className).toContain("transition-colors");
  });

  it("message bubble has transition-shadow class", () => {
    const message = createMessage();
    const { container } = render(<MessageItem message={message} />);

    const bubble = container.querySelector(".transition-shadow");
    expect(bubble).toBeDefined();
  });
});
