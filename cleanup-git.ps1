#!/usr/bin/env pwsh
Write-Host "== Git cleanup helper =="

function Run-Git($cmd) {
    Write-Host "> git $cmd"
    git $cmd
    return $LASTEXITCODE
}

# verify we're in a git repo
$inside = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Este diretório não parece ser um repositório Git. Pare."
    exit 1
}

Write-Host "Removendo do índice arquivos/pastas que não devem ser versionados..."

# Targets to remove from index if present
$targets = @('node_modules/.package-lock.json','node_modules','.data','.wwebjs_cache','.wwebjs_auth')
foreach ($t in $targets) {
    git rm --cached -r $t 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "- Removido do índice: $t"
    } else {
        Write-Host "- Não estava no índice (ou não existe): $t"
    }
}

Write-Host "Garantindo .gitignore presente e com entradas padrão..."
if (-not (Test-Path .gitignore)) {
    @"
node_modules/
.data/
.wwebjs_auth/
.wwebjs_cache/
.env
/.vscode/
npm-debug.log
"@ | Out-File -Encoding UTF8 .gitignore
    Write-Host "Criado .gitignore"
} else {
    Write-Host ".gitignore já existe; adicionando entradas se faltarem."
    $ignore = Get-Content .gitignore -Raw
    $need = @('node_modules/','.data/','.wwebjs_auth/','.wwebjs_cache/','.env','/.vscode/','npm-debug.log') | Where-Object { $ignore -notlike "*$_*" }
    if ($need.Count -gt 0) {
        $need | Out-File -Append -Encoding UTF8 .gitignore
        Write-Host "Entradas adicionadas em .gitignore: $($need -join ', ')"
    } else {
        Write-Host ".gitignore já inclui as entradas padrão."
    }
}

Write-Host "Adicionando .gitignore e package-lock.json (se presente) ao stage..."
git add .gitignore 2>$null
if (Test-Path package-lock.json) { git add package-lock.json 2>$null }

# Commit if there are staged changes
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    git commit -m "chore: cleanup ignored files and update .gitignore" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit criado. Fazendo push para a branch $branch"
        git push origin $branch
        if ($LASTEXITCODE -eq 0) { Write-Host "Push concluído." } else { Write-Warning "Push falhou ou precisa autenticação." }
    } else {
        Write-Host "Nenhum commit criado (possivelmente sem alterações)."
    }
} else {
    Write-Host "Nada para commitar."
}

Write-Host "Status final (resumo):"
git status --short

Write-Host "== Fim do script =="