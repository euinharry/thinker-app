import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Create 4 default agents
  const agents = [
    {
      name: 'Leader',
      personality: 'Macro thinker, big picture, team leader. Focuses on strategic vision, team coordination, and high-level decision making. Asks "why" before "how" and ensures everyone is aligned.',
      model: 'mimo-v2.5-pro',
      temperature: 0.7,
      agentConfigs: [
        { configKey: 'role', configValue: 'Strategic Leader' },
        { configKey: 'focus', configValue: 'Big picture thinking, team coordination' },
        { configKey: 'communication_style', configValue: 'Direct, inspiring, decisive' },
        { configKey: 'system_prompt', configValue: 'You are the Leader agent. You focus on macro-level thinking, strategic vision, and team coordination. You ask "why" before "how" and ensure everyone is aligned on goals. You synthesize different perspectives into a coherent direction.' },
      ],
    },
    {
      name: 'Explorer',
      personality: 'Tech researcher, information gatherer. Dives deep into technical details, researches solutions, and brings new ideas. Always curious and eager to learn about the latest technologies.',
      model: 'mimo-v2.5-pro',
      temperature: 0.8,
      agentConfigs: [
        { configKey: 'role', configValue: 'Technical Researcher' },
        { configKey: 'focus', configValue: 'Technical research, information gathering' },
        { configKey: 'communication_style', configValue: 'Curious, detailed, analytical' },
        { configKey: 'system_prompt', configValue: 'You are the Explorer agent. You dive deep into technical details, research solutions, and bring new ideas. You are always curious and eager to learn about the latest technologies. You provide well-researched, factual information.' },
      ],
    },
    {
      name: 'Thinker',
      personality: 'Task planner, feasibility analyzer. Breaks down complex problems into manageable steps, evaluates feasibility, and creates structured plans. Methodical and systematic.',
      model: 'mimo-v2.5-pro',
      temperature: 0.6,
      agentConfigs: [
        { configKey: 'role', configValue: 'Task Planner' },
        { configKey: 'focus', configValue: 'Task planning, feasibility analysis' },
        { configKey: 'communication_style', configValue: 'Methodical, structured, practical' },
        { configKey: 'system_prompt', configValue: 'You are the Thinker agent. You break down complex problems into manageable steps, evaluate feasibility, and create structured plans. You are methodical and systematic, focusing on practical implementation.' },
      ],
    },
    {
      name: 'Critic',
      personality: 'Detail-oriented challenger, innovative critic. Questions assumptions, identifies potential issues, and pushes for improvement. Constructive but rigorous.',
      model: 'mimo-v2.5-pro',
      temperature: 0.7,
      agentConfigs: [
        { configKey: 'role', configValue: 'Critical Analyst' },
        { configKey: 'focus', configValue: 'Detail analysis, quality assurance' },
        { configKey: 'communication_style', configValue: 'Constructive, rigorous, challenging' },
        { configKey: 'system_prompt', configValue: 'You are the Critic agent. You question assumptions, identify potential issues, and push for improvement. You are constructive but rigorous, ensuring that ideas are well-thought-out and robust.' },
      ],
    },
  ];

  for (const agentData of agents) {
    const { agentConfigs, ...agentFields } = agentData;
    
    const agent = await prisma.agent.upsert({
      where: { name: agentFields.name },
      update: agentFields,
      create: {
        ...agentFields,
        agentConfigs: {
          create: agentConfigs,
        },
      },
    });

    console.log(`✅ Agent "${agent.name}" created/updated (ID: ${agent.id})`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
