import os

fixes = [
    ('src/games/three-kingdoms/engine/trade/__tests__/integration/favorites-restock.integration.test.ts', 'import type { CurrencyType } from "../../../../core/currency";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/integration/trade-currency-shop.integration.test.ts', 'import type { CurrencyType } from "../../../../core/currency";'),
    ('src/games/three-kingdoms/engine/shop/__tests__/v8-commerce-integration.test.ts', 'import type { CurrencyType } from "../../core/currency";'),
    ('src/games/three-kingdoms/engine/mail/__tests__/MailSystem-p0-resource.test.ts', 'import type { ISubsystem } from "../../../core/types";'),
    ('src/games/three-kingdoms/engine/__tests__/engine-extended-deps.test.ts', 'import type { ISubsystem } from "../../core/types";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/TradeSystem.test.ts', 'import type { ISystemDeps } from "../../core/types";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/TradeSystem.integration.test.ts', 'import type { ISystemDeps } from "../../core/types";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/integration/price-events-prosperity.integration.test.ts', 'import type { ISystemDeps } from "../../../../core/types";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/integration/trade-events-prosperity.integration.test.ts', 'import type { ISystemDeps } from "../../../../core/types";'),
    ('src/games/three-kingdoms/engine/trade/__tests__/integration/trade-caravan-dispatch.integration.test.ts', 'import type { ISystemDeps } from "../../../../core/types";'),
    ('src/games/three-kingdoms/engine/shop/__tests__/ShopSystem.integration.test.ts', 'import type { ISystemDeps } from "../../core/types";'),
    ('src/games/three-kingdoms/engine/shop/__tests__/v8-commerce-integration.test.ts', 'import type { ISystemDeps } from "../../core/types";'),
    ('src/games/three-kingdoms/engine/hero/__tests__/recruit-token-economy-system.test.ts', 'import type { ISystemDeps } from "../../core/types";'),
]

for filepath, import_line in fixes:
    with open(filepath, 'r') as f:
        lines = f.readlines()
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, import_line + '\n')
    with open(filepath, 'w') as f:
        f.writelines(lines)
    print('Fixed:', filepath)
