// Define interfaces using JSDoc for CommonJS compatibility
/**
 * @typedef {Object} PlayerLocation
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} PlayerRotation
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} PlayerData
 * @property {"playerData"} type
 * @property {string} name
 * @property {PlayerLocation} location
 * @property {PlayerRotation} rotation
 * @property {boolean} isSpectator
 */

/**
 * @typedef {PlayerData} TagData
 */

// No actual exports needed as we're using JSDoc for type definitions
module.exports = {};