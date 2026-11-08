/**
 * @file tokens/base.js
 * @description Node-ESM resolution shim — `.ts` sources import `../base.js`
 * per the bundler-specifier convention; Node's native type stripping does not
 * remap `.js` specifiers to `.ts` files, so build scripts (.mjs) loading those
 * modules fail. Re-exports the authoritative bindings from `base.ts`.
 */
export * from './base.ts'
