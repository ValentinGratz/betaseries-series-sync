import { afterEach, describe, expect, it } from "vitest";
import { detectTf1PlusEpisode } from "../../src/content/tf1plus/detector";

function setHtml(html: string) {
  document.head.innerHTML = "";
  document.body.innerHTML = html;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

describe("detectTf1PlusEpisode", () => {
  it("detects via JSON-LD TVEpisode when present", () => {
    setHtml(`
      <script type="application/ld+json">
        {
          "@type": "TVEpisode",
          "name": "Pilote",
          "episodeNumber": 1,
          "partOfSeason": { "seasonNumber": 5 },
          "partOfSeries": { "name": "Emily in Paris" }
        }
      </script>
    `);

    const result = detectTf1PlusEpisode(document, "https://www.tf1.fr/tf1/emily-in-paris/videos/s5-e1");

    expect(result).not.toBeNull();
    expect(result?.seriesTitle).toBe("Emily in Paris");
    expect(result?.seasonNumber).toBe(5);
    expect(result?.episodeNumber).toBe(1);
    expect(result?.detectionMethod).toBe("json-ld");
  });

  it("falls back to meta tags when no JSON-LD is present", () => {
    setHtml(`<meta property="og:title" content="Emily in Paris - S05 E01 - Pilote" />`);

    const result = detectTf1PlusEpisode(document, "https://www.tf1.fr/example");

    expect(result).not.toBeNull();
    expect(result?.seriesTitle).toBe("Emily in Paris");
    expect(result?.seasonNumber).toBe(5);
    expect(result?.episodeNumber).toBe(1);
    expect(result?.detectionMethod).toBe("meta-tags");
  });

  it("falls back to the URL pattern as a last resort", () => {
    setHtml("");
    const result = detectTf1PlusEpisode(
      document,
      "https://www.tf1.fr/tf1/emily-in-paris/videos/s5-e1-pilote-12345.html"
    );

    expect(result).not.toBeNull();
    expect(result?.seasonNumber).toBe(5);
    expect(result?.episodeNumber).toBe(1);
    expect(result?.detectionMethod).toBe("url-pattern");
  });

  it("returns null when nothing matches", () => {
    setHtml("");
    const result = detectTf1PlusEpisode(document, "https://www.tf1.fr/home");
    expect(result).toBeNull();
  });
});
