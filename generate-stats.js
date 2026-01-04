import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { getIconRelativePath } from './utils.js';

const CONFIG = {
  INPUT_FILE: 'favicons-downloaded.json',
  OUTPUT_FILE: 'stats.html',
  ICONS_DIR: 'icons',
};

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function generateStats() {
  console.log('📊 Generating statistics...');

  try {
    await ensureDir(path.dirname(CONFIG.OUTPUT_FILE));

    const rawData = await fs.readFile(CONFIG.INPUT_FILE, 'utf-8');
    const data = JSON.parse(rawData);

    const stats = {
      total: data.length,
      byStatus: {},
      byHttpStatus: {},
      byError: {},
      byErrorDefault: {},
      byErrorCustom: {},
      byFileSize: {
        '< 1KB': 0,
        '1KB - 5KB': 0,
        '5KB - 10KB': 0,
        '10KB - 50KB': 0,
        '> 50KB': 0,
      },
      totalSize: 0,
      downloadedCount: 0,
    };

    console.log(`Processing ${data.length} entries...`);
    let processedCount = 0;

    // Use a loop with await for file stats to avoid overwhelming the file system
    // or use Promise.all with concurrency limit if needed, but linear is fine for stats gen.
    for (const entry of data) {
      processedCount++;
      if (processedCount % 1000 === 0) process.stdout.write(`Processed ${processedCount}...\r`);

      // Status
      const status = entry.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // HTTP Status
      if (entry.httpStatus) {
        stats.byHttpStatus[entry.httpStatus] = (stats.byHttpStatus[entry.httpStatus] || 0) + 1;
      }

      // Errors
      if (entry.error) {
        let errorMsg = entry.error;

        // Group corrupt header XML errors
        if (errorMsg.startsWith('Input buffer has corrupt header: glib: XML parse error:')) {
          errorMsg = 'Input buffer has corrupt header: glib: XML parse error: (grouped)';
        }

        stats.byError[errorMsg] = (stats.byError[errorMsg] || 0) + 1;

        let isDefault = false;
        try {
          // A "default" URL is one that just has /favicon.ico as the path
          isDefault = entry.favicon && new URL(entry.favicon).pathname === '/favicon.ico';
        } catch (e) {}

        if (isDefault) {
          stats.byErrorDefault[errorMsg] = (stats.byErrorDefault[errorMsg] || 0) + 1;
        } else {
          stats.byErrorCustom[errorMsg] = (stats.byErrorCustom[errorMsg] || 0) + 1;
        }
      }

      // File Size from Disk
      if (status === 'downloaded' || status === 'not_modified' || status === 'skipped_recent') {
        try {
          const relativePath = getIconRelativePath(entry.url);
          const filePath = path.join(CONFIG.ICONS_DIR, relativePath);
          const fileStats = await fs.stat(filePath);
          const size = fileStats.size;

          stats.totalSize += size;
          stats.downloadedCount++;

          if (size < 1024) stats.byFileSize['< 1KB']++;
          else if (size < 5 * 1024) stats.byFileSize['1KB - 5KB']++;
          else if (size < 10 * 1024) stats.byFileSize['5KB - 10KB']++;
          else if (size < 50 * 1024) stats.byFileSize['10KB - 50KB']++;
          else stats.byFileSize['> 50KB']++;
        } catch (e) {
          // File might be missing or error reading stat
        }
      }
    }
    console.log('\n✅ Data processing complete.');

    const avgSize =
      stats.downloadedCount > 0 ? Math.round(stats.totalSize / stats.downloadedCount) : 0;

    const templatePath = path.join(process.cwd(), 'stats.ejs');
    const template = await fs.readFile(templatePath, 'utf-8');
    const html = ejs.render(template, {
      stats,
      avgSize,
    });

    await fs.writeFile(CONFIG.OUTPUT_FILE, html);
    console.log(`✅ Stats saved to ${CONFIG.OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error generating stats:', err.message);
  }
}

generateStats();
