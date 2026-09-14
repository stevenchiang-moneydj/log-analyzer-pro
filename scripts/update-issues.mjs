import { mkdir, writeFile } from 'node:fs/promises';
const baseUrl = process.env.GITLAB_URL || 'https://gitscr1.moneydj.com';
const token = process.env.GITLAB_TOKEN;
if (!token) throw new Error('GITLAB_TOKEN is required');
const projects = { xq: '1938', xqnext: '801' };
const users = ['stevenchiang', 'chengtseli', 'jamielu', 'marksun'];
const getProjectIdentity = webUrl => { const projectPath = new URL(webUrl).pathname.split('/-/')[0].replace(/^\/+|\/+$/g, ''); return { projectPath, projectName: decodeURIComponent(projectPath.split('/').at(-1) ?? projectPath) }; };
for (const [key, project] of Object.entries(projects)) {
  const issues = new Map();
  for (const user of users) {
    const url = new URL(`${baseUrl}/api/v4/projects/${project}/issues`);
    url.searchParams.set('state', 'opened'); url.searchParams.set('assignee_username', user); url.searchParams.set('per_page', '100');
    const response = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
    if (!response.ok) throw new Error(`GitLab request failed: ${response.status}`);
    for (const issue of await response.json()) issues.set(`${project}:${issue.iid}`, { ...getProjectIdentity(issue.web_url), iid: issue.iid, title: issue.title, assignees: issue.assignees.map(a => a.username), createdAt: issue.created_at, updatedAt: issue.updated_at, url: issue.web_url, high: issue.labels.some(label => label.toLowerCase() === 'high') });
  }
  const data = { updatedAt: new Date().toISOString(), issues: [...issues.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  await mkdir('public/issues', { recursive: true }); await writeFile(`public/issues/${key}.json`, `${JSON.stringify(data)}\n`);
  console.log(`${key}: ${data.issues.length} issues`);
}
