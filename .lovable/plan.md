

## Plan: Fix forwardRef Console Warning

### What's happening
The app is fully working — I tested the entire flow end-to-end (sign up, wizard, build project, workspace, settings). The only remaining issue is a React `forwardRef` console warning.

### Root cause
The `App` component is defined as an arrow function (`const App = () => (...)`) which React Router v6 tries to attach a ref to. This produces a harmless but noisy warning.

### Fix
Convert the `App` component export to use a standard function or wrap it so React Router doesn't attempt to forward a ref. Since the warning comes from the `App` being the top-level component rendered by `BrowserRouter`, the simplest fix is to ensure `App` uses a function declaration instead of a const arrow expression.

### Steps
1. In `src/App.tsx`, change `const App = () => (` to `function App() { return (` — this eliminates the forwardRef warning
2. Verify no console errors remain

### Summary
The app is complete and working. This is a single-line cosmetic fix for a console warning. No functional changes needed.

