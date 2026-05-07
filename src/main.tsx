import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { installGlobalErrorHandlers } from "./app/lib/errorReporter";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
