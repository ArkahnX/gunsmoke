import "./index.css";
import { render } from "solid-js/web";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
render(() => <App />, root);

// esbuild live reload; only the local dev server has the /esbuild endpoint
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
	new EventSource("/esbuild").addEventListener("change", () => {
		location.reload();
	});
}
