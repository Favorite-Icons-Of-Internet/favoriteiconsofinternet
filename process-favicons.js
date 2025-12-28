import fs from "fs/promises";
import path from "path";
import { URL } from "url";

// --- Configuration ---
const inputFile = path.join(process.cwd(), "favicons.json");
const outputFile = path.join(process.cwd(), "favicons-processed.json");
// ---------------------

/**
 * Reads the favicons.json file, converts relative favicon paths to absolute URLs,
 * deduplicates by domain, and saves the result to a new file.
 */
async function processAndDeduplicateFavicons() {
  console.log(`🚀 Reading and processing data from ${inputFile}...`);

  try {
    // 1. Read and parse the input JSON file.
    const rawData = await fs.readFile(inputFile, "utf-8");
    const entries = JSON.parse(rawData);
    console.log(`📊 Found ${entries.length} entries to process.`);

    // 2. Process each entry to resolve the favicon URL.
    const processedEntries = entries.map((entry) => {
      // Defensive check for required fields.
      if (!entry.favicon || !entry.url) {
        return {
          ...entry,
          date: entry.date?.value || null, // Flatten date
          error: "Missing url or favicon field",
        };
      }

      let absoluteFaviconUrl;
      try {
        // The URL constructor elegantly handles absolute, protocol-relative,
        // and root-relative paths by resolving them against the base `entry.url`.
        const resolvedUrl = new URL(entry.favicon, entry.url);
        absoluteFaviconUrl = resolvedUrl.href;
      } catch (e) {
        console.warn(
          `⚠️  Could not parse URL for entry: ${entry.url}. Error: ${e.message}`
        );
        return {
          ...entry,
          date: entry.date?.value,
          error: `Invalid URL: ${e.message}`,
        };
      }

      // 3. Return a new object with the updated fields.
      return {
        ...entry,
        date: entry.date.value, // Flatten the date object for simplicity.
        favicon: absoluteFaviconUrl, // Overwrite with the absolute URL.
      };
    });

    console.log("✅ URL processing complete.");

    // 4. Deduplicate entries by domain, keeping the first one found.
    console.log("🚀 Deduplicating entries by domain...");
    const seenDomains = new Set();
    const uniqueEntries = [];
    for (const entry of processedEntries) {
      // We can only deduplicate if we have a valid, error-free URL.
      if (entry.error || !entry.url) {
        uniqueEntries.push(entry); // Keep entries with errors or no URL.
        continue;
      }

      // The URL was valid for processing, so it should be valid here.
      const domain = new URL(entry.url).hostname;
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        uniqueEntries.push(entry);
      }
    }
    const removedCount = processedEntries.length - uniqueEntries.length;
    console.log(
      `✅ Deduplication complete. Removed ${removedCount} duplicate domain entries.`
    );

    // 5. Save the processed and deduplicated data to a new file.
    await fs.writeFile(outputFile, JSON.stringify(uniqueEntries, null, 2));
    console.log(`💾 Processed data successfully saved to ${outputFile}`);
  } catch (error) {
    console.error("❌ An error occurred during processing:", error.message);
    if (error.code === "ENOENT") {
      console.error(
        `\nHint: Make sure the input file exists at '${inputFile}'. You may need to run 'npm start' first.`
      );
    }
    process.exit(1);
  }
}

processAndDeduplicateFavicons();
