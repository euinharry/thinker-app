/**
 * Agent Config Persistence
 *
 * Saves and loads agent configuration from the database using the
 * agent_configs key-value table. Falls back to default agent definitions
 * from personalities.ts when no persisted config exists.
 *
 * ## Storage Design
 *
 * The `agent_configs` table stores config as key-value pairs per agent:
 * - Each agent (identified by AgentType) maps to an Agent record (UUID)
 * - Config fields (name, personality, systemPrompt, model, temperature, avatar)
 *   are stored as separate rows with configKey/configValue
 *
 * ## Default Fallback
 *
 * When no persisted config exists for an agent, the default values from
 * `personalities.ts` are returned. This ensures the app always has valid
 * config for all agents.
 *
 * @module lib/agents/config
 */

import prisma from '@/lib/db';
import type { AgentType } from '@/types/agent';
import { getAgentByName } from '@/lib/agents/personalities';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Persisted agent configuration - matches FormConfig from config-form.tsx */
export interface PersistedAgentConfig {
  name: string;
  personality: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  avatar: string;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Maps AgentType to the Agent.name stored in the database */
const AGENT_NAME_MAP: Record<AgentType, string> = {
  leader: 'Leader',
  explorer: 'Explorer',
  thinker: 'Thinker',
  critic: 'Critic',
};

/** All config keys stored in agent_configs table */
const CONFIG_KEYS = [
  'name',
  'personality',
  'systemPrompt',
  'model',
  'temperature',
  'avatar',
] as const;

/** Default model for agents */
const DEFAULT_MODEL = 'mimo-v2.5-pro';

/** Default temperature for agents */
const DEFAULT_TEMPERATURE = 0.7;

// ──────────────────────────────────────────────
// CRUD Operations
// ──────────────────────────────────────────────

/**
 * Get persisted config for a specific agent.
 *
 * Returns the customized config from the database, falling back to
 * default values from personalities.ts for any missing fields.
 * Returns null if the agent doesn't exist in the database at all.
 *
 * @param agentType - The agent type to get config for
 * @returns The persisted config, or null if agent not in DB
 */
export async function getAgentConfig(
  agentType: AgentType,
): Promise<PersistedAgentConfig | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: AGENT_NAME_MAP[agentType] },
    include: { agentConfigs: true },
  });

  // Agent not in database at all
  if (!agent) return null;

  // No custom config entries - return null (caller should use defaults)
  if (agent.agentConfigs.length === 0) return null;

  // Build config from key-value pairs
  const kvPairs = new Map(
    agent.agentConfigs.map((c) => [c.configKey, c.configValue]),
  );

  // Get default agent for fallback values
  const defaultAgent = getAgentByName(agentType);

  return {
    name: kvPairs.get('name') ?? defaultAgent.name,
    personality: kvPairs.get('personality') ?? defaultAgent.personality,
    systemPrompt: kvPairs.get('systemPrompt') ?? defaultAgent.systemPrompt,
    model: kvPairs.get('model') ?? DEFAULT_MODEL,
    temperature: kvPairs.has('temperature')
      ? parseFloat(kvPairs.get('temperature')!)
      : DEFAULT_TEMPERATURE,
    avatar: kvPairs.get('avatar') ?? defaultAgent.avatar,
  };
}

/**
 * Get persisted configs for all agents.
 *
 * Returns a record mapping each AgentType to its config (or null if
 * no custom config exists for that agent).
 *
 * @returns Record of agent configs keyed by AgentType
 */
export async function getAllAgentConfigs(): Promise<
  Record<AgentType, PersistedAgentConfig | null>
> {
  const agentTypes: AgentType[] = ['leader', 'explorer', 'thinker', 'critic'];

  const results = await Promise.all(
    agentTypes.map(async (agentType) => ({
      agentType,
      config: await getAgentConfig(agentType),
    })),
  );

  return Object.fromEntries(
    results.map(({ agentType, config }) => [agentType, config]),
  ) as Record<AgentType, PersistedAgentConfig | null>;
}

/**
 * Save agent configuration to the database.
 *
 * Upserts config key-value pairs in the agent_configs table.
 * Creates the Agent record if it doesn't exist (required for FK constraint).
 *
 * @param agentType - The agent type to save config for
 * @param config - The configuration to persist
 * @throws {Error} If the agent cannot be created or config cannot be saved
 */
export async function saveAgentConfig(
  agentType: AgentType,
  config: PersistedAgentConfig,
): Promise<void> {
  // Ensure Agent record exists (needed for FK constraint)
  const agent = await prisma.agent.upsert({
    where: { name: AGENT_NAME_MAP[agentType] },
    update: {}, // Don't modify existing agent fields
    create: {
      name: AGENT_NAME_MAP[agentType],
      personality: config.personality,
      model: config.model,
      temperature: config.temperature,
    },
  });

  // Upsert each config key-value pair
  const entries: Array<{ key: string; value: string }> = [
    { key: 'name', value: config.name },
    { key: 'personality', value: config.personality },
    { key: 'systemPrompt', value: config.systemPrompt },
    { key: 'model', value: config.model },
    { key: 'temperature', value: String(config.temperature) },
    { key: 'avatar', value: config.avatar },
  ];

  await Promise.all(
    entries.map(({ key, value }) =>
      prisma.agentConfig.upsert({
        where: {
          agentId_configKey: { agentId: agent.id, configKey: key },
        },
        update: { configValue: value },
        create: {
          agentId: agent.id,
          configKey: key,
          configValue: value,
        },
      }),
    ),
  );
}

/**
 * Get the default config for an agent from personalities.ts.
 *
 * Used as fallback when no persisted config exists.
 *
 * @param agentType - The agent type to get defaults for
 * @returns Default config from personality definitions
 */
export function getDefaultAgentConfig(agentType: AgentType): PersistedAgentConfig {
  const agent = getAgentByName(agentType);
  return {
    name: agent.name,
    personality: agent.personality,
    systemPrompt: agent.systemPrompt,
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    avatar: agent.avatar,
  };
}

/**
 * Get agent config with automatic default fallback.
 *
 * Returns persisted config if available, otherwise returns defaults
 * from personalities.ts. Never returns null.
 *
 * @param agentType - The agent type to get config for
 * @returns Config (persisted or default)
 */
export async function getAgentConfigWithDefaults(
  agentType: AgentType,
): Promise<PersistedAgentConfig> {
  const persisted = await getAgentConfig(agentType);
  return persisted ?? getDefaultAgentConfig(agentType);
}
