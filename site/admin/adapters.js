// ที่เก็บข้อมูลของหน้าแอดมิน: adapter สองแบบที่มี interface เดียวกัน (ไม่ผูกกับ DOM ใช้ทดสอบด้วย Node ได้)
//   githubAdapter  ใช้งานจริง เรียก GitHub REST API ที่ api.github.com เท่านั้น
//   localAdapter   สำหรับพัฒนา เรียก scripts/admin_server.py ที่ 127.0.0.1
//
// interface:
//   verify()                         ตรวจ token/สิทธิ์ → {login, name, repo, branch, canWrite, canSeeActions, problems:[รหัส]}
//   snapshot()                       → {head, files:{path: sha}}  (เฉพาะ data/ และ site/images/)
//   readText(path, sha)              → ข้อความ (UTF-8)
//   commit({message, base, expected, changes}) → {id, url?}   throws ConflictError
//        base     = head ที่โหลดมา
//        expected = {path: sha|null} sha ของไฟล์ที่จะแก้ตอนโหลด (null = ต้องยังไม่มี)
//        changes  = [{path, kind:'text'|'blob'|'delete', text?, blob?}]
//   status(id)                       → {state:'pending'|'running'|'success'|'failure'|'unknown', url?, error?}
//   history(n)                       → [{id, message, date, url, author}]

const API = 'https://api.github.com';
export const WRITE_ROOTS = ['data/', 'site/images/'];

export class AdminError extends Error {
  constructor(code, detail) { super(code + (detail ? ': ' + detail : '')); this.code = code; this.detail = detail; }
}
export class ConflictError extends AdminError {
  constructor(paths) { super('conflict', paths.join(', ')); this.paths = paths; }
}

const inScope = (p) => WRITE_ROOTS.some((r) => p.startsWith(r));
export const safePath = (p) => typeof p === 'string' && inScope(p) && !p.includes('..') && !p.includes('\\') && !p.startsWith('/') && !/\/\//.test(p);

export function bytesToB64(bytes) {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(bin);
}
export function b64ToBytes(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export async function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (typeof x === 'string') return new TextEncoder().encode(x);
  return new Uint8Array(await x.arrayBuffer());
}

// ------------------------------------------------------------------ GitHub

export function githubAdapter({ token, repo, branch = 'main', fetchFn }) {
  const f = fetchFn || ((...a) => fetch(...a));
  const [owner, name] = repo.split('/');
  const base = `${API}/repos/${owner}/${name}`;

  async function api(path, { method = 'GET', body, raw = false, okStatuses = [] } = {}) {
    const res = await f(path.startsWith('http') ? path : base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.ok || okStatuses.includes(res.status)) return raw ? res : res.status === 204 ? null : res.json();
    let msg = '';
    try { msg = (await res.json()).message || ''; } catch { /* ไม่มีเนื้อหา */ }
    throw new AdminError('http' + res.status, msg);
  }

  async function headInfo() {
    const ref = await api(`/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, '/')}`);
    const commit = await api(`/git/commits/${ref.object.sha}`);
    return { head: ref.object.sha, tree: commit.tree.sha };
  }

  async function filesAt(treeSha) {
    const t = await api(`/git/trees/${treeSha}?recursive=1`);
    if (t.truncated) throw new AdminError('treeTruncated');
    const files = {};
    for (const e of t.tree) if (e.type === 'blob' && inScope(e.path)) files[e.path] = e.sha;
    return files;
  }

  return {
    kind: 'github',
    label: `${repo}@${branch}`,

    async verify() {
      const out = { login: '', name: '', repo, branch, canWrite: false, canSeeActions: true, problems: [] };
      try {
        const u = await api(`${API}/user`);
        out.login = u.login; out.name = u.name || '';
      } catch (e) {
        out.problems.push(e.code === 'http401' ? 'tokenInvalid' : 'userFailed');
        return out;
      }
      let r;
      try { r = await api(''); } catch (e) {
        out.problems.push(e.code === 'http404' ? 'repoNoAccess' : e.code === 'http403' ? 'repoForbidden' : 'repoFailed');
        return out;
      }
      out.canWrite = !!(r.permissions && r.permissions.push);
      if (!out.canWrite) out.problems.push('noWrite');
      try { await api(`/git/ref/heads/${branch}`); } catch (e) {
        out.problems.push(e.code === 'http404' ? 'branchMissing' : 'branchFailed');
      }
      try { await api('/actions/runs?per_page=1'); } catch { out.canSeeActions = false; }
      return out;
    },

    async snapshot() {
      const { head, tree } = await headInfo();
      return { head, files: await filesAt(tree) };
    },

    async readText(path, sha) {
      const res = await api(`/git/blobs/${sha}`);
      return new TextDecoder().decode(b64ToBytes(res.content));
    },

    async commit({ message, base: baseHead, expected = {}, changes }) {
      for (const c of changes) if (!safePath(c.path)) throw new AdminError('badPath', c.path);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { head, tree } = await headInfo();
        if (head !== baseHead) {
          // มีคน commit เข้ามาหลังจากโหลด: ถ้าไฟล์ที่จะแก้ถูกเปลี่ยนไปด้วย ต้องหยุด
          const now = await filesAt(tree);
          const conflicts = Object.keys(expected).filter((p) => (now[p] || null) !== expected[p]);
          if (conflicts.length) throw new ConflictError(conflicts);
        }
        const entries = [];
        for (const c of changes) {
          if (c.kind === 'delete') { entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue; }
          const blob = c.kind === 'text'
            ? await api('/git/blobs', { method: 'POST', body: { content: c.text, encoding: 'utf-8' } })
            : await api('/git/blobs', { method: 'POST', body: { content: bytesToB64(await toBytes(c.blob)), encoding: 'base64' } });
          entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const newTree = await api('/git/trees', { method: 'POST', body: { base_tree: tree, tree: entries } });
        const commit = await api('/git/commits', { method: 'POST', body: { message, tree: newTree.sha, parents: [head] } });
        try {
          await api(`/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
        } catch (e) {
          if (e.code === 'http422' && attempt < 2) { baseHead = head; continue; } // มีคน push ระหว่างทาง ลองใหม่และตรวจซ้ำ
          throw e;
        }
        return { id: commit.sha, url: commit.html_url };
      }
      throw new AdminError('commitFailed');
    },

    async status(commitSha) {
      let runs;
      try { runs = await api(`/actions/runs?head_sha=${commitSha}&per_page=5`); } catch (e) {
        return { state: 'unknown', error: e.code };
      }
      const run = (runs.workflow_runs || []).find((r) => r.event === 'push') || (runs.workflow_runs || [])[0];
      if (!run) return { state: 'pending' };
      const url = run.html_url;
      if (run.status !== 'completed') return { state: run.status === 'queued' ? 'pending' : 'running', url };
      if (run.conclusion === 'success') return { state: 'success', url };
      let error = '';
      try {
        const jobs = await api(`/actions/runs/${run.id}/jobs`);
        for (const j of jobs.jobs || []) {
          const bad = (j.steps || []).find((s) => s.conclusion === 'failure');
          if (bad) {
            error = `${j.name} › ${bad.name}`;
            try {
              const res = await api(`/actions/jobs/${j.id}/logs`, { raw: true });
              const text = await res.text();
              const lines = text.split('\n').filter((l) => /error|✗|fail|ผิดพลาด|Traceback/i.test(l)).slice(-12);
              if (lines.length) error += '\n' + lines.map((l) => l.replace(/^\S+Z\s/, '')).join('\n');
            } catch { /* ดึง log ไม่ได้ (สิทธิ์/CORS) ใช้ชื่อขั้นตอนอย่างเดียว */ }
            break;
          }
        }
      } catch { /* ข้าม */ }
      return { state: 'failure', url, error: error || run.conclusion };
    },

    async history(n = 20) {
      const list = await api(`/commits?sha=${encodeURIComponent(branch)}&per_page=100`);
      return list.filter((c) => c.commit.message.startsWith('admin:')).slice(0, n).map((c) => ({
        id: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author.date, url: c.html_url, author: (c.author && c.author.login) || c.commit.author.name,
      }));
    },
  };
}

// ------------------------------------------------------------------ Local

export function localAdapter({ base = '', fetchFn } = {}) {
  const f = fetchFn || ((...a) => fetch(...a));
  async function api(path, { method = 'GET', body } = {}) {
    const res = await f(base + path, {
      method,
      headers: { 'X-Nexus-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 409) throw new ConflictError((await res.json()).conflicts || []);
    if (!res.ok) { let m = ''; try { m = (await res.json()).error || ''; } catch { /* ไม่มีเนื้อหา */ } throw new AdminError('http' + res.status, m); }
    return res.json();
  }
  return {
    kind: 'local',
    label: 'local',
    async ping() { try { return (await api('/api/ping')).ok === true; } catch { return false; } },
    async verify() {
      return { login: 'local', name: '', repo: 'local', branch: 'local', canWrite: true, canSeeActions: true, problems: [] };
    },
    async snapshot() { return api('/api/tree'); },
    async readText(path) {
      const res = await f(`${base}/api/file?path=${encodeURIComponent(path)}`, { headers: { 'X-Nexus-Admin': '1' }, cache: 'no-store' });
      if (!res.ok) throw new AdminError('http' + res.status, path);
      return res.text();
    },
    async commit({ message, expected = {}, changes }) {
      for (const c of changes) if (!safePath(c.path)) throw new AdminError('badPath', c.path);
      const files = [];
      for (const c of changes) {
        if (c.kind === 'delete') files.push({ path: c.path, content: null });
        else files.push({ path: c.path, content: bytesToB64(await toBytes(c.kind === 'text' ? c.text : c.blob)) });
      }
      return api('/api/commit', { method: 'POST', body: { message, expected, files } });
    },
    async status(id) { return api(`/api/status?id=${encodeURIComponent(id)}`); },
    async history() { return api('/api/history'); },
  };
}
