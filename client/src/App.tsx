/** IconMorph Studio — 以材料实验室视觉系统统一的单页应用路由。 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";


function Router() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  const homePaths = base === "/" ? ["/"] : [base, `${base}/`];

  return (
    <Switch>
      {homePaths.map(path => <Route key={path} path={path} component={Home} />)}
      <Route path={"/404"} component={NotFound} />
      {/* GitHub Pages serves the app below a repository path; keep the SPA entry reachable after static hosting rewrites. */}
      <Route component={Home} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
