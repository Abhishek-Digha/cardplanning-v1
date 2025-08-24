// src/utils/systemId.js
export function getSystemId() {
  // Try to reuse existing one
  let id = localStorage.getItem('systemId');
  if (!id) {
    // Generate a random but persistent ID for this browser
    id = 'sys-' + Math.random().toString(36).substring(2) + Date.now();
    localStorage.setItem('systemId', id);
  }
  return id;
}
