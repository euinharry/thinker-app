/**
 * @Mention Parser Tests
 *
 * Tests for the parseMentions() function: single mentions, multiple mentions,
 * case-insensitive matching, invalid agent names, deduplication, and
 * message cleaning.
 */

import { describe, it, expect } from "vitest";
import { parseMentions } from "@/lib/chat/mentions";

// ============================================================================
// parseMentions Tests
// ============================================================================

describe("parseMentions", () => {
  // --------------------------------------------------------------------------
  // Single @mention
  // --------------------------------------------------------------------------

  describe("single @mention", () => {
    it("parses @Leader at start of message", () => {
      const result = parseMentions("@Leader tell me about strategy");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("tell me about strategy");
    });

    it("parses @Explorer at start of message", () => {
      const result = parseMentions("@Explorer find some solutions");

      expect(result.mentionedAgents).toEqual(["explorer"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("find some solutions");
    });

    it("parses @Thinker at start of message", () => {
      const result = parseMentions("@Thinker create a plan");

      expect(result.mentionedAgents).toEqual(["thinker"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("create a plan");
    });

    it("parses @Critic at start of message", () => {
      const result = parseMentions("@Critic review this approach");

      expect(result.mentionedAgents).toEqual(["critic"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("review this approach");
    });

    it("parses @mention in middle of message", () => {
      const result = parseMentions("Hey @Leader what do you think?");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("Hey what do you think?");
    });

    it("parses @mention at end of message", () => {
      const result = parseMentions("What do you think @Critic");

      expect(result.mentionedAgents).toEqual(["critic"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("What do you think");
    });
  });

  // --------------------------------------------------------------------------
  // Multiple @mentions
  // --------------------------------------------------------------------------

  describe("multiple @mentions", () => {
    it("parses two @mentions", () => {
      const result = parseMentions("@Leader @Critic discuss this plan");

      expect(result.mentionedAgents).toEqual(["leader", "critic"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("discuss this plan");
    });

    it("parses three @mentions", () => {
      const result = parseMentions(
        "@Leader @Explorer @Thinker analyze this"
      );

      expect(result.mentionedAgents).toEqual(["leader", "explorer", "thinker"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("analyze this");
    });

    it("parses all four @mentions", () => {
      const result = parseMentions(
        "@Leader @Explorer @Thinker @Critic full team discussion"
      );

      expect(result.mentionedAgents).toEqual([
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("full team discussion");
    });

    it("parses @mentions with text between them", () => {
      const result = parseMentions(
        "@Leader and @Critic please discuss the risks"
      );

      expect(result.mentionedAgents).toEqual(["leader", "critic"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("and please discuss the risks");
    });
  });

  // --------------------------------------------------------------------------
  // Case-insensitive matching
  // --------------------------------------------------------------------------

  describe("case-insensitive matching", () => {
    it("matches lowercase @leader", () => {
      const result = parseMentions("@leader what's the plan?");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
    });

    it("matches UPPERCASE @LEADER", () => {
      const result = parseMentions("@LEADER what's the plan?");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
    });

    it("matches MiXeD CaSe @LeAdEr", () => {
      const result = parseMentions("@LeAdEr what's the plan?");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
    });

    it("matches @EXPLORER in uppercase", () => {
      const result = parseMentions("@EXPLORER find alternatives");

      expect(result.mentionedAgents).toEqual(["explorer"]);
      expect(result.hasMentions).toBe(true);
    });

    it("matches @CRITIC in uppercase", () => {
      const result = parseMentions("@CRITIC review this");

      expect(result.mentionedAgents).toEqual(["critic"]);
      expect(result.hasMentions).toBe(true);
    });

    it("matches mixed case @Thinker", () => {
      const result = parseMentions("@THINKER plan this out");

      expect(result.mentionedAgents).toEqual(["thinker"]);
      expect(result.hasMentions).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // No @mentions
  // --------------------------------------------------------------------------

  describe("no @mentions", () => {
    it("returns empty array for plain message", () => {
      const result = parseMentions("What should we do?");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("What should we do?");
    });

    it("returns empty array for empty string", () => {
      const result = parseMentions("");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("");
    });

    it("returns empty array for whitespace-only message", () => {
      const result = parseMentions("   ");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("");
    });

    it("does not treat email-like patterns as mentions", () => {
      const result = parseMentions("Send to user@example.com");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("Send to user@example.com");
    });
  });

  // --------------------------------------------------------------------------
  // Invalid @mentions
  // --------------------------------------------------------------------------

  describe("invalid @mentions", () => {
    it("ignores @unknown agent name", () => {
      const result = parseMentions("@unknown tell me something");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      // Invalid mentions are kept in the cleaned message
      expect(result.cleanedMessage).toBe("@unknown tell me something");
    });

    it("ignores @randomname", () => {
      const result = parseMentions("@randomname hello");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("@randomname hello");
    });

    it("filters valid mentions and ignores invalid ones", () => {
      const result = parseMentions("@Leader @unknown @Critic discuss");

      expect(result.mentionedAgents).toEqual(["leader", "critic"]);
      expect(result.hasMentions).toBe(true);
      // Invalid @unknown is kept, valid mentions removed
      expect(result.cleanedMessage).toBe("@unknown discuss");
    });

    it("ignores @mention-like patterns in URLs", () => {
      const result = parseMentions("Check https://example.com/@user");

      // @user is not a valid agent type
      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Deduplication
  // --------------------------------------------------------------------------

  describe("deduplication", () => {
    it("deduplicates repeated @Leader mentions", () => {
      const result = parseMentions("@Leader @Leader tell me something");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
    });

    it("deduplicates @leader and @LEADER (case-insensitive)", () => {
      const result = parseMentions("@leader @LEADER both are the same");

      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
    });

    it("deduplicates mixed valid and duplicate mentions", () => {
      const result = parseMentions(
        "@Leader @Critic @Leader @Critic discuss"
      );

      expect(result.mentionedAgents).toEqual(["leader", "critic"]);
      expect(result.hasMentions).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Message cleaning
  // --------------------------------------------------------------------------

  describe("message cleaning", () => {
    it("removes @mention and collapses spaces", () => {
      const result = parseMentions("@Leader   tell me   something");

      expect(result.cleanedMessage).toBe("tell me something");
    });

    it("preserves non-mention @ symbols", () => {
      const result = parseMentions("@Leader check @unknown please");

      expect(result.cleanedMessage).toBe("check @unknown please");
    });

    it("handles message with only @mentions", () => {
      const result = parseMentions("@Leader @Critic");

      expect(result.cleanedMessage).toBe("");
      expect(result.mentionedAgents).toEqual(["leader", "critic"]);
    });

    it("trims leading and trailing whitespace", () => {
      const result = parseMentions("  @Leader  hello  ");

      expect(result.cleanedMessage).toBe("hello");
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles @mention with numbers after name", () => {
      const result = parseMentions("@Leader123 is this valid?");

      // "leader123" is not a valid agent type
      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
    });

    it("handles @mention with underscore in name", () => {
      const result = parseMentions("@leader_agent hello");

      // "leader_agent" is not a valid agent type
      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
    });

    it("handles multiple @mentions with mixed validity", () => {
      const result = parseMentions(
        "@Leader @bot @Explorer @admin @Critic team meeting"
      );

      expect(result.mentionedAgents).toEqual(["leader", "explorer", "critic"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("@bot @admin team meeting");
    });

    it("handles message with special characters after mention", () => {
      const result = parseMentions("@Leader! What about this?");

      // @Leader! extracts "leader" because \w+ matches word chars and stops at "!"
      expect(result.mentionedAgents).toEqual(["leader"]);
      expect(result.hasMentions).toBe(true);
      expect(result.cleanedMessage).toBe("! What about this?");
    });

    it("handles @ at end of message without word", () => {
      const result = parseMentions("Hello @");

      expect(result.mentionedAgents).toEqual([]);
      expect(result.hasMentions).toBe(false);
      expect(result.cleanedMessage).toBe("Hello @");
    });
  });
});
