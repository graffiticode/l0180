// SPDX-License-Identifier: MIT
/**
 * Docs must compile.
 *
 * This is not a documentation nit. The code generator writes from instructions.md and
 * retrieves from examples.md, so a wrong example is reproduced verbatim into generated
 * programs — and unlike a wrong sentence, it is learned. L0166 had four `params` examples in
 * its spec.md that never parsed, unquoted keys and comma separators, and they sat there until
 * L0179 was ported from them.
 *
 * Read paths are relative, so these run with packages/core as the cwd (`npm run -w
 * packages/core test`), which is what the workspace script does.
 */
import { test, describe, expect } from "vitest";
import { readFileSync } from "fs";
import { parser } from "@graffiticode/parser";
import { compiler, lexicon } from "./index.js";

/** Files whose fenced blocks are programs. examples.md holds prompts and is checked separately. */
const SPEC_FILES = ["spec/spec.md", "spec/instructions.md"];

function blocks(path: string): string[] {
  const out: string[] = [];
  let cur: string[] | null = null;
  for (const l of readFileSync(path, "utf-8").split("\n")) {
    if (l.trim().startsWith("```")) {
      if (cur) {
        out.push(cur.join("\n"));
        cur = null;
      } else cur = [];
      continue;
    }
    if (cur) cur.push(l);
  }
  return out;
}

/** A fenced block that is a program, rather than a table row or a fragment. */
const isProgram = (src: string): boolean => !!src && /^\s*choice\s*\[/.test(src);

async function compileSrc(src: string) {
  const code: any = await parser.parse(180, src, lexicon);
  const err: any = Object.values(code).find((n: any) => n && n.tag === "ERROR");
  if (err) throw new Error(`parse error: ${JSON.stringify(err.elts)}`);
  return await new Promise((res, rej) =>
    compiler.compile(code, {}, {}, (e: any, v: any) => {
      const errs = Array.isArray(e) ? e.filter(Boolean) : e ? [e] : [];
      if (errs.length) rej(errs);
      else res(v);
    }),
  );
}

describe("spec programs", () => {
  test("every program fragment in spec/ compiles, not merely parses", async () => {
    // Parsing is not enough: a program can parse perfectly and fail in the builder, which is
    // exactly how a stale example survives behind a parse-only guard.
    const bad: string[] = [];
    let ok = 0;
    for (const f of SPEC_FILES) {
      for (const b of blocks(f)) {
        const src = b.trim();
        if (!isProgram(src)) continue;
        try {
          await compileSrc(src.endsWith("..") ? src : `${src}..`);
          ok++;
        } catch (e: any) {
          const first = Array.isArray(e) ? e[0] : e;
          const msg = String(first?.message ?? first);
          bad.push(`\n--- ${f}\n${src.split("\n").slice(0, 4).join("\n")}\n  -> ${msg.slice(0, 200)}`);
        }
      }
    }
    expect(bad.join("")).toBe("");
    expect(ok).toBeGreaterThan(4);
  });

  test("the starter template compiles and produces a scoreable item", async () => {
    const val: any = await compileSrc(readFileSync("spec/template.gc", "utf-8"));
    expect(val.interaction.type).toBe("choice");
    expect(val.validation.points).toBeGreaterThan(0);
  });
});

describe("spec and lexicon agree", () => {
  /** Words in a `| \`word\` | \`<sig>\` | description |` table row. */
  function documentedWords(path: string): string[] {
    const out = new Set<string>();
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^\|\s*`([a-z-]+)`\s*\|\s*`(<[^`]*>)`\s*\|/);
      if (m) out.add(m[1]);
    }
    return [...out];
  }

  const ours = Object.keys(lexicon).filter(
    (w) => !["print", "get", "set", "nth", "data", "use", "json", "range"].includes(w),
  );

  test("every word documented in spec/ exists in the lexicon", () => {
    for (const f of SPEC_FILES) {
      for (const w of documentedWords(f)) {
        expect(lexicon[w], `${f} documents \`${w}\`, which is not in the lexicon`).toBeDefined();
      }
    }
  });

  test("every L0180 word is documented in instructions.md", () => {
    // The base language documents its own vocabulary; only this dialect's words are ours.
    const dialect = ["choice", "options", "prompt", "text", "id", "assess", "correct", "points", "shuffle", "min-choices", "max-choices"];
    const documented = documentedWords("spec/instructions.md");
    for (const w of dialect) {
      expect(documented, `\`${w}\` is in the lexicon but undocumented`).toContain(w);
    }
    // ...and nothing is documented that we then failed to add.
    expect(dialect.filter((w) => !ours.includes(w))).toEqual([]);
  });

  test("the signature in the docs matches the one in the lexicon", () => {
    for (const f of SPEC_FILES) {
      for (const line of readFileSync(f, "utf-8").split("\n")) {
        const m = line.match(/^\|\s*`([a-z-]+)`\s*\|\s*`(<[^`]*>)`\s*\|/);
        if (!m || !lexicon[m[1]]) continue;
        expect(lexicon[m[1]].type, `${f}: \`${m[1]}\` signature drift`).toBe(m[2]);
      }
    }
  });
});

describe("examples.md numbering is coherent", () => {
  const text = readFileSync("spec/examples.md", "utf-8");
  const lines = text.split("\n");
  const numbered = lines
    .map((l) => l.match(/^(\d+)\.\s+\S/))
    .filter(Boolean)
    .map((m) => Number(m![1]));
  const headers = lines
    .map((l) => l.match(/^##\s+Category\s+(\d+):\s+.*\((\d+)[–-](\d+)\)\s*$/))
    .filter(Boolean)
    .map((m) => ({ n: Number(m![1]), from: Number(m![2]), to: Number(m![3]) }));

  test("prompts run 1..N with no gaps or repeats", () => {
    expect(numbered.length).toBeGreaterThan(0);
    expect(numbered).toEqual(Array.from({ length: numbered.length }, (_, i) => i + 1));
  });

  test("categories are numbered in order and their ranges tile the whole list", () => {
    expect(headers.map((h) => h.n)).toEqual(headers.map((_, i) => i + 1));
    expect(headers[0].from).toBe(1);
    expect(headers[headers.length - 1].to).toBe(numbered.length);
    for (let i = 1; i < headers.length; i++) {
      expect(headers[i].from, `category ${headers[i].n} does not follow ${headers[i - 1].n}`).toBe(
        headers[i - 1].to + 1,
      );
    }
  });

  test("the count stated in the preamble is the count actually present", () => {
    const stated = text.match(/^(\d+) example prompts/m);
    expect(stated, "examples.md should open with 'N example prompts'").toBeTruthy();
    expect(Number(stated![1])).toBe(numbered.length);
  });
});
