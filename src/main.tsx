import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/bricolage-grotesque";

import App from "./App";
import "./styles.css";
import "./styles/reactbits.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");

createRoot(container).render(<App />);
