import { initPlatformContentScript } from "../shared-content-script";
import { detectFranceTvEpisode } from "./detector";
import { scanFranceTvHistory } from "./history";

initPlatformContentScript("francetv", () => detectFranceTvEpisode(), () => scanFranceTvHistory());
