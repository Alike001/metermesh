import { useEffect, useState } from "react";

import { LandingPage } from "./components/LandingPage";
import { SessionWorkspace } from "./components/SessionWorkspace";

type View = "landing" | "workspace";

function viewFromHash(): View {
  return window.location.hash === "#workspace" ? "workspace" : "landing";
}

export default function App() {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setView(viewFromHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const openWorkspace = () => {
    window.location.hash = "workspace";
    setView("workspace");
    window.scrollTo({ left: 0, top: 0 });
  };

  const openLanding = () => {
    window.history.pushState(null, "", window.location.pathname);
    setView("landing");
    window.scrollTo({ left: 0, top: 0 });
  };

  return view === "workspace" ? (
    <SessionWorkspace onBack={openLanding} />
  ) : (
    <LandingPage onOpenWorkspace={openWorkspace} />
  );
}
