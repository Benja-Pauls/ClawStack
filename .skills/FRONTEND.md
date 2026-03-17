---
skill: frontend
version: 1
---

# Frontend Guide (React + Vite + TypeScript)

## Entry Point

`frontend/src/main.tsx` renders `App.tsx`, which contains the React Router configuration.

## Adding a New Page

1. Create page component in `frontend/src/routes/` (e.g., `routes/Dashboard.tsx`)
2. Add route in `App.tsx` inside the `<Routes>` block
3. Add navigation link in the Layout component
4. Create any needed API hooks in `hooks/`

## Routing

React Router v6 in `App.tsx`. Pages live in `routes/`. Use nested routes for layouts.

```tsx
<Route path="/dashboard" element={<Dashboard />} />
```

## API Client

- `api/client.ts`: Base fetch wrapper with auth headers, error handling, base URL from `VITE_API_URL`
- `api/*.ts`: Typed endpoint functions per domain (e.g., `api/items.ts`)

Always type API responses to match backend Pydantic schemas.

## Data Fetching

Use React Query hooks in `hooks/` directory:

```tsx
export function useItems() {
  return useQuery({ queryKey: ["items"], queryFn: () => getItems() });
}
```

Invalidate cache after mutations: `queryClient.invalidateQueries({ queryKey: ["items"] })`.

## Types

`types/` directory holds TypeScript interfaces. These MUST mirror backend Pydantic schemas.
When updating a backend schema, update the corresponding frontend type immediately.

## Styling

- Tailwind CSS v4 with custom theme in `frontend/src/index.css` `@theme` block
- Use Tailwind utility classes; avoid inline styles and CSS modules
- Custom design tokens (colors, spacing) defined in the `@theme` block

## Components

`components/` directory for reusable UI. Use variant props pattern:

```tsx
interface ButtonProps {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}
```

## Testing

```bash
cd frontend && npm test              # Run vitest
cd frontend && npm test -- --watch   # Watch mode
```

Uses vitest + @testing-library/react. Test files colocated as `*.test.tsx`.

## Dependencies

Managed with npm. `package.json` in `frontend/`. Run `npm install` from `frontend/`.
