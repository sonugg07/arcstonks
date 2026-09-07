/**
 * Validates whether a string is a valid EVM wallet address
 * (0x followed by 40 hex characters)
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

/**
 * Normalizes an EVM address to lowercase trimmed format
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  return address.trim().toLowerCase();
}

/**
 * Formats an address for display (e.g., 0x1234...5678)
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
