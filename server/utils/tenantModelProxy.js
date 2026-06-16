/**
 * ============================================================================
 * Tenant Model Proxy
 * ============================================================================
 *
 * Wraps a master mongoose Model with a Proxy that, on every access, checks
 * the active tenant context (see tenantContext.js):
 *
 *   - If a tenant connection is in context, the operation is routed to a
 *     model compiled on that connection (cached per-connection).
 *   - Otherwise, the operation falls through to the master model.
 *
 * The proxy is transparent: existing call sites (Deal.find, new Task(...),
 * Event.create(...), Person.aggregate(...)) keep working without changes.
 *
 * Construction (`new Model(...)`) is the most important trap - we have to
 * create the document via the tenant-bound model so `.save()` writes to the
 * tenant DB.
 *
 * Master-only models should NOT be wrapped (call sites must always hit
 * master): see docs in this file's bottom matter.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { getTenantConnection } = require('./tenantContext');

function collectReferencedModelNames(schema) {
    const refs = new Set();
    if (!schema || typeof schema.eachPath !== 'function') {
        return refs;
    }

    schema.eachPath((_pathName, schemaType) => {
        const directRef = schemaType?.options?.ref;
        if (typeof directRef === 'string' && directRef) {
            refs.add(directRef);
        }

        const casterRef = schemaType?.caster?.options?.ref;
        if (typeof casterRef === 'string' && casterRef) {
            refs.add(casterRef);
        }
    });

    return refs;
}

/**
 * Compile / return a cached Model on the tenant connection that mirrors the
 * master model's schema (including methods, statics, and indexes). The
 * connection retains its own model registry, so we re-use the cached entry on
 * subsequent calls.
 */
function getModelOnConnection(connection, masterModel, visiting = new Set()) {
    const modelName = masterModel.modelName;
    if (connection.models[modelName]) {
        return connection.models[modelName];
    }
    if (visiting.has(modelName)) {
        return connection.models[modelName] || masterModel;
    }
    visiting.add(modelName);

    const sourceSchema = masterModel.schema;
    const cloned = new mongoose.Schema(sourceSchema.obj, sourceSchema.options);

    if (sourceSchema.methods) {
        for (const k of Object.keys(sourceSchema.methods)) {
            cloned.methods[k] = sourceSchema.methods[k];
        }
    }
    if (sourceSchema.statics) {
        for (const k of Object.keys(sourceSchema.statics)) {
            cloned.statics[k] = sourceSchema.statics[k];
        }
    }
    if (sourceSchema._indexes && Array.isArray(sourceSchema._indexes)) {
        for (const idx of sourceSchema._indexes) {
            cloned.index(idx[0], idx[1]);
        }
    }
    if (sourceSchema.virtuals) {
        for (const v of Object.keys(sourceSchema.virtuals)) {
            const virtual = sourceSchema.virtuals[v];
            if (!virtual) continue;
            const path = cloned.virtual(v, virtual.options);
            if (typeof virtual.getters?.[0] === 'function') path.get(virtual.getters[0]);
            if (typeof virtual.setters?.[0] === 'function') path.set(virtual.setters[0]);
        }
    }
    if (sourceSchema.s?.hooks) {
        // Best-effort: forward query/document/aggregate hooks if mongoose exposes them.
        try {
            const hooks = sourceSchema.s.hooks._pres;
            if (hooks) {
                for (const [name, fns] of hooks.entries()) {
                    for (const fn of fns) {
                        cloned.pre(name, fn.fn || fn);
                    }
                }
            }
            const postHooks = sourceSchema.s.hooks._posts;
            if (postHooks) {
                for (const [name, fns] of postHooks.entries()) {
                    for (const fn of fns) {
                        cloned.post(name, fn.fn || fn);
                    }
                }
            }
        } catch (_e) {
            /* hooks are best-effort */
        }
    }

    const tenantModel = connection.model(modelName, cloned);

    // Ensure populate refs are available on tenant connection to avoid
    // MissingSchemaError during tenant-scoped queries.
    const refNames = collectReferencedModelNames(sourceSchema);
    for (const refName of refNames) {
        if (refName === modelName || connection.models[refName]) continue;
        const masterRefModel = mongoose.models[refName];
        if (!masterRefModel || !masterRefModel.schema) continue;
        try {
            getModelOnConnection(connection, masterRefModel, visiting);
        } catch (_err) {
            // Best-effort: skip unresolved refs and let callers continue.
        }
    }

    visiting.delete(modelName);
    return tenantModel;
}

/**
 * Resolve the right model for the current async context.
 * Falls back to the master model when no tenant context is active or the
 * tenant connection isn't ready.
 */
function resolveModel(masterModel) {
    const connection = getTenantConnection();
    if (!connection || connection.readyState !== 1) {
        return masterModel;
    }
    // The master mongoose connection is the default connection used by
    // require('../models/X'). If the tenant context happens to be the same
    // master connection (e.g. master org without a dedicated DB), short-circuit.
    if (connection === mongoose.connection) {
        return masterModel;
    }
    return getModelOnConnection(connection, masterModel);
}

/**
 * Wrap a master mongoose Model with the routing Proxy.
 * The returned object is callable, constructible, and exposes all model
 * properties exactly like the underlying Model.
 */
function wrapTenantModel(masterModel) {
    if (!masterModel || typeof masterModel !== 'function' || !masterModel.schema) {
        throw new Error('wrapTenantModel: expected a mongoose Model');
    }

    // Mongoose Models are callable functions, so a Proxy with construct/apply
    // traps gives us the right semantics for `new Model()` and the rare
    // `Model()` invocation. Property access is forwarded via the get trap.
    const handler = {
        get(target, prop, receiver) {
            // Always expose a marker so callers can detect a wrapped model.
            if (prop === '__isTenantProxy') return true;
            if (prop === '__masterModel') return target;

            const M = resolveModel(target);
            const value = Reflect.get(M, prop, M);

            // For methods, bind to M so `this` inside a static method refers
            // to the resolved model (master or tenant).
            if (typeof value === 'function') {
                return value.bind(M);
            }
            return value;
        },
        set(target, prop, value) {
            // Mutations on the model object (rare, but happens for `model.foo = x`)
            // are applied to the master model so they're visible everywhere.
            return Reflect.set(target, prop, value);
        },
        has(target, prop) {
            const M = resolveModel(target);
            return prop in M;
        },
        getPrototypeOf(target) {
            const M = resolveModel(target);
            return Object.getPrototypeOf(M);
        },
        construct(target, args, newTarget) {
            const M = resolveModel(target);
            return Reflect.construct(M, args, newTarget === handler ? M : newTarget);
        },
        apply(target, thisArg, args) {
            const M = resolveModel(target);
            return Reflect.apply(M, thisArg, args);
        }
    };

    return new Proxy(masterModel, handler);
}

module.exports = {
    wrapTenantModel,
    resolveModel,
    getModelOnConnection
};
