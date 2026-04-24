#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 白屏检测冒烟测试 (White-Screen Detection Smoke Test)
# ═══════════════════════════════════════════════════════════════════
#
# 检查项：
#   1. 构建产物是否存在且非空
#   2. HTML 入口文件完整性
#   3. JS chunk 间循环依赖检测
#   4. 检测 class extends 在 chunk 边界的 TDZ 风险
#   5. 检测 import 链中的循环引用
#   6. 检测关键资源加载失败风险
#
# 用法: bash scripts/smoke/white-screen-check.sh [--dist <path>]
#
# 退出码:
#   0 - 全部 PASS
#   1 - 有 FAIL 项
# ═══════════════════════════════════════════════════════════════════

# 不使用 set -e，手动处理错误
set -uo pipefail

# ── 颜色输出 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo -e "  ${GREEN}✅ PASS${NC} — $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "  ${RED}❌ FAIL${NC} — $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

info() {
  echo -e "  ${CYAN}ℹ️  INFO${NC} — $1"
}

# ── 参数解析 ──
DIST_DIR=""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dist)
      DIST_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$DIST_DIR" ]]; then
  DIST_DIR="$PROJECT_ROOT/dist"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  🧪 白屏检测冒烟测试 (White-Screen Smoke Test)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "  构建产物目录: ${CYAN}${DIST_DIR}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 1: 构建产物是否存在且非空
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[1/6] 构建产物存在性检查${NC}"

if [[ ! -d "$DIST_DIR" ]]; then
  fail "构建产物目录不存在: $DIST_DIR"
  echo ""
  echo -e "${RED}  >>> 请先执行 npm run build${NC}"
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  echo -e "  总计: ${GREEN}PASS=${PASS_COUNT}${NC} ${RED}FAIL=${FAIL_COUNT}${NC} ${YELLOW}WARN=${WARN_COUNT}${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  exit 1
fi

if [[ ! -d "$DIST_DIR/assets" ]]; then
  fail "assets 目录不存在: $DIST_DIR/assets"
else
  pass "assets 目录存在"
fi

# 检查 JS chunk 文件
JS_FILES=()
if [[ -d "$DIST_DIR/assets" ]]; then
  while IFS= read -r -d '' f; do
    JS_FILES+=("$f")
  done < <(find "$DIST_DIR/assets" -maxdepth 1 -name '*.js' -print0 2>/dev/null)
fi

if [[ ${#JS_FILES[@]} -eq 0 ]]; then
  fail "未找到任何 JS chunk 文件"
else
  pass "找到 ${#JS_FILES[@]} 个 JS chunk 文件"
fi

# 检查每个 JS 文件非空
EMPTY_COUNT=0
for f in "${JS_FILES[@]}"; do
  if [[ ! -s "$f" ]]; then
    EMPTY_COUNT=$((EMPTY_COUNT + 1))
    warn "空文件: $(basename "$f")"
  fi
done
if [[ $EMPTY_COUNT -eq 0 ]]; then
  pass "所有 JS chunk 文件非空"
fi

# 检查 CSS 文件
CSS_COUNT=0
if [[ -d "$DIST_DIR/assets" ]]; then
  CSS_COUNT=$(find "$DIST_DIR/assets" -maxdepth 1 -name '*.css' 2>/dev/null | wc -l)
fi

if [[ $CSS_COUNT -eq 0 ]]; then
  warn "未找到 CSS 文件（可能没有样式提取）"
else
  pass "找到 ${CSS_COUNT} 个 CSS 文件"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 2: HTML 入口文件完整性
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[2/6] HTML 入口文件完整性检查${NC}"

HTML_FILE="$DIST_DIR/index.html"
if [[ ! -f "$HTML_FILE" ]]; then
  fail "index.html 不存在: $HTML_FILE"
else
  pass "index.html 存在"

  # 检查 DOCTYPE
  FIRST_LINE=$(head -1 "$HTML_FILE")
  if echo "$FIRST_LINE" | grep -qi 'DOCTYPE'; then
    pass "HTML 包含 DOCTYPE 声明"
  else
    warn "HTML 缺少 DOCTYPE 声明"
  fi

  # 检查 root div
  if grep -q 'id="root"' "$HTML_FILE"; then
    pass "HTML 包含 <div id=\"root\"> 挂载点"
  else
    fail "HTML 缺少 <div id=\"root\"> 挂载点 — React 无法渲染，将白屏！"
  fi

  # 检查 script 标签
  SCRIPT_REFS=$(grep -oE 'src="[^"]*\.js"' "$HTML_FILE" 2>/dev/null || true)
  if [[ -n "$SCRIPT_REFS" ]]; then
    pass "HTML 引用了 JS 入口文件"
    echo "$SCRIPT_REFS" | while read -r ref; do
      info "  引用: $ref"
    done
  else
    fail "HTML 未引用任何 JS 文件 — 页面无法启动！"
  fi

  # 检查 CSS 引用
  CSS_REFS=$(grep -oE 'href="[^"]*\.css"' "$HTML_FILE" 2>/dev/null || true)
  if [[ -n "$CSS_REFS" ]]; then
    pass "HTML 引用了 CSS 文件"
  else
    warn "HTML 未引用 CSS 文件"
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 3: JS chunk 间循环依赖检测
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[3/6] JS chunk 间循环依赖检测${NC}"

# 创建临时文件存储依赖图
DEP_FILE=$(mktemp)
trap "rm -f $DEP_FILE" EXIT

# 构建依赖图：提取每个 chunk 的 import 语句
for f in "${JS_FILES[@]}"; do
  basename_f="$(basename "$f")"

  # 提取静态 import: from"./xxx.js"
  STATIC_IMPORTS=$(grep -oE 'from"[^"]+\.js"' "$f" 2>/dev/null | sed 's/from"//;s/"$//' || true)

  # 提取动态 import: import("./xxx.js")
  DYNAMIC_IMPORTS=$(grep -oE 'import\("[^"]+\.js"\)' "$f" 2>/dev/null | sed 's/import("//;s/")$//' || true)

  # 提取 __vite__mapDeps 引用: "assets/xxx.js"
  MAP_IMPORTS=""
  if grep -q '__vite__mapDeps' "$f" 2>/dev/null; then
    MAP_IMPORTS=$(grep -oE '"assets/[^"]+\.js"' "$f" 2>/dev/null | sed 's/"assets\///;s/"$//' || true)
  fi

  # 合并所有 import
  ALL_IMPORTS=$(echo -e "${STATIC_IMPORTS}\n${DYNAMIC_IMPORTS}\n${MAP_IMPORTS}" | sort -u | grep -v '^$' || true)

  # 写入依赖文件: chunk dep1 dep2 dep3
  if [[ -n "$ALL_IMPORTS" ]]; then
    echo "$basename_f $ALL_IMPORTS" >> "$DEP_FILE"
  else
    echo "$basename_f" >> "$DEP_FILE"
  fi
done

# 用 Python 做循环检测（更可靠）
if command -v python3 &>/dev/null; then
  CYCLE_RESULT=$(python3 -c "
import sys
from collections import defaultdict

dep_file = '$DEP_FILE'
graph = defaultdict(set)
chunks = set()

with open(dep_file) as f:
    for line in f:
        parts = line.strip().split()
        if not parts:
            continue
        chunk = parts[0]
        chunks.add(chunk)
        for dep in parts[1:]:
            graph[chunk].add(dep)

# Only consider deps that are known chunks
known = set(chunks)

# DFS cycle detection
WHITE, GRAY, BLACK = 0, 1, 2
color = {c: WHITE for c in known}
cycles = []

def dfs(node, path):
    color[node] = GRAY
    for dep in graph.get(node, set()):
        if dep not in known:
            continue
        if color[dep] == GRAY:
            # Found cycle - extract path
            idx = path.index(dep)
            cycle = path[idx:] + [dep]
            cycles.append(cycle)
        elif color[dep] == WHITE:
            dfs(dep, path + [dep])
    color[node] = BLACK

for chunk in sorted(known):
    if color[chunk] == WHITE:
        dfs(chunk, [chunk])

if cycles:
    for i, cycle in enumerate(cycles):
        print(f'CYCLE:{\" → \".join(cycle)}')
else:
    print('NO_CYCLE')

# Also print graph summary
for chunk in sorted(known):
    deps = graph.get(chunk, set()) & known
    if deps:
        print(f'DEP:{chunk} → {\",\".join(sorted(deps))}')
" 2>&1)

  if echo "$CYCLE_RESULT" | grep -q '^CYCLE:'; then
    echo "$CYCLE_RESULT" | grep '^CYCLE:' | while read -r line; do
      cycle_path="${line#CYCLE:}"
      fail "循环依赖检测到: $cycle_path"
    done
  else
    pass "未检测到 chunk 间循环依赖"
  fi

  # 输出依赖图
  DEPS_SHOWN=$(echo "$CYCLE_RESULT" | grep '^DEP:' || true)
  if [[ -n "$DEPS_SHOWN" ]]; then
    echo "$DEPS_SHOWN" | while read -r line; do
      dep_info="${line#DEP:}"
      info "$dep_info"
    done
  fi
else
  # Fallback: 简单的 grep 检测
  warn "python3 不可用，使用简化循环检测"
  
  # 简化检测：检查 A imports B 且 B imports A
  CYCLES_FOUND=0
  for f in "${JS_FILES[@]}"; do
    a=$(basename "$f")
    for g in "${JS_FILES[@]}"; do
      b=$(basename "$g")
      [[ "$a" == "$b" ]] && continue
      # A imports B?
      if grep -q "from\"./$b" "$f" 2>/dev/null; then
        # B imports A?
        if grep -q "from\"./$a" "$g" 2>/dev/null; then
          fail "双向依赖: $a ↔ $b"
          CYCLES_FOUND=$((CYCLES_FOUND + 1))
        fi
      fi
    done
  done
  if [[ $CYCLES_FOUND -eq 0 ]]; then
    pass "未检测到双向依赖（简化检测）"
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 4: class extends 跨 chunk TDZ 风险检测
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[4/6] class extends 跨 chunk TDZ 风险检测${NC}"

if command -v python3 &>/dev/null; then
  TDZ_OUTPUT=$(python3 -c "
import re, os, sys

dist_assets = '$DIST_DIR/assets'
js_files = [f for f in os.listdir(dist_assets) if f.endswith('.js')]
seen = set()

for fname in js_files:
    fpath = os.path.join(dist_assets, fname)
    with open(fpath) as f:
        content = f.read()
    
    # Find extends
    extends_matches = re.findall(r'extends\s+(\w+)', content)
    for cls in extends_matches:
        # Find import source
        import_match = re.search(r'import[^;]*\b' + re.escape(cls) + r'\b[^;]*from\"\.\/([^\"]+\.js)\"', content)
        if import_match:
            source = import_match.group(1)
            source_path = os.path.join(dist_assets, source)
            if os.path.exists(source_path):
                with open(source_path) as sf:
                    source_content = sf.read()
                # Check if source also imports current chunk
                key = (fname, cls, source)
                if 'from\"./' + fname + '\"' in source_content:
                    if key not in seen:
                        seen.add(key)
                        print(f'TDZ:{fname} extends {cls} <- {source} (mutual dep)')
                else:
                    if key not in seen:
                        seen.add(key)
                        print(f'INFO:{fname} extends {cls} <- {source} (safe)')

if not seen:
    print('NO_TDZ')
" 2>&1)

  if echo "$TDZ_OUTPUT" | grep -q '^TDZ:'; then
    echo "$TDZ_OUTPUT" | grep '^TDZ:' | sort -u | while read -r line; do
      msg="${line#TDZ:}"
      fail "TDZ 风险: $msg"
    done
  fi

  # 只显示前 5 条 INFO
  INFO_COUNT=$(echo "$TDZ_OUTPUT" | grep -c '^INFO:' || true)
  echo "$TDZ_OUTPUT" | grep '^INFO:' | sort -u | head -5 | while read -r line; do
    msg="${line#INFO:}"
    info "$msg"
  done
  if [[ $INFO_COUNT -gt 5 ]]; then
    info "... 以及其他 $((INFO_COUNT - 5)) 条安全的 extends 引用"
  fi

  if echo "$TDZ_OUTPUT" | grep -q 'NO_TDZ'; then
    pass "未检测到 class extends 跨 chunk TDZ 风险"
  fi
else
  pass "跳过 TDZ 深度检测（需要 python3）"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 5: modulepreload 与资源引用一致性检查
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[5/6] modulepreload 与资源引用一致性检查${NC}"

if [[ -f "$HTML_FILE" ]]; then
  # 提取 HTML 中所有 JS 引用
  HTML_JS_REFS=$(grep -oE '(src|href)="/assets/[^"]+\.js"' "$HTML_FILE" 2>/dev/null \
    | sed -E 's/(src|href)="\/(assets\/[^"]+\.js)"/\2/' \
    | sort -u || true)

  MISSING_REFS=0
  if [[ -n "$HTML_JS_REFS" ]]; then
    for ref in $HTML_JS_REFS; do
      if [[ ! -f "$DIST_DIR/$ref" ]]; then
        fail "HTML 引用的资源文件不存在: $ref"
        MISSING_REFS=$((MISSING_REFS + 1))
      fi
    done
  fi

  if [[ $MISSING_REFS -eq 0 ]]; then
    pass "HTML 引用的所有 JS 资源文件均存在"
  fi

  # 检查 CSS 引用
  CSS_HREF=$(grep -oE 'href="/assets/[^"]+\.css"' "$HTML_FILE" 2>/dev/null \
    | sed 's/href="\///;s/"$//' || true)
  if [[ -n "$CSS_HREF" ]]; then
    for ref in $CSS_HREF; do
      if [[ ! -f "$DIST_DIR/$ref" ]]; then
        fail "HTML 引用的 CSS 文件不存在: $ref"
      else
        pass "CSS 文件存在: $ref"
      fi
    done
  fi

  # 检查 favicon
  FAVICON_REFS=$(grep -oE 'href="(/[^"]*\.(svg|ico|png))"' "$HTML_FILE" 2>/dev/null | head -1 || true)
  if [[ -n "$FAVICON_REFS" ]]; then
    FAVICON_PATH=$(echo "$FAVICON_REFS" | sed 's/href="//;s/"$//')
    if [[ -f "$DIST_DIR$FAVICON_PATH" ]]; then
      pass "favicon 存在: $FAVICON_PATH"
    else
      # 也检查 public 目录
      if [[ -f "$PROJECT_ROOT/public${FAVICON_PATH}" ]]; then
        pass "favicon 存在于 public 目录"
      else
        warn "favicon 不存在: $FAVICON_PATH (不影响功能但影响体验)"
      fi
    fi
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 检查 6: 关键资源加载失败风险检测
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[6/6] 关键资源加载失败风险检测${NC}"

# 检查外部 CDN 引用
CDN_REFS=$(grep -oE 'https?://[^"]+' "$HTML_FILE" 2>/dev/null | sort -u || true)
if [[ -n "$CDN_REFS" ]]; then
  for ref in $CDN_REFS; do
    warn "外部 CDN 引用: $ref (CDN 不可达可能导致白屏)"
  done
else
  pass "无外部 CDN 依赖"
fi

# 检查动态 import 路径一致性
DYNAMIC_IMPORT_ISSUES=0
for f in "${JS_FILES[@]}"; do
  basename_f="$(basename "$f")"
  dir_of_f="$(dirname "$f")"

  # 检查 __vite__mapDeps 引用
  MAP_REFS=$(grep -oE '"assets/[^"]+\.js"' "$f" 2>/dev/null | sed 's/"//g' || true)
  for ref in $MAP_REFS; do
    if [[ ! -f "$DIST_DIR/$ref" ]]; then
      fail "$basename_f: __vite__mapDeps 引用不存在: $ref"
      DYNAMIC_IMPORT_ISSUES=$((DYNAMIC_IMPORT_ISSUES + 1))
    fi
  done
done

if [[ $DYNAMIC_IMPORT_ISSUES -eq 0 ]]; then
  pass "所有 __vite__mapDeps 引用路径一致"
fi

# 检查 JS chunk 文件完整性（末尾是否截断）
SYNTAX_ISSUES=0
for f in "${JS_FILES[@]}"; do
  LAST_CHAR=$(tail -c 1 "$f" 2>/dev/null | od -An -tx1 | tr -d ' \n' || true)
  # 正常 JS 文件末尾应该是换行符(0a)或分号(3b)或右括号(29/7d/5d)
  if [[ "$LAST_CHAR" != "0a" && "$LAST_CHAR" != "3b" && "$LAST_CHAR" != "29" && "$LAST_CHAR" != "7d" && "$LAST_CHAR" != "5d" ]]; then
    warn "$(basename "$f") 末尾字符异常: 0x${LAST_CHAR} (可能不完整)"
    SYNTAX_ISSUES=$((SYNTAX_ISSUES + 1))
  fi
done

if [[ $SYNTAX_ISSUES -eq 0 ]]; then
  pass "所有 JS chunk 文件末尾完整"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 汇总报告
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  📊 测试汇总${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: ${PASS_COUNT}${NC}"
echo -e "  ${RED}FAIL: ${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}WARN: ${WARN_COUNT}${NC}"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "  ${RED}${BOLD}🚨 结果: FAIL — 发现 ${FAIL_COUNT} 个严重问题，可能导致白屏！${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "  ${GREEN}${BOLD}✨ 结果: PASS — 未发现白屏风险${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  exit 0
fi
