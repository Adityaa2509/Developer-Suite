"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Cache = void 0;
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _events = require("events");
/**
 * @file Manages asynchronous method response cache
 * @author Shinichi Tomita <shinichi.tomita@gmail.com>
 */

/**
 * type def
 */

/**
 * Class for managing cache entry
 *
 * @private
 * @class
 * @constructor
 * @template T
 */
class CacheEntry extends _events.EventEmitter {
  constructor(...args) {
    super(...args);
    (0, _defineProperty2.default)(this, "_fetching", false);
    (0, _defineProperty2.default)(this, "_value", undefined);
  }
  /**
   * Get value in the cache entry
   *
   * @param {() => Promise<T>} [callback] - Callback function callbacked the cache entry updated
   * @returns {T|undefined}
   */
  get(callback) {
    if (callback) {
      const cb = callback;
      this.once('value', v => cb(v));
      if (typeof this._value !== 'undefined') {
        this.emit('value', this._value);
      }
    }
    return this._value;
  }

  /**
   * Set value in the cache entry
   */
  set(value) {
    this._value = value;
    this.emit('value', this._value);
  }

  /**
   * Clear cached value
   */
  clear() {
    this._fetching = false;
    this._value = undefined;
  }
}

/**
 * create and return cache key from namespace and serialized arguments.
 * @private
 */
function createCacheKey(namespace, args) {
  var _context;
  return `${namespace || ''}(${(0, _map.default)(_context = [...args]).call(_context, a => (0, _stringify.default)(a)).join(',')})`;
}
function generateKeyString(options, scope, args) {
  return typeof options.key === 'string' ? options.key : typeof options.key === 'function' ? options.key.apply(scope, args) : createCacheKey(options.namespace, args);
}

/**
 * Caching manager for async methods
 *
 * @class
 * @constructor
 */
class Cache {
  constructor() {
    (0, _defineProperty2.default)(this, "_entries", {});
  }
  /**
   * retrive cache entry, or create if not exists.
   *
   * @param {String} [key] - Key of cache entry
   * @returns {CacheEntry}
   */
  get(key) {
    if (this._entries[key]) {
      return this._entries[key];
    }
    const entry = new CacheEntry();
    this._entries[key] = entry;
    return entry;
  }

  /**
   * clear cache entries prefix matching given key
   */
  clear(key) {
    for (const k of (0, _keys.default)(this._entries)) {
      if (!key || (0, _indexOf.default)(k).call(k, key) === 0) {
        this._entries[k].clear();
      }
    }
  }

  /**
   * Enable caching for async call fn to lookup the response cache first,
   * then invoke original if no cached value.
   */
  createCachedFunction(fn, scope, options = {
    strategy: 'NOCACHE'
  }) {
    const strategy = options.strategy;
    const $fn = (...args) => {
      const key = generateKeyString(options, scope, args);
      const entry = this.get(key);
      const executeFetch = async () => {
        entry._fetching = true;
        try {
          const result = await fn.apply(scope || this, args);
          entry.set({
            error: undefined,
            result
          });
          return result;
        } catch (error) {
          entry.set({
            error: error,
            result: undefined
          });
          throw error;
        }
      };
      let value;
      switch (strategy) {
        case 'IMMEDIATE':
          value = entry.get();
          if (!value) {
            throw new Error('Function call result is not cached yet.');
          }
          if (value.error) {
            throw value.error;
          }
          return value.result;
        case 'HIT':
          return (async () => {
            if (!entry._fetching) {
              // only when no other client is calling function
              await executeFetch();
            }
            return new _promise.default((resolve, reject) => {
              entry.get(({
                error,
                result
              }) => {
                if (error) reject(error);else resolve(result);
              });
            });
          })();
        case 'NOCACHE':
        default:
          return executeFetch();
      }
    };
    $fn.clear = (...args) => {
      const key = generateKeyString(options, scope, args);
      this.clear(key);
    };
    return $fn;
  }
}
exports.Cache = Cache;
var _default = Cache;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIkNhY2hlRW50cnkiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsImFyZ3MiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsInVuZGVmaW5lZCIsImdldCIsImNhbGxiYWNrIiwiY2IiLCJvbmNlIiwidiIsIl92YWx1ZSIsImVtaXQiLCJzZXQiLCJ2YWx1ZSIsImNsZWFyIiwiX2ZldGNoaW5nIiwiY3JlYXRlQ2FjaGVLZXkiLCJuYW1lc3BhY2UiLCJfY29udGV4dCIsIl9tYXAiLCJjYWxsIiwiYSIsIl9zdHJpbmdpZnkiLCJqb2luIiwiZ2VuZXJhdGVLZXlTdHJpbmciLCJvcHRpb25zIiwic2NvcGUiLCJrZXkiLCJhcHBseSIsIkNhY2hlIiwiX2VudHJpZXMiLCJlbnRyeSIsImsiLCJfa2V5cyIsIl9pbmRleE9mIiwiY3JlYXRlQ2FjaGVkRnVuY3Rpb24iLCJmbiIsInN0cmF0ZWd5IiwiJGZuIiwiZXhlY3V0ZUZldGNoIiwicmVzdWx0IiwiZXJyb3IiLCJFcnJvciIsIl9wcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImV4cG9ydHMiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9jYWNoZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIE1hbmFnZXMgYXN5bmNocm9ub3VzIG1ldGhvZCByZXNwb25zZSBjYWNoZVxuICogQGF1dGhvciBTaGluaWNoaSBUb21pdGEgPHNoaW5pY2hpLnRvbWl0YUBnbWFpbC5jb20+XG4gKi9cbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5cbi8qKlxuICogdHlwZSBkZWZcbiAqL1xuZXhwb3J0IHR5cGUgQ2FjaGluZ09wdGlvbnMgPSB7XG4gIGtleT86IHN0cmluZyB8ICgoLi4uYXJnczogYW55W10pID0+IHN0cmluZyk7XG4gIG5hbWVzcGFjZT86IHN0cmluZztcbiAgc3RyYXRlZ3k6ICdOT0NBQ0hFJyB8ICdISVQnIHwgJ0lNTUVESUFURSc7XG59O1xuXG50eXBlIENhY2hlVmFsdWU8VD4gPSB7XG4gIGVycm9yPzogRXJyb3I7XG4gIHJlc3VsdDogVDtcbn07XG5cbmV4cG9ydCB0eXBlIENhY2hlZEZ1bmN0aW9uPEZuPiA9IEZuICYgeyBjbGVhcjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkIH07XG5cbi8qKlxuICogQ2xhc3MgZm9yIG1hbmFnaW5nIGNhY2hlIGVudHJ5XG4gKlxuICogQHByaXZhdGVcbiAqIEBjbGFzc1xuICogQGNvbnN0cnVjdG9yXG4gKiBAdGVtcGxhdGUgVFxuICovXG5jbGFzcyBDYWNoZUVudHJ5PFQ+IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgX2ZldGNoaW5nOiBib29sZWFuID0gZmFsc2U7XG4gIF92YWx1ZTogQ2FjaGVWYWx1ZTxUPiB8IHZvaWQgPSB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIEdldCB2YWx1ZSBpbiB0aGUgY2FjaGUgZW50cnlcbiAgICpcbiAgICogQHBhcmFtIHsoKSA9PiBQcm9taXNlPFQ+fSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgZnVuY3Rpb24gY2FsbGJhY2tlZCB0aGUgY2FjaGUgZW50cnkgdXBkYXRlZFxuICAgKiBAcmV0dXJucyB7VHx1bmRlZmluZWR9XG4gICAqL1xuICBnZXQoY2FsbGJhY2s/OiAodjogVCkgPT4gYW55KTogQ2FjaGVWYWx1ZTxUPiB8IHZvaWQge1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY29uc3QgY2IgPSBjYWxsYmFjaztcbiAgICAgIHRoaXMub25jZSgndmFsdWUnLCAodjogVCkgPT4gY2IodikpO1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLl92YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5lbWl0KCd2YWx1ZScsIHRoaXMuX3ZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB2YWx1ZSBpbiB0aGUgY2FjaGUgZW50cnlcbiAgICovXG4gIHNldCh2YWx1ZTogQ2FjaGVWYWx1ZTxUPikge1xuICAgIHRoaXMuX3ZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy5lbWl0KCd2YWx1ZScsIHRoaXMuX3ZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhciBjYWNoZWQgdmFsdWVcbiAgICovXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuX2ZldGNoaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fdmFsdWUgPSB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBjcmVhdGUgYW5kIHJldHVybiBjYWNoZSBrZXkgZnJvbSBuYW1lc3BhY2UgYW5kIHNlcmlhbGl6ZWQgYXJndW1lbnRzLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2FjaGVLZXkobmFtZXNwYWNlOiBzdHJpbmcgfCB2b2lkLCBhcmdzOiBhbnlbXSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtuYW1lc3BhY2UgfHwgJyd9KCR7Wy4uLmFyZ3NdXG4gICAgLm1hcCgoYSkgPT4gSlNPTi5zdHJpbmdpZnkoYSkpXG4gICAgLmpvaW4oJywnKX0pYDtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVLZXlTdHJpbmcoXG4gIG9wdGlvbnM6IENhY2hpbmdPcHRpb25zLFxuICBzY29wZTogYW55LFxuICBhcmdzOiBhbnlbXSxcbik6IHN0cmluZyB7XG4gIHJldHVybiB0eXBlb2Ygb3B0aW9ucy5rZXkgPT09ICdzdHJpbmcnXG4gICAgPyBvcHRpb25zLmtleVxuICAgIDogdHlwZW9mIG9wdGlvbnMua2V5ID09PSAnZnVuY3Rpb24nXG4gICAgPyBvcHRpb25zLmtleS5hcHBseShzY29wZSwgYXJncylcbiAgICA6IGNyZWF0ZUNhY2hlS2V5KG9wdGlvbnMubmFtZXNwYWNlLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBDYWNoaW5nIG1hbmFnZXIgZm9yIGFzeW5jIG1ldGhvZHNcbiAqXG4gKiBAY2xhc3NcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5leHBvcnQgY2xhc3MgQ2FjaGUge1xuICBwcml2YXRlIF9lbnRyaWVzOiB7IFtrZXk6IHN0cmluZ106IENhY2hlRW50cnk8YW55PiB9ID0ge307XG5cbiAgLyoqXG4gICAqIHJldHJpdmUgY2FjaGUgZW50cnksIG9yIGNyZWF0ZSBpZiBub3QgZXhpc3RzLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2tleV0gLSBLZXkgb2YgY2FjaGUgZW50cnlcbiAgICogQHJldHVybnMge0NhY2hlRW50cnl9XG4gICAqL1xuICBnZXQoa2V5OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5fZW50cmllc1trZXldKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZW50cmllc1trZXldO1xuICAgIH1cbiAgICBjb25zdCBlbnRyeSA9IG5ldyBDYWNoZUVudHJ5KCk7XG4gICAgdGhpcy5fZW50cmllc1trZXldID0gZW50cnk7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIGNsZWFyIGNhY2hlIGVudHJpZXMgcHJlZml4IG1hdGNoaW5nIGdpdmVuIGtleVxuICAgKi9cbiAgY2xlYXIoa2V5Pzogc3RyaW5nKSB7XG4gICAgZm9yIChjb25zdCBrIG9mIE9iamVjdC5rZXlzKHRoaXMuX2VudHJpZXMpKSB7XG4gICAgICBpZiAoIWtleSB8fCBrLmluZGV4T2Yoa2V5KSA9PT0gMCkge1xuICAgICAgICB0aGlzLl9lbnRyaWVzW2tdLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVuYWJsZSBjYWNoaW5nIGZvciBhc3luYyBjYWxsIGZuIHRvIGxvb2t1cCB0aGUgcmVzcG9uc2UgY2FjaGUgZmlyc3QsXG4gICAqIHRoZW4gaW52b2tlIG9yaWdpbmFsIGlmIG5vIGNhY2hlZCB2YWx1ZS5cbiAgICovXG4gIGNyZWF0ZUNhY2hlZEZ1bmN0aW9uPEZuIGV4dGVuZHMgRnVuY3Rpb24+KFxuICAgIGZuOiBGbixcbiAgICBzY29wZTogYW55LFxuICAgIG9wdGlvbnM6IENhY2hpbmdPcHRpb25zID0geyBzdHJhdGVneTogJ05PQ0FDSEUnIH0sXG4gICk6IENhY2hlZEZ1bmN0aW9uPEZuPiB7XG4gICAgY29uc3Qgc3RyYXRlZ3kgPSBvcHRpb25zLnN0cmF0ZWd5O1xuICAgIGNvbnN0ICRmbjogYW55ID0gKC4uLmFyZ3M6IGFueVtdKSA9PiB7XG4gICAgICBjb25zdCBrZXkgPSBnZW5lcmF0ZUtleVN0cmluZyhvcHRpb25zLCBzY29wZSwgYXJncyk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICBjb25zdCBleGVjdXRlRmV0Y2ggPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGVudHJ5Ll9mZXRjaGluZyA9IHRydWU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZm4uYXBwbHkoc2NvcGUgfHwgdGhpcywgYXJncyk7XG4gICAgICAgICAgZW50cnkuc2V0KHsgZXJyb3I6IHVuZGVmaW5lZCwgcmVzdWx0IH0pO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgZW50cnkuc2V0KHsgZXJyb3I6IGVycm9yIGFzIEVycm9yLCByZXN1bHQ6IHVuZGVmaW5lZCB9KTtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGxldCB2YWx1ZTtcbiAgICAgIHN3aXRjaCAoc3RyYXRlZ3kpIHtcbiAgICAgICAgY2FzZSAnSU1NRURJQVRFJzpcbiAgICAgICAgICB2YWx1ZSA9IGVudHJ5LmdldCgpO1xuICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRnVuY3Rpb24gY2FsbCByZXN1bHQgaXMgbm90IGNhY2hlZCB5ZXQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2YWx1ZS5lcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgdmFsdWUuZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB2YWx1ZS5yZXN1bHQ7XG4gICAgICAgIGNhc2UgJ0hJVCc6XG4gICAgICAgICAgcmV0dXJuIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWVudHJ5Ll9mZXRjaGluZykge1xuICAgICAgICAgICAgICAvLyBvbmx5IHdoZW4gbm8gb3RoZXIgY2xpZW50IGlzIGNhbGxpbmcgZnVuY3Rpb25cbiAgICAgICAgICAgICAgYXdhaXQgZXhlY3V0ZUZldGNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBlbnRyeS5nZXQoKHsgZXJyb3IsIHJlc3VsdCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIGNhc2UgJ05PQ0FDSEUnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBleGVjdXRlRmV0Y2goKTtcbiAgICAgIH1cbiAgICB9O1xuICAgICRmbi5jbGVhciA9ICguLi5hcmdzOiBhbnlbXSkgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gZ2VuZXJhdGVLZXlTdHJpbmcob3B0aW9ucywgc2NvcGUsIGFyZ3MpO1xuICAgICAgdGhpcy5jbGVhcihrZXkpO1xuICAgIH07XG4gICAgcmV0dXJuICRmbiBhcyBDYWNoZWRGdW5jdGlvbjxGbj47XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ2FjaGU7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFKQTtBQUNBO0FBQ0E7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7O0FBY0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1B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