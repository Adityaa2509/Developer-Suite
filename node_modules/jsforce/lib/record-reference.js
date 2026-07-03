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
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.RecordReference = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context; _forEachInstanceProperty(_context = ownKeys(Object(source), true)).call(_context, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source))).call(_context2, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; }
/**
 *
 */

/**
 * Remote reference to record information
 */
class RecordReference {
  /**
   *
   */
  constructor(conn, type, id) {
    (0, _defineProperty2.default)(this, "type", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    this._conn = conn;
    this.type = type;
    this.id = id;
  }

  /**
   * Retrieve record field information
   */
  async retrieve(options) {
    const rec = await this._conn.retrieve(this.type, this.id, options);
    return rec;
  }

  /**
   * Update record field information
   */
  async update(record, options) {
    const record_ = _objectSpread(_objectSpread({}, record), {}, {
      Id: this.id
    });
    return this._conn.update(this.type, record_, options);
  }

  /**
   * Delete record field
   */
  destroy(options) {
    return this._conn.destroy(this.type, this.id, options);
  }

  /**
   * Synonym of Record#destroy()
   */

  /**
   * Synonym of Record#destroy()
   */

  /**
   * Get blob field as stream
   *
   * @param {String} fieldName - Blob field name
   * @returns {stream.Stream}
   */
  blob(fieldName) {
    const url = [this._conn._baseUrl(), 'sobjects', this.type, this.id, fieldName].join('/');
    return this._conn.request(url).stream();
  }
}
exports.RecordReference = RecordReference;
var _default = RecordReference;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWNvcmRSZWZlcmVuY2UiLCJjb25zdHJ1Y3RvciIsImNvbm4iLCJ0eXBlIiwiaWQiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsImRlc3Ryb3kiLCJfY29ubiIsInJldHJpZXZlIiwib3B0aW9ucyIsInJlYyIsInVwZGF0ZSIsInJlY29yZCIsInJlY29yZF8iLCJfb2JqZWN0U3ByZWFkIiwiSWQiLCJibG9iIiwiZmllbGROYW1lIiwidXJsIiwiX2Jhc2VVcmwiLCJqb2luIiwicmVxdWVzdCIsInN0cmVhbSIsImV4cG9ydHMiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWNvcmQtcmVmZXJlbmNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICpcbiAqL1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi9jb25uZWN0aW9uJztcbmltcG9ydCB7XG4gIFJldHJpZXZlT3B0aW9ucyxcbiAgRG1sT3B0aW9ucyxcbiAgU2NoZW1hLFxuICBTT2JqZWN0TmFtZXMsXG4gIFNPYmplY3RJbnB1dFJlY29yZCxcbiAgU09iamVjdFVwZGF0ZVJlY29yZCxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbi8qKlxuICogUmVtb3RlIHJlZmVyZW5jZSB0byByZWNvcmQgaW5mb3JtYXRpb25cbiAqL1xuZXhwb3J0IGNsYXNzIFJlY29yZFJlZmVyZW5jZTxcbiAgUyBleHRlbmRzIFNjaGVtYSxcbiAgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPixcbiAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gIFJldHJpZXZlUmVjb3JkIGV4dGVuZHMgU09iamVjdFVwZGF0ZVJlY29yZDxTLCBOPiA9IFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj5cbj4ge1xuICB0eXBlOiBOO1xuICBpZDogc3RyaW5nO1xuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbm46IENvbm5lY3Rpb248Uz4sIHR5cGU6IE4sIGlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9jb25uID0gY29ubjtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSByZWNvcmQgZmllbGQgaW5mb3JtYXRpb25cbiAgICovXG4gIGFzeW5jIHJldHJpZXZlKG9wdGlvbnM/OiBSZXRyaWV2ZU9wdGlvbnMpIHtcbiAgICBjb25zdCByZWMgPSBhd2FpdCB0aGlzLl9jb25uLnJldHJpZXZlKHRoaXMudHlwZSwgdGhpcy5pZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlYyBhcyBSZXRyaWV2ZVJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgcmVjb3JkIGZpZWxkIGluZm9ybWF0aW9uXG4gICAqL1xuICBhc3luYyB1cGRhdGUocmVjb3JkOiBJbnB1dFJlY29yZCwgb3B0aW9ucz86IERtbE9wdGlvbnMpIHtcbiAgICBjb25zdCByZWNvcmRfID0geyAuLi5yZWNvcmQsIElkOiB0aGlzLmlkIH07XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4udXBkYXRlKHRoaXMudHlwZSwgcmVjb3JkXywgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHJlY29yZCBmaWVsZFxuICAgKi9cbiAgZGVzdHJveShvcHRpb25zPzogRG1sT3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9jb25uLmRlc3Ryb3kodGhpcy50eXBlLCB0aGlzLmlkLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIFJlY29yZCNkZXN0cm95KClcbiAgICovXG4gIGRlbGV0ZSA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogU3lub255bSBvZiBSZWNvcmQjZGVzdHJveSgpXG4gICAqL1xuICBkZWwgPSB0aGlzLmRlc3Ryb3k7XG5cbiAgLyoqXG4gICAqIEdldCBibG9iIGZpZWxkIGFzIHN0cmVhbVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZmllbGROYW1lIC0gQmxvYiBmaWVsZCBuYW1lXG4gICAqIEByZXR1cm5zIHtzdHJlYW0uU3RyZWFtfVxuICAgKi9cbiAgYmxvYihmaWVsZE5hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IHVybCA9IFtcbiAgICAgIHRoaXMuX2Nvbm4uX2Jhc2VVcmwoKSxcbiAgICAgICdzb2JqZWN0cycsXG4gICAgICB0aGlzLnR5cGUsXG4gICAgICB0aGlzLmlkLFxuICAgICAgZmllbGROYW1lLFxuICAgIF0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3QodXJsKS5zdHJlYW0oKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBSZWNvcmRSZWZlcmVuY2U7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7O0FBV0E7QUFDQTtBQUNBO0FBQ08sTUFBTUEsZUFBZSxDQUsxQjtFQUtBO0FBQ0Y7QUFDQTtFQUNFQyxXQUFXQSxDQUFDQyxJQUFtQixFQUFFQyxJQUFPLEVBQUVDLEVBQVUsRUFBRTtJQUFBLElBQUFDLGdCQUFBLENBQUFDLE9BQUE7SUFBQSxJQUFBRCxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUEsa0JBZ0M3QyxJQUFJLENBQUNDLE9BQU87SUFBQSxJQUFBRixnQkFBQSxDQUFBQyxPQUFBLGVBS2YsSUFBSSxDQUFDQyxPQUFPO0lBcENoQixJQUFJLENBQUNDLEtBQUssR0FBR04sSUFBSTtJQUNqQixJQUFJLENBQUNDLElBQUksR0FBR0EsSUFBSTtJQUNoQixJQUFJLENBQUNDLEVBQUUsR0FBR0EsRUFBRTtFQUNkOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1LLFFBQVFBLENBQUNDLE9BQXlCLEVBQUU7SUFDeEMsTUFBTUMsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDSCxLQUFLLENBQUNDLFFBQVEsQ0FBQyxJQUFJLENBQUNOLElBQUksRUFBRSxJQUFJLENBQUNDLEVBQUUsRUFBRU0sT0FBTyxDQUFDO0lBQ2xFLE9BQU9DLEdBQUc7RUFDWjs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNQyxNQUFNQSxDQUFDQyxNQUFtQixFQUFFSCxPQUFvQixFQUFFO0lBQ3RELE1BQU1JLE9BQU8sR0FBQUMsYUFBQSxDQUFBQSxhQUFBLEtBQVFGLE1BQU07TUFBRUcsRUFBRSxFQUFFLElBQUksQ0FBQ1o7SUFBRSxFQUFFO0lBQzFDLE9BQU8sSUFBSSxDQUFDSSxLQUFLLENBQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUNULElBQUksRUFBRVcsT0FBTyxFQUFFSixPQUFPLENBQUM7RUFDdkQ7O0VBRUE7QUFDRjtBQUNBO0VBQ0VILE9BQU9BLENBQUNHLE9BQW9CLEVBQUU7SUFDNUIsT0FBTyxJQUFJLENBQUNGLEtBQUssQ0FBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQ0osSUFBSSxFQUFFLElBQUksQ0FBQ0MsRUFBRSxFQUFFTSxPQUFPLENBQUM7RUFDeEQ7O0VBRUE7QUFDRjtBQUNBOztFQUdFO0FBQ0Y7QUFDQTs7RUFHRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRU8sSUFBSUEsQ0FBQ0MsU0FBaUIsRUFBRTtJQUN0QixNQUFNQyxHQUFHLEdBQUcsQ0FDVixJQUFJLENBQUNYLEtBQUssQ0FBQ1ksUUFBUSxDQUFDLENBQUMsRUFDckIsVUFBVSxFQUNWLElBQUksQ0FBQ2pCLElBQUksRUFDVCxJQUFJLENBQUNDLEVBQUUsRUFDUGMsU0FBUyxDQUNWLENBQUNHLElBQUksQ0FBQyxHQUFHLENBQUM7SUFDWCxPQUFPLElBQUksQ0FBQ2IsS0FBSyxDQUFDYyxPQUFPLENBQUNILEdBQUcsQ0FBQyxDQUFDSSxNQUFNLENBQUMsQ0FBQztFQUN6QztBQUNGO0FBQUNDLE9BQUEsQ0FBQXhCLGVBQUEsR0FBQUEsZUFBQTtBQUFBLElBQUF5QixRQUFBLEdBRWN6QixlQUFlO0FBQUF3QixPQUFBLENBQUFsQixPQUFBLEdBQUFtQixRQUFBIn0=