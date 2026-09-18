import { useTheme } from "./theme/useTheme";
import AppHeader from "./components/AppHeader";
import ModelManager from "./components/ModelManager";
import "./App.css";

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col bg-background text-text">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ModelManager />
      </main>
    </div>
  );
}

export default App;
