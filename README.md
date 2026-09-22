# TaskMaster

A task and project management web application focused on offline-first UX, drag-and-drop workflows, analytics, and feature-oriented React architecture.

## Preview

[Live demo](https://taskmaster-portfolio.netlify.app)

![Project preview](https://d33wubrfki0l68.cloudfront.net/6817ba12128f2b6a86a22b2a/screenshot_2025-05-04-19-03-50-0000.webp)

## Highlights

- Project and task management
- Drag-and-drop task boards
- Analytics and data visualization
- Offline-first storage with IndexedDB
- Authentication and user settings
- Dark/light themes
- Web Push notifications
- Automated tests and code-quality tooling

## Tech stack

- React 19 + TypeScript
- Redux Toolkit + React Router 7
- Tailwind CSS
- React DnD + Framer Motion
- Recharts
- Dexie / IndexedDB
- Vite
- Vitest + React Testing Library
- ESLint + Prettier + Husky

## Getting started

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Run tests with coverage:

```bash
npm test
```

Lint:

```bash
npm run lint
```

## Architecture

The application is organized around business features rather than a flat collection of technical layers. Feature modules own their state and domain logic, while shared UI, hooks, services, storage, and application infrastructure remain separated.

The main application areas include:

- `features/` — domain state and feature-specific logic
- `components/` — reusable UI components
- `hooks/` — reusable React hooks
- `services/` — browser, API, notification, and persistence integrations
- `store/` — Redux store configuration and typed hooks
- `pages/` and `layouts/` — route-level composition
- `types/` and `utils/` — shared types and utilities

## Status

Portfolio project / work in progress.

## License

MIT
