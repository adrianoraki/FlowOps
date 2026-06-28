// metro.config.js — resolve @flowops/types do monorepo
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Observa toda a raiz do monorepo (para hot-reload ao editar packages/types)
config.watchFolders = [monorepoRoot]

// Resolve node_modules tanto do app quanto da raiz do monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Necessário para que links simbólicos (npm workspaces) sejam resolvidos corretamente
config.resolver.disableHierarchicalLookup = true

module.exports = config
