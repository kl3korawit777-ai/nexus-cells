// หน้าเข้าสู่ระบบ: GitHub (token) หรือ adapter local (เมื่อเปิดผ่าน scripts/admin_server.py)

import { h, field, textInput } from './ui.js';
import { at } from './text.js';
import { loadSettings, guessRepo, loginGithub, probeLocal, authorName, setAuthor, tokenRemembered } from './session.js';

export async function loginView(onLogin) {
  const settings = loadSettings();
  const local = await probeLocal();
  const msg = h('div', { class: 'adm-status', role: 'alert', hidden: true });
  const showProblems = (problems, info) => {
    msg.hidden = false;
    msg.className = 'adm-status fail';
    msg.replaceChildren(
      h('strong', { text: at('login.failed') }),
      h('ul', {}, problems.map((p) => h('li', { text: at('login.problem.' + p) }))),
      info && info.login ? h('p', { class: 'adm-muted', text: at('login.asUser', { user: info.login }) }) : null);
  };

  const token = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', placeholder: 'github_pat_…' });
  const repo = textInput(guessRepo(), () => {}, { placeholder: 'owner/repo', autocapitalize: 'off', spellcheck: 'false' });
  const branch = textInput(settings.branch || 'main', () => {}, { autocapitalize: 'off', spellcheck: 'false' });
  const author = textInput(settings.author || '', () => {}, { placeholder: at('login.authorPlaceholder') });
  const remember = h('input', { type: 'checkbox', id: 'adm-remember' });
  remember.checked = tokenRemembered();
  const go = h('button', { type: 'submit', class: 'adm-btn adm-btn-primary' }, at('login.submit'));

  const form = h('form', { class: 'adm-card', autocomplete: 'off', onsubmit: async (e) => {
    e.preventDefault();
    go.disabled = true;
    go.textContent = at('login.checking');
    msg.hidden = true;
    const r = await loginGithub({ token: token.value, repo: repo.value, branch: branch.value, remember: remember.checked });
    token.value = '';
    go.disabled = false;
    go.textContent = at('login.submit');
    if (!r.adapter) { showProblems(r.problems, r.info); return; }
    if (author.value.trim()) setAuthor(author.value);
    onLogin(r.adapter, r.info);
  } },
  h('h2', { text: at('login.githubTitle') }),
  field(at('login.token'), token, { hint: at('login.tokenHint'), id: 'token' }),
  h('div', { class: 'adm-fields' },
    field(at('login.repo'), repo, { id: 'repo' }),
    field(at('login.branch'), branch, { id: 'branch' })),
  field(at('login.author'), author, { hint: at('login.authorHint'), id: 'author' }),
  h('label', { class: 'adm-check', for: 'adm-remember' }, remember, h('span', { text: at('login.remember') })),
  h('p', { class: 'adm-hint', text: at('login.rememberHint') }),
  go);

  const parts = [h('h1', { text: at('app.title') }), h('p', { class: 'adm-muted', text: at('login.intro') }), form, msg];
  if (local) {
    parts.push(h('div', { class: 'adm-card' },
      h('h2', { text: at('login.localTitle') }),
      h('p', { class: 'adm-muted', text: at('login.localHint') }),
      h('button', { type: 'button', class: 'adm-btn', id: 'adm-use-local', onclick: () => { if (author.value.trim()) setAuthor(author.value); onLogin(local, { login: 'local', name: authorName() }); } }, at('login.localSubmit'))));
  }
  return h('main', { class: 'adm-page adm-narrow' }, parts);
}
