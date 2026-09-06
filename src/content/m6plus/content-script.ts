import { initPlatformContentScript } from "../shared-content-script";
import { detectM6PlusEpisode } from "./detector";
import { scanM6PlusHistory } from "./history";

initPlatformContentScript("m6plus", () => detectM6PlusEpisode(), () => scanM6PlusHistory());
