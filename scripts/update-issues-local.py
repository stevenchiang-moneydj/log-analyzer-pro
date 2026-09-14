import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
GITLAB_URL = os.environ.get("GITLAB_URL", "https://gitscr1.moneydj.com").rstrip("/")
TOKEN = os.environ.get("GITLAB_TOKEN")
PROJECTS = {"xq": "1938", "xqnext": "801"}
ASSIGNEES = ("stevenchiang", "chengtseli", "jamielu", "marksun")


def fetch_issues(project_id, username):
    issues = []
    for page in range(1, 100):
        query = urlencode({"state": "opened", "assignee_username[]": username, "per_page": 100, "page": page})
        request = Request(f"{GITLAB_URL}/api/v4/projects/{project_id}/issues?{query}", headers={"PRIVATE-TOKEN": TOKEN})
        with urlopen(request, timeout=30) as response:
            batch = json.load(response)
        issues.extend(batch)
        if len(batch) < 100:
            return issues
    raise RuntimeError(f"Pagination limit reached for project {project_id}")


def build_report(project_id):
    unique = {}
    for username in ASSIGNEES:
        for issue in fetch_issues(project_id, username):
            unique[str(issue["iid"])] = {
                "iid": issue["iid"],
                "title": issue["title"],
                "assignees": [user["username"] for user in issue.get("assignees", [])],
                "createdAt": issue["created_at"],
                "updatedAt": issue["updated_at"],
                "url": issue["web_url"],
                "high": any(label.lower() == "high" for label in issue.get("labels", [])),
            }
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "issues": sorted(unique.values(), key=lambda issue: issue["createdAt"], reverse=True),
    }


def run_git(*arguments):
    subprocess.run(["git", *arguments], cwd=ROOT, check=True)


def main():
    if not TOKEN:
        raise RuntimeError("GITLAB_TOKEN environment variable is required")
    output_dir = ROOT / "public" / "issues"
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, project_id in PROJECTS.items():
        report = build_report(project_id)
        (output_dir / f"{name}.json").write_text(json.dumps(report, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{name}: {len(report['issues'])} issues")
    run_git("add", "public/issues/xq.json", "public/issues/xqnext.json")
    changed = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode != 0
    if changed:
        date = datetime.now().astimezone().strftime("%Y-%m-%d")
        run_git("commit", "-m", f"Update issue reports {date}")
        run_git("push", "origin", "main")
        print("Issue reports committed and pushed.")
    else:
        print("Issue reports unchanged; nothing to commit.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
