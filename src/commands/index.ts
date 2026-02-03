/**
 * Commands Index
 * Export all commands
 */

export { initCommand } from './init.js';
export { addCommand, type ExtendedAddOptions } from './add.js';
export { statusCommand } from './status.js';
export { syncCommand } from './sync.js';
export { cleanCommand } from './clean.js';
export { updateCommand, type UpdateOptions } from './update.js';
export { generateCommand, type GenerateOptions } from './generate.js';
export { authCommand, loadApiKeyFromConfig, type AuthOptions } from './auth.js';
export { doctorCommand } from './doctor.js';
