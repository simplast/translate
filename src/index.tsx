import "dotenv/config";
import { render } from "@opentui/solid";
import App from "./app";

await render(() => <App />);
