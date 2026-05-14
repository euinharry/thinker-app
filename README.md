# Thinker

> A collaborative AI discussion platform where multiple specialized agents work together to explore ideas, plan tasks, and challenge assumptions.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-7-purple)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Multi-Agent Collaboration** — Four specialized AI agents with unique personalities work together to provide comprehensive analysis
- **Real-Time Streaming** — Server-Sent Events (SSE) for instant, streaming responses
- **Agent Orchestration** — Intelligent coordination between agents for structured discussions
- **Persistent Configuration** — Customize agent behaviors and save preferences to database
- **Modern UI** — Beautiful, responsive interface built with shadcn/ui and Tailwind CSS
- **Dark/Light Theme** — Automatic theme switching with system preference detection
- **Markdown Rendering** — Full GFM support for rich text formatting in responses

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16.2.6 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| ORM | Prisma | 7.8.0 |
| Database | PostgreSQL | - |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | 4.7.0 |
| Testing | Vitest | 4.1.5 |

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/thinker.git
   cd thinker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your database connection:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/thinker"
   ```

4. **Setup database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   
   # Seed initial data (optional)
   npm run prisma:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
thinker/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Database seeder
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/
│   │   ├── agents/        # Agent-related components
│   │   ├── chat/          # Chat interface components
│   │   └── ui/            # Reusable UI components
│   ├── lib/
│   │   ├── agents/        # Agent system implementation
│   │   │   ├── personalities.ts    # Agent definitions
│   │   │   ├── config.ts          # Configuration persistence
│   │   │   ├── orchestrator.ts    # Multi-agent orchestration
│   │   │   └── streaming-*.ts     # SSE streaming
│   │   └── db.ts          # Database connection
│   ├── types/             # TypeScript type definitions
│   └── generated/         # Prisma generated client
├── public/                # Static assets
├── package.json
└── tsconfig.json
```

## Agent System

Thinker uses a multi-agent architecture where four specialized AI agents collaborate to provide comprehensive responses.

### Agents Overview

| Agent | Avatar | Role | Focus |
|-------|--------|------|-------|
| **Leader** | 👑 | Strategic Visionary | Big picture thinking, team coordination, decision facilitation |
| **Explorer** | 🔍 | Tech Researcher | Information gathering, technology trends, solution exploration |
| **Thinker** | 🧠 | Task Planner | Feasibility analysis, structured planning, timeline estimation |
| **Critic** | 🎯 | Quality Challenger | Risk identification, assumption challenging, edge case discovery |

### How It Works

1. **User sends a message** → The orchestrator receives the query
2. **Primary agent responds** → One agent takes the lead based on query type
3. **Supplement agents contribute** → Other agents provide additional perspectives
4. **Streaming responses** → Real-time SSE streaming to the frontend
5. **Unified display** → All responses displayed in a cohesive chat interface

### Agent Configuration

Agents can be customized through the database:

```typescript
import { saveAgentConfig } from "@/lib/agents/config";

await saveAgentConfig("leader", {
  name: "Custom Leader",
  personality: "Your custom personality...",
  systemPrompt: "Your custom system prompt...",
  model: "mimo-v2.5-pro",
  temperature: 0.7,
  avatar: "👑"
});
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:push` | Push schema changes |
| `npm run prisma:seed` | Seed database |
| `npm run prisma:studio` | Open Prisma Studio |

## Database Schema

### Core Models

- **Conversation** — Chat conversations with timestamps
- **Message** — Messages with threading support (replyTo)
- **Agent** — AI agent configurations
- **AgentConfig** — Key-value configuration storage

### Entity Relationship

```
Conversation 1──* Message
Message *──1 Agent (optional)
Message 1──* Message (replies)
Agent 1──* AgentConfig
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Use conventional commit messages
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [shadcn/ui](https://ui.shadcn.com/) - Re-usable components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
