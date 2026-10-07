import { useEffect, useState } from "react";
import { useTheme } from "./theme/useTheme";
import TopBar from "./components/TopBar";
import Rail, { type Section } from "./components/Rail";
import StatusBar from "./components/StatusBar";
import ModelManager from "./components/ModelManager";
import ChatView from "./components/ChatView";
import SettingsPage from "./components/SettingsPage";
import { getLoadedModel } from "./lib/scanModels";
import "./App.css";

function App() {
  const { theme, preference, setPreference, toggleTheme } = useTheme();
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("chat");

  useEffect(() => {
    getLoadedModel().then(setActiveModel).catch(() => {});
  }, []);

  function handleModelLoaded(fileName: string) {
    setActiveModel(fileName);
    setSection("chat");
  }

  return (
    <div className="flex h-full flex-col bg-background text-text">
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        loadedModel={activeModel}
        onOpenModels={() => setSection("models")}
      />
      <div className="flex min-h-0 flex-1">
        <Rail active={section} onNavigate={setSection} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {section === "settings" ? (
            <SettingsPage
              themePreference={preference}
              onThemePreferenceChange={setPreference}
              loadedModel={activeModel}
            />
          ) : section === "models" || !activeModel ? (
            <ModelManager onModelLoaded={handleModelLoaded} />
          ) : (
            <ChatView
              modelName={activeModel}
              onChangeModel={() => setSection("models")}
            />
          )}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
