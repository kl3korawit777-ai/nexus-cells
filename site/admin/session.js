// เข้าสู่ระบบ: token ของ GitHub (fine-grained personal access token) เก็บใน sessionStorage เป็นค่าเริ่มต้น
// ติ๊ก "จำไว้ในเครื่องนี้" จึงเก็บใน localStorage ทุกการอ่านเขียนครอบ try/catch
// token ไม่ถูกใส่ใน URL ไม่อยู่ในโค้ด และส่งไปที่ api.github.com เท่านั้น (CSP ใน index.html บังคับอีกชั้น)

import { githubAdapter, localAdapter } from './adapters.js';

const TOKEN_KEY = 'nexus.admin.token';
const SETTINGS_KEY = 'nexus.admin.settings';

const store = (kind) => { try { return window[kind]; } catch { return null; } };
function get(kind, key) { try { return store(kind).getItem(key); } catch { return null; } }
function set(kind, key, value) { try { store(kind).setItem(key, value); return true; } catch { return false; } }
function del(kind, key) { try { store(kind).removeItem(key); } catch { /* ไม่มีที่เก็บ */ } }

export function loadSettings() {
  try { return JSON.parse(get('localStorage', SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) { set('localStorage', SETTINGS_KEY, JSON.stringify(s)); }

// repo ตั้งต้น: ถ้าหน้านี้อยู่ที่ https://<owner>.github.io/<repo>/admin/ ใช้ <owner>/<repo>
export function guessRepo() {
  const s = loadSettings();
  if (s.repo) return s.repo;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo && repo !== 'admin' ? `${m[1]}/${repo}` : '';
}

export const isLocalHost = () => /^(127\.0\.0\.1|localhost)$/.test(location.hostname);

export async function probeLocal() {
  if (!isLocalHost()) return null;
  const a = localAdapter({ base: '' });
  return (await a.ping()) ? a : null;
}

export function storedToken() {
  return get('sessionStorage', TOKEN_KEY) || get('localStorage', TOKEN_KEY) || '';
}
export function tokenRemembered() { return !!get('localStorage', TOKEN_KEY); }

export function logout() {
  del('sessionStorage', TOKEN_KEY);
  del('localStorage', TOKEN_KEY);
}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH_RE = /^[A-Za-z0-9._\/-]+$/;

// ตรวจ token กับ repo ถ้าผ่านจึงเก็บ token คืน {adapter, info} หรือ {problems:[รหัส], info}
export async function loginGithub({ token, repo, branch, remember }) {
  token = token.trim();
  repo = repo.trim();
  branch = (branch || 'main').trim();
  if (!token) return { problems: ['tokenEmpty'] };
  if (!REPO_RE.test(repo)) return { problems: ['repoFormat'] };
  if (!BRANCH_RE.test(branch)) return { problems: ['branchFormat'] };
  const adapter = githubAdapter({ token, repo, branch });
  let info;
  try { info = await adapter.verify(); } catch { return { problems: ['network'] }; }
  const fatal = info.problems;
  if (fatal.length) return { problems: fatal, info };
  del('sessionStorage', TOKEN_KEY);
  del('localStorage', TOKEN_KEY);
  if (remember) set('localStorage', TOKEN_KEY, token); else set('sessionStorage', TOKEN_KEY, token);
  saveSettings({ ...loadSettings(), repo, branch });
  return { adapter, info };
}

// เปิดหน้าใหม่แล้วมี token ที่เก็บไว้: ตรวจซ้ำก่อนใช้
export async function restoreGithub() {
  const token = storedToken();
  const s = loadSettings();
  if (!token || !s.repo) return null;
  const r = await loginGithub({ token, repo: s.repo, branch: s.branch || 'main', remember: tokenRemembered() });
  return r.adapter ? r : null;
}

export function authorName(info) {
  const s = loadSettings();
  return (s.author || (info && (info.name || info.login)) || '').trim();
}
export function setAuthor(name) { saveSettings({ ...loadSettings(), author: name.trim() }); }
