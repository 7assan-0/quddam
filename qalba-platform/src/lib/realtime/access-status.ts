export function terminalAccessStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410;
}
