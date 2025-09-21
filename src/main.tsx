import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Admin from "./Admin"; // ← さっき作った管理画面
import "./index.css";

function Root() {
  const [hash, setHash] = React.useState<string>(() => window.location.hash);

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // #/admin で管理画面、それ以外は通常画面
  return hash.startsWith("#/admin") ? <Admin /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
