// Sentence template rendering (syntax in schema.ts `Template`).

/** Returns the placeholder's text, or undefined when it has no value. */
export type Lookup = (placeholder: string) => string | undefined;

type Node = { t: 'text'; s: string } | { t: 'ph'; name: string } | { t: 'opt'; nodes: Node[] };

const cache = new Map<string, Node[]>();

function parse(src: string): Node[] {
  const cached = cache.get(src);
  if (cached) return cached;
  let i = 0;
  const walk = (inOpt: boolean): Node[] => {
    const nodes: Node[] = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push({ t: 'text', s: text });
      text = '';
    };
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === '{') {
        const end = src.indexOf('}', i);
        if (end < 0) throw new Error(`Unclosed { in template: ${src}`);
        flush();
        nodes.push({ t: 'ph', name: src.slice(i + 1, end) });
        i = end + 1;
      } else if (ch === '[') {
        flush();
        i++;
        nodes.push({ t: 'opt', nodes: walk(true) });
      } else if (ch === ']') {
        if (!inOpt) throw new Error(`Unbalanced ] in template: ${src}`);
        i++;
        flush();
        return nodes;
      } else {
        text += ch;
        i++;
      }
    }
    if (inOpt) throw new Error(`Unclosed [ in template: ${src}`);
    flush();
    return nodes;
  };
  const nodes = walk(false);
  cache.set(src, nodes);
  return nodes;
}

function renderNodes(nodes: Node[], lookup: Lookup): string | undefined {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.s;
    else if (n.t === 'ph') {
      const v = lookup(n.name);
      if (v === undefined) return undefined;
      out += v;
    } else {
      out += renderNodes(n.nodes, lookup) ?? '';
    }
  }
  return out;
}

/** Renders a template string; undefined when a required placeholder is empty. */
export function renderString(src: string, lookup: Lookup): string | undefined {
  return renderNodes(parse(src), lookup);
}

/** Placeholder names used in a template string (for validation). */
export function placeholders(src: string): string[] {
  const out: string[] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === 'ph') out.push(n.name);
      else if (n.t === 'opt') walk(n.nodes);
    }
  };
  walk(parse(src));
  return out;
}
