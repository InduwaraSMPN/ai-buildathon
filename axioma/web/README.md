# Axiōma Web

The public, server-rendered marketing website for Axiōma. It uses React 19, TypeScript, Tailwind CSS 4, Vite, and TanStack Start with file-based routing.

## Run locally

```sh
pnpm install
pnpm dev
```

The site runs at `http://localhost:3000`.

## Quality gates

```sh
pnpm check
pnpm check-types
pnpm build
```

`check-types` runs a build first so TanStack Router can generate its route tree.

## Contact

The contact page uses a real `mailto:` link to `hello@axioma.dev`; there is no simulated form submission or backend dependency.
