import { useEffect, useState } from "react";
import { useTheme } from "./theme/useTheme";
import AppHeader from "./components/AppHeader";
import ModelManager from "./components/ModelManager";
import ChatView from "./components/ChatView";
import { getLoadedModel } from "./lib/scanModels";
import "./App.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeModel, setActiveModel] = useState<string | null>(null);

  useEffect(() => {
    getLoadedModel().then(setActiveModel).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col bg-background text-text">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {activeModel ? (
          <ChatView
            modelName={activeModel}
            onChangeModel={() => setActiveModel(null)}
          />
        ) : (
          <ModelManager onModelLoaded={setActiveModel} />
        )}
      </main>
    </div>
  );
}

export default App;
