// Both packages are ESM-first; require() gives { default: fn }
const _camelcaseKeys = require('camelcase-keys')
const _snakecaseKeys = require('snakecase-keys')
const camelcaseKeys  = _camelcaseKeys.default || _camelcaseKeys
const snakecaseKeys  = _snakecaseKeys.default || _snakecaseKeys

/**
 * Deep-convert snake_case keys → camelCase.
 * Safe on null / primitives / arrays.
 */
function toCamel(data) {
  if (data === null || data === undefined) return data
  if (typeof data !== 'object')           return data
  return camelcaseKeys(data, { deep: true })
}

/**
 * Deep-convert camelCase keys → snake_case.
 * Safe on null / primitives / arrays.
 */
function toSnake(data) {
  if (data === null || data === undefined) return data
  if (typeof data !== 'object')           return data
  return snakecaseKeys(data, { deep: true })
}

module.exports = { toCamel, toSnake }
