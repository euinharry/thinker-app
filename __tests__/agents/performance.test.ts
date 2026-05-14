/**
 * Performance Tests for Streaming Orchestrator
 *
 * Measures latency of critical-path operations to ensure:
 * - Primary agent starts streaming within 100ms (orchestrator overhead)
 * - Supplement decision completes within 50ms
 * - No performance regression from baseline
 *
 * All modules use keyword-based heuristics (no AI calls), so these
 * operations should be sub-millisecond. The 100ms/50ms thresholds
 * are generous upper bounds to catch regressions.
 *
 * @module __tests__/agents/performance
 */

import { describe, it, expect } from "vitest";
import { analyzeMessage } from "@/lib/agents/message-analyzer";
import { decideSupplements } from "@/lib/agents/supplement-decider";
import { sortSupplements } from "@/lib/agents/relevance-sorter";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Measure execution time of a synchronous function in milliseconds.
 * Uses performance.now() for sub-millisecond precision.
 */
function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/**
 * Measure average execution time over N iterations.
 * Warmup is handled separately to avoid measuring JIT compilation.
 */
function measureAvgMs(fn: () => void, iterations: number): number {
  // Warmup: run a few iterations to stabilize JIT
  for (let i = 0; i < Math.min(10, iterations); i++) {
    fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  return (performance.now() - start) / iterations;
}

// ============================================================================
// Test Data
// ============================================================================

const SHORT_MESSAGE = "What technology should we use?";
const MEDIUM_MESSAGE =
  "What is our strategy for the API framework and database architecture? We need to plan the timeline and assess risks.";
const LONG_MESSAGE =
  "We need to evaluate our technology stack including React, Node.js, TypeScript, and PostgreSQL. " +
  "Consider the architecture for microservices, deployment pipeline with Docker and Kubernetes, " +
  "and CI/CD infrastructure. What are the performance benchmarks for our API latency and throughput? " +
  "We should also review the scalability concerns, caching strategy with Redis CDN, and database optimization.";

const SAMPLE_PRIMARY_RESPONSE =
  "Based on our analysis, we recommend using React with TypeScript for the frontend. " +
  "The API layer should use Node.js with Express, and we'll deploy to AWS using Docker containers. " +
  "For the database, PostgreSQL provides the best balance of performance and scalability.";

const ALL_AGENTS: AgentType[] = ["leader", "explorer", "thinker", "critic"];

// ============================================================================
// analyzeMessage Performance
// ============================================================================

describe("Performance: analyzeMessage", () => {
  it("completes within 10ms for a short message", () => {
    const elapsed = measureMs(() => analyzeMessage(SHORT_MESSAGE));
    expect(elapsed).toBeLessThan(10);
  });

  it("completes within 10ms for a long message", () => {
    const elapsed = measureMs(() => analyzeMessage(LONG_MESSAGE));
    expect(elapsed).toBeLessThan(10);
  });

  it("average latency is sub-millisecond over 1000 iterations", () => {
    const avgMs = measureAvgMs(() => analyzeMessage(MEDIUM_MESSAGE), 1000);
    expect(avgMs).toBeLessThan(1); // sub-millisecond average
  });

  it("handles repeated calls without degradation (no memory leak)", () => {
    // Run 5000 iterations and check the last 100 are not slower than first 100
    const firstBatch: number[] = [];
    const lastBatch: number[] = [];

    for (let i = 0; i < 5000; i++) {
      const elapsed = measureMs(() => analyzeMessage(MEDIUM_MESSAGE));
      if (i < 100) firstBatch.push(elapsed);
      if (i >= 4900) lastBatch.push(elapsed);
    }

    const firstAvg = firstBatch.reduce((a, b) => a + b, 0) / firstBatch.length;
    const lastAvg = lastBatch.reduce((a, b) => a + b, 0) / lastBatch.length;

    // Last batch should not be more than 10x slower than first
    // (generous threshold to account for system variance)
    expect(lastAvg).toBeLessThan(firstAvg * 10 + 0.5);
  });
});

// ============================================================================
// decideSupplements Performance
// ============================================================================

describe("Performance: decideSupplements", () => {
  it("completes within 50ms for a short response", () => {
    const elapsed = measureMs(() =>
      decideSupplements("leader", SAMPLE_PRIMARY_RESPONSE, ALL_AGENTS)
    );
    expect(elapsed).toBeLessThan(50);
  });

  it("completes within 50ms for a long response", () => {
    const longResponse = LONG_MESSAGE.repeat(10); // ~5KB response
    const elapsed = measureMs(() =>
      decideSupplements("leader", longResponse, ALL_AGENTS)
    );
    expect(elapsed).toBeLessThan(50);
  });

  it("average latency is sub-millisecond over 1000 iterations", () => {
    const avgMs = measureAvgMs(
      () => decideSupplements("leader", SAMPLE_PRIMARY_RESPONSE, ALL_AGENTS),
      1000
    );
    expect(avgMs).toBeLessThan(1); // sub-millisecond average
  });
});

// ============================================================================
// sortSupplements Performance
// ============================================================================

describe("Performance: sortSupplements", () => {
  const sampleSupplements = [
    {
      agentType: "explorer" as AgentType,
      reason: "Technical implementation details covered",
      content: "The framework uses React and TypeScript for frontend development.",
    },
    {
      agentType: "thinker" as AgentType,
      reason: "Planning and timeline aspects missing",
      content: "We need to plan the implementation steps and timeline.",
    },
    {
      agentType: "critic" as AgentType,
      reason: "Risk assessment not addressed",
      content: "Consider security vulnerabilities and edge cases.",
    },
  ];

  it("completes within 10ms for typical inputs", () => {
    const elapsed = measureMs(() =>
      sortSupplements(SAMPLE_PRIMARY_RESPONSE, sampleSupplements)
    );
    expect(elapsed).toBeLessThan(10);
  });

  it("completes within 50ms for large inputs", () => {
    // Generate 20 supplements with long content
    const manySupplements = Array.from({ length: 20 }, (_, i) => ({
      agentType: (["explorer", "thinker", "critic"] as AgentType[])[i % 3],
      reason: `Supplement ${i}: ${LONG_MESSAGE}`,
      content: LONG_MESSAGE.repeat(3),
    }));

    const elapsed = measureMs(() =>
      sortSupplements(SAMPLE_PRIMARY_RESPONSE, manySupplements)
    );
    expect(elapsed).toBeLessThan(50);
  });

  it("average latency is sub-millisecond over 1000 iterations", () => {
    const avgMs = measureAvgMs(
      () => sortSupplements(SAMPLE_PRIMARY_RESPONSE, sampleSupplements),
      1000
    );
    expect(avgMs).toBeLessThan(1); // sub-millisecond average
  });
});

// ============================================================================
// Streaming Orchestrator Overhead (Primary Start Latency)
// ============================================================================

describe("Performance: orchestrator primary agent startup", () => {
  it("analyzeMessage + agent selection completes within 100ms", () => {
    // This measures the critical path before streaming begins:
    // analyzeMessage() → createAgent() → getAgentInfo()
    // The actual streamChat() call is external (LLM API), so we don't
    // include it. This test verifies the orchestrator's own overhead.
    const elapsed = measureMs(() => {
      const analysis = analyzeMessage(MEDIUM_MESSAGE);
      // Simulate agent creation overhead (just the analysis part)
      expect(analysis.primaryAgent).toBeDefined();
    });
    expect(elapsed).toBeLessThan(100);
  });

  it("full pre-stream pipeline completes within 100ms", () => {
    // Measure the complete pipeline before streaming starts:
    // analyzeMessage → decideSupplements → sortSupplements
    const elapsed = measureMs(() => {
      const analysis = analyzeMessage(MEDIUM_MESSAGE);
      const decisions = decideSupplements(
        analysis.primaryAgent,
        SAMPLE_PRIMARY_RESPONSE,
        ALL_AGENTS
      );
      const supplements = decisions
        .filter((d) => d.shouldSupplement)
        .map((d) => ({
          agentType: d.agent,
          reason: d.reason,
          content: SAMPLE_PRIMARY_RESPONSE,
        }));
      sortSupplements(SAMPLE_PRIMARY_RESPONSE, supplements);
    });
    expect(elapsed).toBeLessThan(100);
  });
});

// ============================================================================
// Baseline Regression Check
// ============================================================================

describe("Performance: baseline regression", () => {
  it("analyzeMessage handles worst-case input within bounds", () => {
    // Worst case: message with many keywords from all agents
    const worstCase =
      "strategy roadmap vision goal prioritize coordinate decision " +
      "technology framework API library tool research solution compare " +
      "task schedule feasibility timeline estimate plan implement step " +
      "risk issue problem weakness flaw concern edge case failure bug";

    const elapsed = measureMs(() => analyzeMessage(worstCase));
    expect(elapsed).toBeLessThan(10); // Should still be sub-10ms
  });

  it("decideSupplements handles worst-case input within bounds", () => {
    // Worst case: response with no domain keywords (triggers full scan)
    const worstCase = "a b c d e f g h i j k l m n o p q r s t u v w x y z";

    const elapsed = measureMs(() =>
      decideSupplements("leader", worstCase, ALL_AGENTS)
    );
    expect(elapsed).toBeLessThan(50);
  });

  it("sortSupplements handles empty supplements gracefully", () => {
    const elapsed = measureMs(() =>
      sortSupplements(SAMPLE_PRIMARY_RESPONSE, [])
    );
    expect(elapsed).toBeLessThan(1);
  });

  it("sortSupplements handles empty primary response gracefully", () => {
    const supplements = [
      {
        agentType: "explorer" as AgentType,
        reason: "test",
        content: "test",
      },
    ];
    const elapsed = measureMs(() => sortSupplements("", supplements));
    expect(elapsed).toBeLessThan(1);
  });
});
