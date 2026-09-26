#!/usr/bin/env python3
"""Recupera e compacta o contexto de uma sessao do Google Antigravity.

Localiza a sessao pelo titulo (aceita parte do nome, com ou sem acentos),
confirma o projeto e extrai um resumo compacto do transcript JSONL.

Uso:
  python3 recover.py --title "Falha na Reprodu" [--project "workspace-name"] [--out /tmp/resumo.md] [--full]
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import unicodedata

ANTIGRAVITY_HOME = os.path.expanduser(
    os.environ.get("ANTIGRAVITY_HOME", "~/.gemini/antigravity")
)
BRAIN = os.path.join(ANTIGRAVITY_HOME, "brain")
CONV = os.path.join(ANTIGRAVITY_HOME, "conversations")
RESUMOS = os.path.join(ANTIGRAVITY_HOME, "opencode", "resumos")

KEYWORDS_CAUSA = ("causa raiz", "causa", "diagn", "root cause", "motivo",
                  "por que", "acontecia", "corrigido", "correcao", "fix", "solu")

MAX_SUMMARY_CHARS = 1600
MAX_TURNS = 60


def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def list_cascade_ids():
    if not os.path.isdir(BRAIN):
        return []
    return sorted(d for d in os.listdir(BRAIN) if os.path.isdir(os.path.join(BRAIN, d)))


def find_by_title(title):
    t = norm(title)
    found = {}
    for cid in list_cascade_ids():
        tlog = os.path.join(BRAIN, cid, ".system_generated", "logs", "transcript.jsonl")
        if not os.path.exists(tlog):
            continue
        try:
            with open(tlog, encoding="utf-8", errors="replace") as f:
                for line in f:
                    if "USER Objective" not in line:
                        continue
                    if t in norm(line):
                        found[cid] = True
                        break
        except Exception:
            continue
    return list(found)


def find_by_bytes(title):
    variants = [title, norm(title)]
    found = {}
    if not os.path.isdir(CONV):
        return []
    for fn in os.listdir(CONV):
        if not fn.endswith(".db"):
            continue
        path = os.path.join(CONV, fn)
        try:
            with open(path, "rb") as f:
                data = f.read()
        except Exception:
            continue
        low = data.lower()
        if any(v.lower().encode() in low for v in variants):
            found[fn[:-3]] = True
    return list(found)


def get_workspace(cid):
    db = os.path.join(CONV, cid + ".db")
    if not os.path.exists(db):
        return []
    paths = []
    try:
        con = sqlite3.connect(db)
        cur = con.cursor()
        try:
            row = cur.execute(
                "SELECT data FROM trajectory_metadata_blob WHERE id='main'").fetchone()
        except sqlite3.Error:
            row = None
        if row and row[0]:
            data = row[0] if isinstance(row[0], bytes) else str(row[0]).encode()
            paths = [p.decode("utf-8", "replace")
                     for p in re.findall(rb"file://(/[^\x00-\x1f]*?)(?:\s|$|\x12)", data)]
        con.close()
    except Exception:
        pass
    return paths


def get_title_from_transcript(cid):
    for o in iter_steps(cid):
        c = o.get("content")
        if not isinstance(c, str) or "USER Objective" not in c:
            continue
        m = re.search(r"USER Objective:\s*([^\n<]+)", c)
        if m:
            return m.group(1).strip()
    return None


def iter_steps(cid):
    tlog = os.path.join(BRAIN, cid, ".system_generated", "logs", "transcript.jsonl")
    with open(tlog, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def clean_user_content(content):
    c = re.sub(r"<USER_REQUEST>\s*", "", content)
    c = re.sub(r"\s*</USER_REQUEST>", "", c)
    c = re.sub(r"<ADDITIONAL_METADATA>.*", "", c, flags=re.S)
    c = re.sub(r"<USER_SETTINGS_CHANGE>.*", "", c, flags=re.S)
    c = re.sub(r"Comments on artifact URI.*", "", c, flags=re.S)
    return c.strip()


FILE_DUMP_MARKS = ("File Path: `file://", "Created At:", "Showing lines",
                   "Log output:", "Status: RUNNING", "Status: DONE",
                   "Wrote ", "Writing at ", "Task: ")


def is_model_text(o):
    if o.get("source") != "MODEL" or not isinstance(o.get("content"), str):
        return False
    c = o["content"].strip()
    if len(c) <= 60:
        return False
    return not any(m in c for m in FILE_DUMP_MARKS)


def summarize(cid, full=False):
    user_requests = []
    checkpoints = []
    turns = []  # (created_at, user_text, [summary candidates])
    cur_turn = None
    last_ts = None

    for o in iter_steps(cid):
        src = o.get("source")
        typ = o.get("type")
        ts = o.get("created_at") or last_ts
        if ts:
            last_ts = ts

        if src == "USER_EXPLICIT" and typ == "USER_INPUT":
            text = clean_user_content(o.get("content", ""))
            if text and text not in user_requests:
                user_requests.append(text)
                cur_turn = {"ts": ts, "text": text, "summaries": []}
                turns.append(cur_turn)
        elif src == "MODEL" and is_model_text(o):
            if cur_turn is not None:
                cur_turn["summaries"].append(
                    (o.get("type"), o["content"].strip()))
        elif src == "SYSTEM" and typ == "CHECKPOINT":
            checkpoints.append(o.get("content", ""))

    rows = []
    for i, t in enumerate(turns[:MAX_TURNS]):
        best = None
        if t["summaries"]:
            planner = [c for typ, c in t["summaries"] if typ == "PLANNER_RESPONSE"]
            generic = [c for typ, c in t["summaries"] if typ != "PLANNER_RESPONSE"]
            pool = planner or generic
            for cand in reversed(pool):
                low = cand.lower()
                if any(k in low for k in KEYWORDS_CAUSA) or len(cand) > 300:
                    best = cand
                    break
            if best is None and pool:
                best = pool[-1]
        rows.append({"ts": t["ts"], "text": t["text"], "summary": best})

    return {"requests": user_requests, "turns": rows, "last_ts": last_ts,
            "checkpoints": checkpoints}


def render(cid, data, full=False):
    out = []
    out.append(f"# Sessao Antigravity: {data['title'] or cid}")
    out.append("")
    out.append(f"- cascade_id: `{cid}`")
    out.append(f"- brain: `{BRAIN}/{cid}`")
    out.append(f"- ultima atividade: {data['last_ts']}")
    if data["workspace"]:
        out.append("- projeto(s): " + ", ".join(data["workspace"]))
    out.append("")

    out.append("## Objetivo")
    out.append(data["title"] or "(sem titulo)")
    out.append("")

    pending = []
    out.append("## Cronologia (pedidos + sintese)")
    for r in data["turns"]:
        out.append(f"- [{r['ts'] or '?'}] {r['text']}")
        if r["summary"]:
            s = r["summary"].replace("\n", " ").strip()
            if len(s) > MAX_SUMMARY_CHARS:
                s = s[:MAX_SUMMARY_CHARS] + " [...]"
            out.append(f"  -> {s}")
        else:
            pending.append(r["text"])
    out.append("")

    if full:
        out.append("## Checkpoints (trecho inicial)")
        for c in data["checkpoints"]:
            out.append(c.strip()[:2000])
            out.append("")

    if pending:
        out.append("## Estado pendente (sem resposta de sintese)")
        for p in pending:
            out.append(f"- {p}")
        out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--project", default=None, help="filtra pelo caminho do workspace")
    ap.add_argument("--out", default=None, help="arquivo de saida do resumo")
    ap.add_argument("--full", action="store_true", help="inclui checkpoints no resumo")
    args = ap.parse_args()

    cids = find_by_title(args.title) + [c for c in find_by_bytes(args.title)
                                        if c not in find_by_title(args.title)]
    if not cids:
        sys.exit(f"Nenhuma sessao encontrada com o titulo '{args.title}' em {BRAIN}")

    results = []
    for cid in cids:
        ws = get_workspace(cid)
        if args.project and not any(args.project in w for w in ws):
            continue
        results.append((cid, ws))

    if not results:
        sys.exit(f"Nenhuma sessao encontrada no projeto '{args.project}' (titulo '{args.title}'). "
                 f"Candidatos sem filtro: {cids}")
    if len(results) > 1:
        print("Multiplas sessoes encontradas:", file=sys.stderr)
        for cid, ws in results:
            print(f"  {cid}  {ws}", file=sys.stderr)

    cid, ws = results[0]
    data = summarize(cid, full=args.full)
    data["title"] = get_title_from_transcript(cid)
    data["workspace"] = ws

    md = render(cid, data, full=args.full)
    print(md)

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
    else:
        os.makedirs(RESUMOS, exist_ok=True)
        dest = os.path.join(RESUMOS, cid + ".md")
        with open(dest, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"\n(resumo tambem salvo em {dest})", file=sys.stderr)


if __name__ == "__main__":
    main()
