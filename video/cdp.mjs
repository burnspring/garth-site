// Minimal CDP client over Node's built-in WebSocket.
export async function connect(port = 9222) {
  const t = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const handlers = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.j(new Error(JSON.stringify(d.error))) : p.r(d.result); }
    else if (d.method) (handlers.get(d.method) || []).forEach((h) => h(d.params));
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (ev, h) => { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(h); };
  const evalJS = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  return { send, on, evalJS, ws };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
