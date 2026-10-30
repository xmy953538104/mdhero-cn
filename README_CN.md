# MDHero CN：Windows 简体中文构建

本仓库是 [MDHero 官方开源项目](https://github.com/vaibhav-kakde-in/mdhero)的社区构建 CI，保留 GitHub Fork 关联、原项目 MIT License 和版权声明。这里生成的安装包属于社区构建，不是 MDHero 官方发行版。

简体中文支持来自官方源码，包括首次启动语言选择、系统语言识别、设置中的中英文切换以及原生菜单翻译。应用源码中，本仓库只维护 `src/lib/i18n/locales/zh-CN.json`；现有词条仍沿用官方翻译，需要补译或润色时才修改。其余功能、语言机制和 UI 布局跟随上游。Windows 简体中文系统会通过 WebView 的 `navigator.language` 自动识别；也可以在首次启动时选择“简体中文”，或在设置的“语言”中随时切换。

## 构建来源与环境

自动更新只跟随 `vaibhav-kakde-in/mdhero` 的新正式 Release，不跟随日常 `main` 提交，也不按周重复构建。发现新 Release 后，先检查语言文件，再同步该 Tag 的官方源码并触发 Windows 构建。同步时保留本仓库的 CI、说明、同步状态和中文词典，其余源码取自该 Release；不会引入上游的多平台发布工作流。

每次正式构建都会**直接检出官方指定 Commit**，再应用本仓库审阅后的 `zh-CN.json`。实际软件版本及上游 Commit SHA 会写入运行摘要和 `BUILD-INFO.txt`。手动构建仍可指定官方分支、Tag 或 Commit，默认 `main`，也必须通过语言文件检查。

所有编译均在 GitHub Actions 的 `windows-latest` x64 云端 Runner 上完成，使用 Node.js 22、pnpm 10、Rust Stable 和 Runner 自带的 Windows MSVC 工具。你无需在本地安装编译环境。工作流依次执行：

```text
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm tauri build
```

检查或测试失败就停止，不跳过检查，不删除测试，也不屏蔽错误。完整输出可在 Actions 各步骤日志中查看或下载。构建使用官方原有 Tauri 配置；MSI 或 NSIS EXE 任一缺失、大小异常或校验失败，运行都会失败。

Windows Runner 在检出前禁用 Git 自动换行转换，保留官方仓库中的 LF。否则 Windows 默认的 CRLF 转换会影响上游版本检查及脚本加载。这只配置临时 Runner 的 Git，不修改官方源码或测试。

Fork 中继承的多平台发布工作流由本 Windows 专用工作流替代，避免运行其他平台的构建或依赖官方签名密钥。除审阅后的中文词典外，使用官方源码及原有应用配置。

## 新 Release 检查与翻译维护

GitHub 不会把上游仓库的 Release 事件直接发送给本 Fork。因此 **Follow Upstream Releases** 工作流每天北京时间 09:17 轻量查询一次官方最新正式 Release；没有新 Release 就结束，不安装前端依赖，也不编译 Windows 包。修改 CI、中文词典或本说明时也会运行这项轻量检查。GitHub 定时任务可能延迟；公开仓库 60 天无活动时可能停用定时任务，需要在 Actions 中重新启用。

检查以 `.github/upstream-release.json` 中的 Release ID 和 `reviewed_i18n_commit` 为依据：

1. 新 Release 的 `en.json` 和 `zh-CN.json` 与已审阅的上游 Commit 比较，忽略 JSON 排版和键顺序。
2. 中英文词典内容均未变化，才同步新 Release 源码并触发 Windows 构建；保留我们自己的中文词典。
3. 新增、删除、改写词条，或占位符发生变化，就停止同步和构建，在日志中输出完整差异。语言文件缺失也会明确失败，防止意外构建出纯英文版本。
4. 人工核对英文含义，按需补译或润色本仓库的 `zh-CN.json`，确认词条和占位符正确后，才将 `reviewed_i18n_commit` 更新到新 Release 的完整 SHA，并重新运行同步检查。不能只改基准来绕过翻译审阅。

正式构建仍会执行上游 `pnpm check` 和 `pnpm test`；原有语言测试会检查词条集合和 `{placeholder}` 占位符。自动同步只处理版本与文件一致性，不调用翻译 API，也不会自动重写中文。构建失败后保留日志，修复后手动重跑构建，不每天重复编译同一失败版本。

初始化时，官方最新 Release `v0.2.10` 的 Tag 尚无国际化代码，已构建的中文包来自更新的 `main`。因此只将这个旧 Release 记为已知版本，不回退现有中文源码；等待后续新 Release 再尝试同步。

## 手动构建与后续版本

1. 打开本仓库的 [Actions 页面](https://github.com/xmy953538104/mdhero-cn/actions/workflows/build-windows.yml)。
2. 选择 **MDHero CN - Windows Build**，点击 **Run workflow**。
3. 工作流分支选择 `main`；`upstream_ref` 默认为 `main`，也可以填写官方分支名、Tag 或 Commit SHA。
4. 点击 **Run workflow** 后打开新运行，查看检查、测试、编译和上传过程。

需要立即查询新 Release 时，打开 [Follow Upstream Releases](https://github.com/xmy953538104/mdhero-cn/actions/workflows/sync-upstream-release.yml)，点击 **Run workflow**。没有新 Release 时不会触发构建；有翻译变化时，先按上面的流程审阅，再重新运行。不需要更新本地编译环境。

## 下载 MSI / EXE

打开一次**成功**的运行，在页面底部 **Artifacts** 中下载 `mdhero-cn-windows-x64`，或使用运行摘要中的下载链接。下载 Artifact 需要登录 GitHub；文件保留 90 天，过期后重新运行即可。

解压后包含：

- Windows x64 `.msi` 安装包。
- Windows x64 `-setup.exe` NSIS 安装包。
- `LICENSE`：原项目 MIT License 和版权声明。
- `BUILD-INFO.txt`：实际版本、上游 Ref、上游完整 Commit SHA、CI Run ID、构建时间、平台和架构等。
- `SHA256SUMS.txt`：两个安装包的 SHA256。

MSI 和 EXE 是两种安装方式，任选一种即可。查看运行摘要或 `BUILD-INFO.txt`，可以确认本次所用的上游版本与 Commit；不同日期的 `main` 构建可能具有不同 SHA。

## 校验 SHA256

在解压目录打开 PowerShell，执行以下命令；任何文件缺失、校验文件格式错误或哈希不一致都会报错：

```powershell
$ErrorActionPreference = 'Stop'
$lines = @(Get-Content -LiteralPath .\SHA256SUMS.txt)
if ($lines.Count -lt 2) { throw '校验文件缺少安装包记录。' }
foreach ($line in $lines) {
    if ($line -notmatch '^([0-9a-fA-F]{64})  (.+)$') { throw "校验文件格式错误：$line" }
    $expectedHash, $name = $Matches[1], $Matches[2]
    $actualHash = (Get-FileHash -LiteralPath $name -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) { throw "SHA256 不一致：$name" }
    Write-Host "校验通过：$name"
}
```

## 应用身份与更新

保留官方 `productName`、`identifier`、文件关联、应用配置、updater 公钥及官方更新地址。应用仍使用官方更新机制，后续自动更新可能安装官方发行包；需要新的社区构建时，请重新运行本仓库的 CI。本仓库不创建 GitHub Release，不搭建更新服务器，也不加入下载器、广告、统计、遥测或其他服务。

本工作流不配置 Windows 代码签名凭据，不宣称安装包已经代码签名；Windows 可能显示发布者未知或 SmartScreen 提示。请核对来源和 SHA256，并按自己的判断安装。
