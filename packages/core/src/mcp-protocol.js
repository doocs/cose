export const MCP_BRIDGE_VERSION = 5
export const MCP_BRIDGE_PORT = 17831
export const MCP_DEFAULT_BROWSER_NAME = 'Chrome'
export const MCP_SETUP_TOKEN_KEY = 'coseMcpSetupToken'

export function pairingProof(role, origin, clientNonce, serverNonce) {
  return JSON.stringify([MCP_BRIDGE_VERSION, role, origin, clientNonce, serverNonce])
}
