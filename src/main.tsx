import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { DialogProvider } from "./app/components/shared/BrandDialog";
import "./styles/index.css";
import { installGlobalErrorHandlers } from "./app/lib/errorReporter";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <DialogProvider>
      <App />
    </DialogProvider>
  </ErrorBoundary>
);
