#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# acc-check.sh — 三国霸业 ACC 验收标准检查脚本
#
# 用途：版本提交前执行，检查所有ACC验收标准是否全部通过
# 用法：bash scripts/acc-check.sh [--json] [--strict]
#
# 严格模式(--strict)：
#   - 任何 skip/todo 用例视为失败
#   - 任何 ACC 编号未覆盖视为失败
#   - TS 编译错误视为失败
#
# 退出码：
#   0 = 全部通过
#   1 = 存在失败/跳过/遗漏
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── 配置 ──
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACC_DOC_DIR="$PROJECT_ROOT/docs/games/three-kingdoms/acceptance"
ACC_TEST_DIR="$PROJECT_ROOT/src/games/three-kingdoms/tests/acc"
MODULES=(01 02 03 04 05 06 07 08 09 10 11 12 13)
MODULE_NAMES=(
  "主界面" "建筑系统" "资源系统" "武将系统" "招贤馆"
  "编队系统" "战斗系统" "科技系统" "地图关卡" "商店系统"
  "引导系统" "羁绊系统" "觉醒系统"
)
STRICT=true
JSON_OUTPUT=false
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── 参数解析 ──
for arg in "$@"; do
  case $arg in
    --no-strict) STRICT=false ;;
    --json)   JSON_OUTPUT=true ;;
    --help|-h)
      echo "用法: bash scripts/acc-check.sh [--no-strict] [--json]"
      echo "  默认严格模式：skip/todo/遗漏视为失败"
      echo "  --no-strict  宽松模式：仅失败视为失败"
      echo "  --json       输出JSON格式报告"
      exit 0
      ;;
  esac
done

# ── 计数器 ──
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
TOTAL_TODO=0
TOTAL_TESTS=0
TOTAL_MISSING=0
TOTAL_TS_ERRORS=0
declare -a FAILURES=()
declare -a SKIPPED=()
declare -a MISSING=()

# ═══════════════════════════════════════════════════════════════
# 函数定义
# ═══════════════════════════════════════════════════════════════

log_header() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  ACC 验收标准检查 — 三国霸业${NC}"
    echo -e "${BOLD}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""
  fi
}

# 步骤1：检查ACC文档完整性
check_docs() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo -e "${CYAN}[步骤1] 检查ACC验收标准文档完整性...${NC}"
  fi

  local doc_missing=0
  for i in "${!MODULES[@]}"; do
    local mod="${MODULES[$i]}"
    local name="${MODULE_NAMES[$i]}"
    local doc_file="$ACC_DOC_DIR/ACC-${mod}-${name}.md"

    if [[ ! -f "$doc_file" ]]; then
      doc_missing=$((doc_missing + 1))
      MISSING+=("ACC-${mod}-${name}: 验收标准文档缺失")
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${RED}✗${NC} ACC-${mod} ${name} — 文档缺失: $doc_file"
      fi
    else
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${GREEN}✓${NC} ACC-${mod} ${name}"
      fi
    fi
  done

  TOTAL_MISSING=$doc_missing
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
  fi
}

# 步骤2：检查ACC测试文件完整性
check_test_files() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo -e "${CYAN}[步骤2] 检查ACC集成测试文件完整性...${NC}"
  fi

  for i in "${!MODULES[@]}"; do
    local mod="${MODULES[$i]}"
    local name="${MODULE_NAMES[$i]}"
    local test_file="$ACC_TEST_DIR/ACC-${mod}-${name}.test.tsx"

    if [[ ! -f "$test_file" ]]; then
      TOTAL_MISSING=$((TOTAL_MISSING + 1))
      MISSING+=("ACC-${mod}-${name}: 集成测试文件缺失")
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${RED}✗${NC} ACC-${mod} ${name} — 测试文件缺失"
      fi
    else
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${GREEN}✓${NC} ACC-${mod} ${name}.test.tsx"
      fi
    fi
  done

  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
  fi
}

# 步骤3：TypeScript编译检查
check_tsc() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo -e "${CYAN}[步骤3] TypeScript编译检查...${NC}"
  fi

  local ts_output
  ts_output=$(cd "$PROJECT_ROOT" && npx tsc --noEmit 2>&1 | grep "error TS" || true)
  TOTAL_TS_ERRORS=$(echo "$ts_output" | grep -c "error TS" 2>/dev/null | tr -d '[:space:]' || echo "0")
  [[ -z "$TOTAL_TS_ERRORS" ]] && TOTAL_TS_ERRORS=0

  if [[ "$TOTAL_TS_ERRORS" -gt 0 ]]; then
    if [[ "$JSON_OUTPUT" == "false" ]]; then
      echo -e "  ${RED}✗${NC} ${TOTAL_TS_ERRORS} 个编译错误"
      echo "$ts_output" | head -5 | while read -r line; do
        echo -e "    ${DIM}${line}${NC}"
      done
    fi
  else
    if [[ "$JSON_OUTPUT" == "false" ]]; then
      echo -e "  ${GREEN}✓${NC} 零编译错误"
    fi
  fi

  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
  fi
}

# 步骤4：运行ACC测试并解析结果
run_acc_tests() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo -e "${CYAN}[步骤4] 运行ACC集成测试...${NC}"
    echo -e "  ${DIM}(正在执行，请稍候...)${NC}"
  fi

  # 运行vitest并输出JSON结果
  local result_file="$TMP_DIR/vitest-results.json"
  cd "$PROJECT_ROOT" && npx vitest run \
    src/games/three-kingdoms/tests/acc/ \
    --reporter=json \
    --outputFile="$result_file" \
    2>/dev/null || true

  if [[ ! -f "$result_file" ]]; then
    echo -e "  ${RED}✗ 无法获取测试结果${NC}"
    TOTAL_FAIL=1
    return
  fi

  # 解析每个测试用例
  local acc_pattern='\[ACC-[0-9]+-[0-9]+\]'
  local covered_ids=()

  # 提取所有测试结果
  local test_results_json
  test_results_json=$(cat "$result_file")

  # 用node解析JSON（更可靠）
  node -e "
    const data = JSON.parse(require('fs').readFileSync('$result_file', 'utf8'));
    const accPattern = /\[ACC-(\d{2})-(\d{2}[a-z]?)\]/;
    const results = { passed: [], failed: [], skipped: [], todo: [], noAccId: [] };
    const coveredIds = new Set();

    for (const suite of data.testResults || []) {
      for (const test of suite.assertionResults || []) {
        const match = test.title.match(accPattern);
        if (!match) {
          results.noAccId.push({
            file: suite.name.replace('$PROJECT_ROOT/', ''),
            title: test.title,
            status: test.status
          });
          continue;
        }

        const accId = 'ACC-' + match[1] + '-' + match[2];
        coveredIds.add(match[1]); // 模块编号

        const entry = { id: accId, title: test.title, file: suite.name.replace('$PROJECT_ROOT/', '') };

        switch (test.status) {
          case 'passed': results.passed.push(entry); break;
          case 'failed': results.failed.push(entry); break;
          case 'skipped': case 'pending': results.skipped.push(entry); break;
          case 'todo': results.todo.push(entry); break;
          default: results.failed.push({ ...entry, status: test.status }); break;
        }
      }
    }

    // 写入结果文件
    require('fs').writeFileSync('$TMP_DIR/parsed-results.json', JSON.stringify({
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      todo: results.todo,
      noAccId: results.noAccId,
      coveredModules: [...coveredIds].sort()
    }, null, 2));
  " 2>/dev/null || {
    echo -e "  ${RED}✗ JSON解析失败${NC}"
    TOTAL_FAIL=1
    return
  }

  # 读取解析结果
  local parsed="$TMP_DIR/parsed-results.json"
  if [[ ! -f "$parsed" ]]; then
    echo -e "  ${RED}✗ 解析结果文件缺失${NC}"
    TOTAL_FAIL=1
    return
  fi

  local pass_count fail_count skip_count todo_count no_id_count
  pass_count=$(node -e "const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));console.log(d.passed.length)")
  fail_count=$(node -e "const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));console.log(d.failed.length)")
  skip_count=$(node -e "const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));console.log(d.skipped.length)")
  todo_count=$(node -e "const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));console.log(d.todo.length)")
  no_id_count=$(node -e "const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));console.log(d.noAccId.length)")

  TOTAL_PASS=$pass_count
  TOTAL_FAIL=$fail_count
  TOTAL_SKIP=$skip_count
  TOTAL_TODO=$todo_count
  TOTAL_TESTS=$((pass_count + fail_count + skip_count + todo_count))

  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
    echo -e "  ${GREEN}通过: ${pass_count}${NC}  ${RED}失败: ${fail_count}${NC}  ${YELLOW}跳过: ${skip_count}${NC}  ${YELLOW}待办: ${todo_count}${NC}  总计: ${TOTAL_TESTS}"
    echo ""

    # 输出失败详情
    if [[ "$fail_count" -gt 0 ]]; then
      echo -e "  ${RED}${BOLD}失败用例:${NC}"
      node -e "
        const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));
        d.failed.forEach(f => console.log('    ${RED}✗${NC} [' + f.id + '] ' + f.title + '  ${DIM}' + f.file + '${NC}'));
      "
      echo ""
    fi

    # 输出跳过详情
    if [[ "$skip_count" -gt 0 ]]; then
      echo -e "  ${YELLOW}${BOLD}跳过用例:${NC}"
      node -e "
        const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));
        d.skipped.forEach(s => console.log('    ${YELLOW}⊘${NC} [' + s.id + '] ' + s.title));
      "
      echo ""
    fi

    # 输出待办详情
    if [[ "$todo_count" -gt 0 ]]; then
      echo -e "  ${YELLOW}${BOLD}待办用例:${NC}"
      node -e "
        const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));
        d.todo.forEach(t => console.log('    ${YELLOW}⊡${NC} [' + t.id + '] ' + t.title));
      "
      echo ""
    fi

    # 输出无ACC编号的用例
    if [[ "$no_id_count" -gt 0 ]]; then
      echo -e "  ${YELLOW}${BOLD}未标注ACC编号的用例:${NC}"
      node -e "
        const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));
        d.noAccId.forEach(n => console.log('    ${YELLOW}?${NC} ' + n.title + '  ${DIM}' + n.file + '${NC}'));
      "
      echo ""
    fi
  fi
}

# 步骤5：检查ACC编号覆盖完整性
check_coverage() {
  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo -e "${CYAN}[步骤5] 检查ACC编号覆盖完整性...${NC}"
  fi

  local parsed="$TMP_DIR/parsed-results.json"
  if [[ ! -f "$parsed" ]]; then
    return
  fi

  # 检查每个模块是否有测试覆盖
  local covered_modules
  covered_modules=$(node -e "
    const d=JSON.parse(require('fs').readFileSync('$parsed','utf8'));
    console.log(d.coveredModules.join(','));
  " 2>/dev/null || echo "")

  for i in "${!MODULES[@]}"; do
    local mod="${MODULES[$i]}"
    local name="${MODULE_NAMES[$i]}"

    if echo "$covered_modules" | grep -q "$mod"; then
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${GREEN}✓${NC} ACC-${mod} ${name} — 已覆盖"
      fi
    else
      TOTAL_MISSING=$((TOTAL_MISSING + 1))
      MISSING+=("ACC-${mod}-${name}: 无测试用例覆盖")
      if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "  ${RED}✗${NC} ACC-${mod} ${name} — ${RED}无测试覆盖${NC}"
      fi
    fi
  done

  if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo ""
  fi
}

# ═══════════════════════════════════════════════════════════════
# 输出最终结果
# ═══════════════════════════════════════════════════════════════
print_summary() {
  # 严格模式下skip/todo视为失败
  local effective_fail=$TOTAL_FAIL
  if [[ "$STRICT" == "true" ]]; then
    effective_fail=$((TOTAL_FAIL + TOTAL_SKIP + TOTAL_TODO))
  fi

  if [[ "$JSON_OUTPUT" == "true" ]]; then
    node -e "
      const result = {
        timestamp: new Date().toISOString(),
        strict: $STRICT,
        summary: {
          total: $TOTAL_TESTS,
          passed: $TOTAL_PASS,
          failed: $TOTAL_FAIL,
          skipped: $TOTAL_SKIP,
          todo: $TOTAL_TODO,
          missing: $TOTAL_MISSING,
          tsErrors: $TOTAL_TS_ERRORS,
          effectiveFailed: $effective_fail
        },
        passed: $effective_fail === 0 && $TOTAL_MISSING === 0 && $TOTAL_TS_ERRORS === 0,
        failures: $(cat "$TMP_DIR/parsed-results.json" 2>/dev/null | node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).failed))" 2>/dev/null || echo '[]'),
        skipped: $(cat "$TMP_DIR/parsed-results.json" 2>/dev/null | node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).skipped))" 2>/dev/null || echo '[]'),
        todo: $(cat "$TMP_DIR/parsed-results.json" 2>/dev/null | node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).todo))" 2>/dev/null || echo '[]'),
        missing: $(echo "${MISSING[*]}" | node -e "
          const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
          process.stdout.write(JSON.stringify(s ? s.split(' ') : []));
        " 2>/dev/null || echo '[]')
      };
      console.log(JSON.stringify(result, null, 2));
    "
    return
  fi

  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  检查结果汇总${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  测试用例:  ${GREEN}通过 ${TOTAL_PASS}${NC} / ${TOTAL_TESTS}"
  if [[ "$TOTAL_FAIL" -gt 0 ]]; then
    echo -e "  失败用例:  ${RED}${TOTAL_FAIL}${NC}"
  fi
  if [[ "$TOTAL_SKIP" -gt 0 ]]; then
    echo -e "  跳过用例:  ${YELLOW}${TOTAL_SKIP}${NC}"
  fi
  if [[ "$TOTAL_TODO" -gt 0 ]]; then
    echo -e "  待办用例:  ${YELLOW}${TOTAL_TODO}${NC}"
  fi
  if [[ "$TOTAL_MISSING" -gt 0 ]]; then
    echo -e "  遗漏项:    ${RED}${TOTAL_MISSING}${NC}"
  fi
  if [[ "$TOTAL_TS_ERRORS" -gt 0 ]]; then
    echo -e "  TS错误:    ${RED}${TOTAL_TS_ERRORS}${NC}"
  fi
  echo ""

  # 最终判定
  local all_pass=true
  if [[ "$effective_fail" -gt 0 ]]; then all_pass=false; fi
  if [[ "$TOTAL_MISSING" -gt 0 ]]; then all_pass=false; fi
  if [[ "$TOTAL_TS_ERRORS" -gt 0 ]]; then all_pass=false; fi

  if [[ "$all_pass" == "true" ]]; then
    echo -e "  ${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║   ✓ ACC 验收检查全部通过 — 可以提交    ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${DIM}提示: 使用 --no-strict 切换为宽松模式${NC}"
  else
    echo -e "  ${RED}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "  ${RED}${BOLD}║   ✗ ACC 验收检查未通过 — 禁止提交       ║${NC}"
    echo -e "  ${RED}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo ""
    if [[ "$TOTAL_FAIL" -gt 0 ]]; then
      echo -e "  ${RED}→ 存在 ${TOTAL_FAIL} 个失败用例，必须修复后才能提交${NC}"
    fi
    if [[ "$TOTAL_SKIP" -gt 0 || "$TOTAL_TODO" -gt 0 ]]; then
      echo -e "  ${YELLOW}→ 存在 ${TOTAL_SKIP} 个跳过 + ${TOTAL_TODO} 个待办用例${NC}"
      if [[ "$STRICT" == "true" ]]; then
        echo -e "  ${YELLOW}→ 严格模式下跳过/待办视为失败，必须修复${NC}"
      fi
    fi
    if [[ "$TOTAL_MISSING" -gt 0 ]]; then
      echo -e "  ${RED}→ 存在 ${TOTAL_MISSING} 个遗漏项（文档或测试文件缺失）${NC}"
    fi
    if [[ "$TOTAL_TS_ERRORS" -gt 0 ]]; then
      echo -e "  ${RED}→ 存在 ${TOTAL_TS_ERRORS} 个TS编译错误${NC}"
    fi
  fi

  echo ""
}

# ═══════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════
main() {
  log_header
  check_docs
  check_test_files
  check_tsc
  run_acc_tests
  check_coverage
  print_summary

  # 退出码
  local effective_fail=$TOTAL_FAIL
  if [[ "$STRICT" == "true" ]]; then
    effective_fail=$((TOTAL_FAIL + TOTAL_SKIP + TOTAL_TODO))
  fi

  if [[ "$effective_fail" -gt 0 || "$TOTAL_MISSING" -gt 0 || "$TOTAL_TS_ERRORS" -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main
