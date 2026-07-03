"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.parseCSV = parseCSV;
exports.toCSV = toCSV;
exports.parseCSVStream = parseCSVStream;
exports.serializeCSVStream = serializeCSVStream;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _es = _interopRequireDefault(require("csv-parse/lib/es5"));
var _sync = _interopRequireDefault(require("csv-parse/lib/es5/sync"));
var _es2 = _interopRequireDefault(require("csv-stringify/lib/es5"));
var _sync2 = _interopRequireDefault(require("csv-stringify/lib/es5/sync"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context; _forEachInstanceProperty(_context = ownKeys(Object(source), true)).call(_context, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source))).call(_context2, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  */
/**
 * @private
 */
function parseCSV(str, options) {
  return (0, _sync.default)(str, _objectSpread(_objectSpread({}, options), {}, {
    columns: true
  }));
}

/**
 * @private
 */
function toCSV(records, options) {
  return (0, _sync2.default)(records, _objectSpread(_objectSpread({}, options), {}, {
    header: true
  }));
}

/**
 * @private
 */
function parseCSVStream(options) {
  return (0, _es.default)(_objectSpread(_objectSpread({}, options), {}, {
    columns: true
  }));
}

/**
 * @private
 */
function serializeCSVStream(options) {
  return (0, _es2.default)(_objectSpread(_objectSpread({}, options), {}, {
    header: true
  }));
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXMiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl9zeW5jIiwiX2VzMiIsIl9zeW5jMiIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJfT2JqZWN0JGtleXMiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eSIsImNhbGwiLCJzeW0iLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsIl9jb250ZXh0IiwiX2ZvckVhY2hJbnN0YW5jZVByb3BlcnR5IiwiT2JqZWN0Iiwia2V5IiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJfT2JqZWN0JGRlZmluZVByb3BlcnRpZXMiLCJfY29udGV4dDIiLCJfT2JqZWN0JGRlZmluZVByb3BlcnR5IiwicGFyc2VDU1YiLCJzdHIiLCJvcHRpb25zIiwiY3N2UGFyc2VTeW5jIiwiY29sdW1ucyIsInRvQ1NWIiwicmVjb3JkcyIsImNzdlN0cmluZ2lmeVN5bmMiLCJoZWFkZXIiLCJwYXJzZUNTVlN0cmVhbSIsImNzdlBhcnNlIiwic2VyaWFsaXplQ1NWU3RyZWFtIiwiY3N2U3RyaW5naWZ5Il0sInNvdXJjZXMiOlsiLi4vc3JjL2Nzdi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqXG4gKi9cbmltcG9ydCB7IFRyYW5zZm9ybSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgY3N2UGFyc2UsIHsgT3B0aW9ucyBhcyBQYXJzZU9wdHMgfSBmcm9tICdjc3YtcGFyc2UvbGliL2VzNSc7XG5pbXBvcnQgY3N2UGFyc2VTeW5jIGZyb20gJ2Nzdi1wYXJzZS9saWIvZXM1L3N5bmMnO1xuaW1wb3J0IGNzdlN0cmluZ2lmeSwgeyBPcHRpb25zIGFzIFN0cmluZ2lmeU9wdHMgfSBmcm9tICdjc3Ytc3RyaW5naWZ5L2xpYi9lczUnO1xuaW1wb3J0IGNzdlN0cmluZ2lmeVN5bmMgZnJvbSAnY3N2LXN0cmluZ2lmeS9saWIvZXM1L3N5bmMnO1xuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNTVihzdHI6IHN0cmluZywgb3B0aW9ucz86IFBhcnNlT3B0cyk6IE9iamVjdFtdIHtcbiAgcmV0dXJuIGNzdlBhcnNlU3luYyhzdHIsIHsgLi4ub3B0aW9ucywgY29sdW1uczogdHJ1ZSB9KTtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9DU1YocmVjb3JkczogT2JqZWN0W10sIG9wdGlvbnM/OiBTdHJpbmdpZnlPcHRzKTogc3RyaW5nIHtcbiAgcmV0dXJuIGNzdlN0cmluZ2lmeVN5bmMocmVjb3JkcywgeyAuLi5vcHRpb25zLCBoZWFkZXI6IHRydWUgfSk7XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ1NWU3RyZWFtKG9wdGlvbnM/OiBQYXJzZU9wdHMpOiBUcmFuc2Zvcm0ge1xuICByZXR1cm4gY3N2UGFyc2UoeyAuLi5vcHRpb25zLCBjb2x1bW5zOiB0cnVlIH0pO1xufVxuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVDU1ZTdHJlYW0ob3B0aW9ucz86IFN0cmluZ2lmeU9wdHMpOiBUcmFuc2Zvcm0ge1xuICByZXR1cm4gY3N2U3RyaW5naWZ5KHsgLi4ub3B0aW9ucywgaGVhZGVyOiB0cnVlIH0pO1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUEsSUFBQUEsR0FBQSxHQUFBQyxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUMsS0FBQSxHQUFBRixzQkFBQSxDQUFBQyxPQUFBO0FB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