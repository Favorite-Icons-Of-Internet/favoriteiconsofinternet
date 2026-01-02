import { URL } from 'url';

/**
 * Extracts the domain from a URL, removing the 'www.' prefix if present.
 * @param {string} url - The URL to extract the domain from.
 * @returns {string} The domain name.
 */
export function getDomain(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

/**
 * Generates the filename for the icon based on the URL.
 * @param {string} url - The URL of the page (used to derive the domain).
 * @returns {string} The filename for the icon (e.g., "example.com.png").
 */
export function getIconFilename(url) {
  const domain = getDomain(url);
  return `${domain}.png`;
}
