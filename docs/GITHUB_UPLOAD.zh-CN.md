# 上传到 GitHub

推荐仓库名：`xc2-affinity-companion`。中文展示名为“异度神剑2 牵绊圆环助手”，日文为“ゼノブレイド2 キズナリング助手”，英文为“Xenoblade Chronicles 2 Affinity Companion”。展示名可以放在 README 和仓库描述中。

## 方法一：通过网页上传

1. 解压 `xc2-affinity-companion-github.zip`。进入解压后的项目文件夹，应直接看到 `index.html`、`README.md`、`assets/` 等。
2. 登录 GitHub，点击右上角 `+` → `New repository`，名称填 `xc2-affinity-companion`，按需要选择 Public 或 Private。**不勾选自动添加 README、.gitignore 或 License**，项目已经包含前两者；代码许可证可之后自行选择。
3. 创建仓库后，点击 `uploading an existing file`，或 `Add file` → `Upload files`。
4. 拖入项目文件夹里的内容，保留 `assets/`、`docs/` 等子目录。**不要只上传 ZIP，也不要在仓库根目录再套一层项目文件夹**。隐藏的 `.gitignore`、`.nojekyll` 可分开通过 `Add file` → `Create new file` 添加空白或对应内容；`scripts/` 和 `tests/` 可随后单独上传。
5. 写提交说明，例如 `Initial release`，点击 `Commit changes`。根目录必须能够看到 `index.html`，并核对图片目录和中英日 README 已上传。

GitHub 网页一次最多上传100个文件，单文件上限25 MiB；若整批超过100个文件，分批提交或使用下面的 Git 方法。参见 [GitHub 上传文件说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

## 方法二：Git 命令

安装 Git 并登录 GitHub。在 GitHub 创建空仓库，不预先生成 README、License 或 .gitignore。然后在 PowerShell 中执行，替换路径和 `YOUR_NAME`：

```powershell
Set-Location 'C:\path\to\xc2-affinity-companion'
git init -b main
git add .
git commit -m "Initial release: XC2 Affinity Companion"
git remote add origin https://github.com/YOUR_NAME/xc2-affinity-companion.git
git push -u origin main
```

Git 提示配置身份时，使用你希望显示在提交记录中的姓名和邮箱：

```powershell
git config user.name "YOUR_NAME"
git config user.email "YOUR_GITHUB_EMAIL"
```

再重新运行 `git commit` 和 `git push`。登录按 Git Credential Manager 或 GitHub 的提示完成。已有仓库不需要重新 `git init`；已有 `origin` 时先用 `git remote -v` 检查。

官方依据：[将本地代码添加到 GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## 可选：GitHub CLI

如果安装了 GitHub CLI，在上述本地 `git commit` 后执行以下命令，即可创建仓库并推送。此方法替代手动创建远端仓库及 `git remote add`：

```powershell
gh auth login
gh repo create xc2-affinity-companion --public --source=. --remote=origin --push
```

需要私有仓库时，将 `--public` 改成 `--private`。参见 [gh repo create 手册](https://cli.github.com/manual/gh_repo_create)。

## 可选：发布为 GitHub Pages 网页

1. 进入仓库的 `Settings` → `Pages`。
2. `Build and deployment` 的 Source 选 `Deploy from a branch`。
3. Branch 选 `main`，目录选 `/ (root)`，点击 `Save`。
4. 等待部署完成，访问 Pages 页面显示的实际网址，通常为 `https://YOUR_NAME.github.io/xc2-affinity-companion/`。

GitHub Free 通常需要公开仓库才能使用 Pages；私有仓库能否使用取决于账户方案。以仓库 Settings 显示为准。参见 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

**移动已有进度：**上传仓库不会迁移浏览器进度。先在原本地页面导出进度，再到 Pages 页面导入，才能带上个人打标结果和异刃进度。语言切换本身不需要迁移。

## 后续更新

在同一项目目录修改文件后：

```powershell
git add .
git commit -m "Update affinity companion"
git push
```

如启用了 Pages，推送后会重新部署。`dist/`、本地环境文件和常见进度备份文件名已在 `.gitignore` 中排除。仓库内的 `data.json`、`locales.json` 是公开项目数据，应提交。
