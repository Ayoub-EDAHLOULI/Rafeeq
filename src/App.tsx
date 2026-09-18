import { useTheme } from "./theme/useTheme";
import "./App.css";

function App() {
  useTheme();

  return <main className="h-full bg-background text-text" />;
}

export default App;
