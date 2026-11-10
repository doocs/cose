export const MCP_BRIDGE_VERSION = 3
export const MCP_BRIDGE_PORT = 17831

export function pairingProof(role, origin, clientNonce, serverNonce) {
  return JSON.stringify([MCP_BRIDGE_VERSION, role, origin, clientNonce, serverNonce])
}
