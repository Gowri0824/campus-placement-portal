import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { transformWithOxc } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const source = (name) => path.join(root, "src", name);

export async function loadSource(entry, mocks = {}, globals = {}) {
  const context = vm.createContext({ console, URL, Date, Intl, ...globals });
  const cache = new Map();
  async function resolve(specifier, parent) {
    if (!specifier.startsWith(".")) return specifier;
    const base = path.resolve(path.dirname(parent), specifier);
    for (const candidate of [base, `${base}.js`, `${base}.jsx`]) {
      try { await access(candidate); return candidate; } catch { /* Try the next extension. */ }
    }
    throw new Error(`Cannot resolve ${specifier}`);
  }
  async function getModule(id) {
    if (!cache.has(id)) cache.set(id, (async () => {
      let exports = mocks[id];
      if (!exports && !path.isAbsolute(id)) exports = await import(id);
      if (exports || id.endsWith(".css")) {
        exports ||= {};
        return new vm.SyntheticModule(Object.keys(exports), function () {
          for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context, identifier: id });
      }
      const text = await readFile(id, "utf8");
      const code = id.endsWith(".jsx")
        ? (await transformWithOxc(text, id, { jsx: { runtime: "automatic" } })).code
        : text;
      return new vm.SourceTextModule(code, { context, identifier: id });
    })());
    return cache.get(id);
  }
  const module = await getModule(source(entry));
  await module.link(async (specifier, parent) => getModule(await resolve(specifier, parent.identifier)));
  await module.evaluate();
  return module.namespace;
}

export function createReadFixture(tables, fail = () => null) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [], orders: [] };
    calls.push(call);
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(column, value) { call.filters.push([column, value]); return query; },
      in(column, values) { call.ids = [column, values]; return query; },
      order(column, options) { call.orders.push([column, options]); return query; },
      range(start, end) { call.range = [start, end]; return query; },
      maybeSingle() { call.single = true; return query; },
      then(resolve, reject) {
        const error = fail(call);
        let rows = (tables[table] || []).filter((row) => call.filters.every(([key, value]) => row[key] === value));
        if (call.ids) rows = rows.filter((row) => call.ids[1].includes(row[call.ids[0]]));
        if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
        return Promise.resolve({ data: error ? null : call.single ? rows[0] || null : rows, error }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { client, calls, mocks: { [source("services/supabaseClient.js")]: { supabase: client } } };
}

export function hookHarness() {
  let cursor = 0;
  let effects = [];
  const slots = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (value) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(compute, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        slots[index] = { deps, value: compute() };
      }
      return slots[index].value;
    },
    useEffect(setup, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: setup() }; });
      }
    },
  };
  return {
    react,
    render(hook) { cursor = 0; effects = []; const value = hook(); effects.forEach((run) => run()); return value; },
    async settle(hook) { await new Promise((resolve) => setImmediate(resolve)); return this.render(hook); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
