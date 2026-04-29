#!/usr/bin/env python3
"""Quick test to verify file operations work"""
import os, shutil

WORKSPACE = '/mnt/user-data/workspace'
eq_target = os.path.join(WORKSPACE, 'src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts')
print('target:', eq_target)
print('exists:', os.path.exists(eq_target))
bak = eq_target + '.bak'
shutil.copy2(eq_target, bak)
print('copy success')
os.remove(bak)
print('cleanup success')
