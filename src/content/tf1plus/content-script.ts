import { initPlatformContentScript } from "../shared-content-script";
import { detectTf1PlusEpisode } from "./detector";
import { scanTf1PlusHistory } from "./history";

initPlatformContentScript("tf1plus", () => detectTf1PlusEpisode(), () => scanTf1PlusHistory());
