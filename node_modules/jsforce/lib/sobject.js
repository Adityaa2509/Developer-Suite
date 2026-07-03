"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.array.sort");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SObject = void 0;
var _find = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/find"));
var _includes = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/includes"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _logger = require("./util/logger");
var _recordReference = _interopRequireDefault(require("./record-reference"));
var _query = _interopRequireWildcard(require("./query"));
var _quickAction = _interopRequireDefault(require("./quick-action"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context4; _forEachInstanceProperty(_context4 = ownKeys(Object(source), true)).call(_context4, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context5; _forEachInstanceProperty(_context5 = ownKeys(Object(source))).call(_context5, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
/**
 * A class for organizing all SObject access
 */
class SObject {
  // layouts: (ln?: string) => Promise<DescribeLayoutResult>;

  // compactLayouts: () => Promise<DescribeCompactLayoutsResult>;

  // approvalLayouts: () => Promise<DescribeApprovalLayoutsResult>;

  /**
   *
   */
  constructor(conn, type) {
    (0, _defineProperty2.default)(this, "type", void 0);
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "layouts$", void 0);
    (0, _defineProperty2.default)(this, "layouts$$", void 0);
    (0, _defineProperty2.default)(this, "compactLayouts$", void 0);
    (0, _defineProperty2.default)(this, "compactLayouts$$", void 0);
    (0, _defineProperty2.default)(this, "approvalLayouts$", void 0);
    (0, _defineProperty2.default)(this, "approvalLayouts$$", void 0);
    (0, _defineProperty2.default)(this, "insert", this.create);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    (0, _defineProperty2.default)(this, "insertBulk", this.createBulk);
    (0, _defineProperty2.default)(this, "deleteBulk", this.destroyBulk);
    (0, _defineProperty2.default)(this, "deleteHardBulk", this.destroyHardBulk);
    this.type = type;
    this._conn = conn;
    this._logger = conn._logLevel ? SObject._logger.createInstance(conn._logLevel) : SObject._logger;
    const cache = this._conn.cache;
    const layoutCacheKey = layoutName => layoutName ? `layouts.namedLayouts.${layoutName}` : `layouts.${this.type}`;
    const layouts = SObject.prototype.layouts;
    this.layouts = cache.createCachedFunction(layouts, this, {
      key: layoutCacheKey,
      strategy: 'NOCACHE'
    });
    this.layouts$ = cache.createCachedFunction(layouts, this, {
      key: layoutCacheKey,
      strategy: 'HIT'
    });
    this.layouts$$ = cache.createCachedFunction(layouts, this, {
      key: layoutCacheKey,
      strategy: 'IMMEDIATE'
    });
    const compactLayoutCacheKey = `compactLayouts.${this.type}`;
    const compactLayouts = SObject.prototype.compactLayouts;
    this.compactLayouts = cache.createCachedFunction(compactLayouts, this, {
      key: compactLayoutCacheKey,
      strategy: 'NOCACHE'
    });
    this.compactLayouts$ = cache.createCachedFunction(compactLayouts, this, {
      key: compactLayoutCacheKey,
      strategy: 'HIT'
    });
    this.compactLayouts$$ = cache.createCachedFunction(compactLayouts, this, {
      key: compactLayoutCacheKey,
      strategy: 'IMMEDIATE'
    });
    const approvalLayoutCacheKey = `approvalLayouts.${this.type}`;
    const approvalLayouts = SObject.prototype.approvalLayouts;
    this.approvalLayouts = cache.createCachedFunction(approvalLayouts, this, {
      key: approvalLayoutCacheKey,
      strategy: 'NOCACHE'
    });
    this.approvalLayouts$ = cache.createCachedFunction(approvalLayouts, this, {
      key: approvalLayoutCacheKey,
      strategy: 'HIT'
    });
    this.approvalLayouts$$ = cache.createCachedFunction(approvalLayouts, this, {
      key: approvalLayoutCacheKey,
      strategy: 'IMMEDIATE'
    });
  }

  /**
   * Create records
   */

  create(records, options) {
    return this._conn.create(this.type, records, options);
  }

  /**
   * Synonym of SObject#create()
   */

  /**
   * Retrieve specified records
   */

  retrieve(ids, options) {
    return this._conn.retrieve(this.type, ids, options);
  }

  /**
   * Update records
   */

  update(records, options) {
    return this._conn.update(this.type, records, options);
  }

  /**
   * Upsert records
   */

  upsert(records, extIdField, options) {
    return this._conn.upsert(this.type, records, extIdField, options);
  }

  /**
   * Delete records
   */

  destroy(ids, options) {
    return this._conn.destroy(this.type, ids, options);
  }

  /**
   * Synonym of SObject#destroy()
   */

  /**
   * Synonym of SObject#destroy()
   */

  /**
   * Call Bulk#load() to execute bulkload, returning batch object
   */
  bulkload(operation, optionsOrInput, input) {
    return this._conn.bulk.load(this.type, operation, optionsOrInput, input);
  }

  /**
   * Bulkly insert input data using bulk API
   */
  createBulk(input) {
    return this.bulkload('insert', input);
  }

  /**
   * Synonym of SObject#createBulk()
   */

  /**
   * Bulkly update records by input data using bulk API
   */
  updateBulk(input) {
    return this.bulkload('update', input);
  }

  /**
   * Bulkly upsert records by input data using bulk API
   */
  upsertBulk(input, extIdField) {
    return this.bulkload('upsert', {
      extIdField
    }, input);
  }

  /**
   * Bulkly delete records specified by input data using bulk API
   */
  destroyBulk(input) {
    return this.bulkload('delete', input);
  }

  /**
   * Synonym of SObject#destroyBulk()
   */

  /**
   * Bulkly hard delete records specified in input data using bulk API
   */
  destroyHardBulk(input) {
    return this.bulkload('hardDelete', input);
  }

  /**
   * Synonym of SObject#destroyHardBulk()
   */

  /**
   * Describe SObject metadata
   */
  describe() {
    return this._conn.describe(this.type);
  }

  /**
   *
   */
  describe$() {
    return this._conn.describe$(this.type);
  }

  /**
   *
   */
  describe$$() {
    return this._conn.describe$$(this.type);
  }

  /**
   * Get record representation instance by given id
   */
  record(id) {
    return new _recordReference.default(this._conn, this.type, id);
  }

  /**
   * Retrieve recently accessed records
   */
  recent() {
    return this._conn.recent(this.type);
  }

  /**
   * Retrieve the updated records
   */
  updated(start, end) {
    return this._conn.updated(this.type, start, end);
  }

  /**
   * Retrieve the deleted records
   */
  deleted(start, end) {
    return this._conn.deleted(this.type, start, end);
  }

  /**
   * Describe layout information for SObject
   */
  async layouts(layoutName) {
    const url = `/sobjects/${this.type}/describe/${layoutName ? `namedLayouts/${layoutName}` : 'layouts'}`;
    const body = await this._conn.request(url);
    return body;
  }

  /**
   * @typedef {Object} CompactLayoutInfo
   * @prop {Array.<Object>} compactLayouts - Array of compact layouts
   * @prop {String} defaultCompactLayoutId - ID of default compact layout
   * @prop {Array.<Object>} recordTypeCompactLayoutMappings - Array of record type mappings
   */
  /**
   * Describe compact layout information defined for SObject
   *
   * @param {Callback.<CompactLayoutInfo>} [callback] - Callback function
   * @returns {Promise.<CompactLayoutInfo>}
   */
  async compactLayouts() {
    const url = `/sobjects/${this.type}/describe/compactLayouts`;
    const body = await this._conn.request(url);
    return body;
  }

  /**
   * Describe compact layout information defined for SObject
   *
   * @param {Callback.<ApprovalLayoutInfo>} [callback] - Callback function
   * @returns {Promise.<ApprovalLayoutInfo>}
   */
  async approvalLayouts() {
    const url = `/sobjects/${this.type}/describe/approvalLayouts`;
    const body = await this._conn.request(url);
    return body;
  }

  /**
   * Find and fetch records which matches given conditions
   */

  find(conditions, fields, options = {}) {
    const {
        sort,
        limit,
        offset
      } = options,
      qoptions = (0, _objectWithoutProperties2.default)(options, ["sort", "limit", "offset"]);
    const config = {
      fields: fields == null ? undefined : fields,
      includes: (0, _includes.default)(options),
      table: this.type,
      conditions: conditions == null ? undefined : conditions,
      sort,
      limit,
      offset
    };
    const query = new _query.default(this._conn, config, qoptions);
    return query.setResponseTarget(_query.ResponseTargets.Records);
  }

  /**
   * Fetch one record which matches given conditions
   */

  findOne(conditions, fields, options = {}) {
    var _context;
    const query = (0, _find.default)(_context = this).call(_context, conditions, fields, _objectSpread(_objectSpread({}, options), {}, {
      limit: 1
    }));
    return query.setResponseTarget(_query.ResponseTargets.SingleRecord);
  }

  /**
   * Find and fetch records only by specifying fields to fetch.
   */
  select(fields) {
    var _context2;
    return (0, _find.default)(_context2 = this).call(_context2, null, fields);
  }

  /**
   * Count num of records which matches given conditions
   */
  count(conditions) {
    var _context3;
    const query = (0, _find.default)(_context3 = this).call(_context3, conditions, 'count()');
    return query.setResponseTarget(_query.ResponseTargets.Count);
  }

  /**
   * Returns the list of list views for the SObject
   *
   * @param {Callback.<ListViewsInfo>} [callback] - Callback function
   * @returns {Promise.<ListViewsInfo>}
   */
  listviews() {
    const url = `${this._conn._baseUrl()}/sobjects/${this.type}/listviews`;
    return this._conn.request(url);
  }

  /**
   * Returns the list view info in specifed view id
   *
   * @param {String} id - List view ID
   * @returns {ListView}
   */
  listview(id) {
    return new ListView(this._conn, this.type, id); // eslint-disable-line no-use-before-define
  }

  /**
   * Returns all registered quick actions for the SObject
   *
   * @param {Callback.<Array.<QuickAction~QuickActionInfo>>} [callback] - Callback function
   * @returns {Promise.<Array.<QuickAction~QuickActionInfo>>}
   */
  quickActions() {
    return this._conn.request(`/sobjects/${this.type}/quickActions`);
  }

  /**
   * Get reference for specified quick aciton in the SObject
   *
   * @param {String} actionName - Name of the quick action
   * @returns {QuickAction}
   */
  quickAction(actionName) {
    return new _quickAction.default(this._conn, `/sobjects/${this.type}/quickActions/${actionName}`);
  }
}

/**
 * A class for organizing list view information
 *
 * @protected
 * @class ListView
 * @param {Connection} conn - Connection instance
 * @param {SObject} type - SObject type
 * @param {String} id - List view ID
 */
exports.SObject = SObject;
(0, _defineProperty2.default)(SObject, "_logger", (0, _logger.getLogger)('sobject'));
class ListView {
  /**
   *
   */
  constructor(conn, type, id) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "type", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    this._conn = conn;
    this.type = type;
    this.id = id;
  }

  /**
   * Executes query for the list view and returns the resulting data and presentation information.
   */
  results() {
    const url = `${this._conn._baseUrl()}/sobjects/${this.type}/listviews/${this.id}/results`;
    return this._conn.request(url);
  }

  /**
   * Returns detailed information about a list view
   */
  describe(options = {}) {
    const url = `${this._conn._baseUrl()}/sobjects/${this.type}/listviews/${this.id}/describe`;
    return this._conn.request({
      method: 'GET',
      url,
      headers: options.headers
    });
  }

  /**
   * Explain plan for executing list view
   */
  explain() {
    const url = `/query/?explain=${this.id}`;
    return this._conn.request(url);
  }
}
var _default = SObject; // TODO Bulk
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9yZWNvcmRSZWZlcmVuY2UiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX3F1ZXJ5IiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfcXVpY2tBY3Rpb24iLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRrZXlzIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiX2ZpbHRlckluc3RhbmNlUHJvcGVydHkiLCJjYWxsIiwic3ltIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJfY29udGV4dDQiLCJfZm9yRWFjaEluc3RhbmNlUHJvcGVydHkiLCJPYmplY3QiLCJrZXkiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsIl9PYmplY3QkZGVmaW5lUHJvcGVydGllcyIsIl9jb250ZXh0NSIsIl9PYmplY3QkZGVmaW5lUHJvcGVydHkiLCJTT2JqZWN0IiwiY29uc3RydWN0b3IiLCJjb25uIiwidHlwZSIsImNyZWF0ZSIsImRlc3Ryb3kiLCJjcmVhdGVCdWxrIiwiZGVzdHJveUJ1bGsiLCJkZXN0cm95SGFyZEJ1bGsiLCJfY29ubiIsIl9sb2dMZXZlbCIsImNyZWF0ZUluc3RhbmNlIiwiY2FjaGUiLCJsYXlvdXRDYWNoZUtleSIsImxheW91dE5hbWUiLCJsYXlvdXRzIiwicHJvdG90eXBlIiwiY3JlYXRlQ2FjaGVkRnVuY3Rpb24iLCJzdHJhdGVneSIsImxheW91dHMkIiwibGF5b3V0cyQkIiwiY29tcGFjdExheW91dENhY2hlS2V5IiwiY29tcGFjdExheW91dHMiLCJjb21wYWN0TGF5b3V0cyQiLCJjb21wYWN0TGF5b3V0cyQkIiwiYXBwcm92YWxMYXlvdXRDYWNoZUtleSIsImFwcHJvdmFsTGF5b3V0cyIsImFwcHJvdmFsTGF5b3V0cyQiLCJhcHByb3ZhbExheW91dHMkJCIsInJlY29yZHMiLCJvcHRpb25zIiwicmV0cmlldmUiLCJpZHMiLCJ1cGRhdGUiLCJ1cHNlcnQiLCJleHRJZEZpZWxkIiwiYnVsa2xvYWQiLCJvcGVyYXRpb24iLCJvcHRpb25zT3JJbnB1dCIsImlucHV0IiwiYnVsayIsImxvYWQiLCJ1cGRhdGVCdWxrIiwidXBzZXJ0QnVsayIsImRlc2NyaWJlIiwiZGVzY3JpYmUkIiwiZGVzY3JpYmUkJCIsInJlY29yZCIsImlkIiwiUmVjb3JkUmVmZXJlbmNlIiwicmVjZW50IiwidXBkYXRlZCIsInN0YXJ0IiwiZW5kIiwiZGVsZXRlZCIsInVybCIsImJvZHkiLCJyZXF1ZXN0IiwiZmluZCIsImNvbmRpdGlvbnMiLCJmaWVsZHMiLCJzb3J0IiwibGltaXQiLCJvZmZzZXQiLCJxb3B0aW9ucyIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllczIiLCJjb25maWciLCJ1bmRlZmluZWQiLCJpbmNsdWRlcyIsIl9pbmNsdWRlcyIsInRhYmxlIiwicXVlcnkiLCJRdWVyeSIsInNldFJlc3BvbnNlVGFyZ2V0IiwiUmVzcG9uc2VUYXJnZXRzIiwiUmVjb3JkcyIsImZpbmRPbmUiLCJfY29udGV4dCIsIl9maW5kIiwiU2luZ2xlUmVjb3JkIiwic2VsZWN0IiwiX2NvbnRleHQyIiwiY291bnQiLCJfY29udGV4dDMiLCJDb3VudCIsImxpc3R2aWV3cyIsIl9iYXNlVXJsIiwibGlzdHZpZXciLCJMaXN0VmlldyIsInF1aWNrQWN0aW9ucyIsInF1aWNrQWN0aW9uIiwiYWN0aW9uTmFtZSIsIlF1aWNrQWN0aW9uIiwiZXhwb3J0cyIsImdldExvZ2dlciIsInJlc3VsdHMiLCJtZXRob2QiLCJoZWFkZXJzIiwiZXhwbGFpbiIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vc3JjL3NvYmplY3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICovXG5pbXBvcnQgeyBMb2dnZXIsIGdldExvZ2dlciB9IGZyb20gJy4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHtcbiAgUmVjb3JkLFxuICBEZXNjcmliZUxheW91dFJlc3VsdCxcbiAgRGVzY3JpYmVDb21wYWN0TGF5b3V0c1Jlc3VsdCxcbiAgRGVzY3JpYmVBcHByb3ZhbExheW91dHNSZXN1bHQsXG4gIE9wdGlvbmFsLFxuICBEbWxPcHRpb25zLFxuICBTYXZlUmVzdWx0LFxuICBVcHNlcnRSZXN1bHQsXG4gIFJldHJpZXZlT3B0aW9ucyxcbiAgU2NoZW1hLFxuICBTT2JqZWN0TmFtZXMsXG4gIFNPYmplY3RSZWNvcmQsXG4gIFNPYmplY3RJbnB1dFJlY29yZCxcbiAgU09iamVjdFVwZGF0ZVJlY29yZCxcbiAgU09iamVjdEZpZWxkTmFtZXMsXG4gIEZpZWxkUHJvamVjdGlvbkNvbmZpZyxcbiAgRmllbGRQYXRoU3BlY2lmaWVyLFxuICBGaWVsZFBhdGhTY29wZWRQcm9qZWN0aW9uLFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCBDb25uZWN0aW9uIGZyb20gJy4vY29ubmVjdGlvbic7XG5pbXBvcnQgUmVjb3JkUmVmZXJlbmNlIGZyb20gJy4vcmVjb3JkLXJlZmVyZW5jZSc7XG5pbXBvcnQgUXVlcnksIHtcbiAgUmVzcG9uc2VUYXJnZXRzLFxuICBRdWVyeU9wdGlvbnMsXG4gIFF1ZXJ5RmllbGQsXG4gIFF1ZXJ5Q29uZGl0aW9uLFxuICBRdWVyeUNvbmZpZyxcbn0gZnJvbSAnLi9xdWVyeSc7XG5pbXBvcnQgUXVpY2tBY3Rpb24gZnJvbSAnLi9xdWljay1hY3Rpb24nO1xuaW1wb3J0IHsgQ2FjaGVkRnVuY3Rpb24gfSBmcm9tICcuL2NhY2hlJztcbmltcG9ydCB7IFJlYWRhYmxlIH0gZnJvbSAnc3RyZWFtJztcblxuZXhwb3J0IHR5cGUgRmluZE9wdGlvbnM8UyBleHRlbmRzIFNjaGVtYSwgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4gPSBQYXJ0aWFsPFxuICBRdWVyeU9wdGlvbnMgJlxuICAgIFBpY2s8UXVlcnlDb25maWc8UywgTj4sICdzb3J0JyB8ICdpbmNsdWRlcyc+ICYge1xuICAgICAgbGltaXQ6IG51bWJlcjtcbiAgICAgIG9mZnNldDogbnVtYmVyO1xuICAgIH1cbj47XG5cbi8qKlxuICogQSBjbGFzcyBmb3Igb3JnYW5pemluZyBhbGwgU09iamVjdCBhY2Nlc3NcbiAqL1xuZXhwb3J0IGNsYXNzIFNPYmplY3Q8XG4gIFMgZXh0ZW5kcyBTY2hlbWEsXG4gIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gIEZpZWxkTmFtZXMgZXh0ZW5kcyBTT2JqZWN0RmllbGROYW1lczxTLCBOPiA9IFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+LFxuICBSZXRyaWV2ZVJlY29yZCBleHRlbmRzIFNPYmplY3RSZWNvcmQ8UywgTiwgJyonPiA9IFNPYmplY3RSZWNvcmQ8UywgTiwgJyonPixcbiAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gIFVwZGF0ZVJlY29yZCBleHRlbmRzIFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj4gPSBTT2JqZWN0VXBkYXRlUmVjb3JkPFMsIE4+XG4+IHtcbiAgc3RhdGljIF9sb2dnZXIgPSBnZXRMb2dnZXIoJ3NvYmplY3QnKTtcblxuICB0eXBlOiBOO1xuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcbiAgX2xvZ2dlcjogTG9nZ2VyO1xuXG4gIC8vIGxheW91dHM6IChsbj86IHN0cmluZykgPT4gUHJvbWlzZTxEZXNjcmliZUxheW91dFJlc3VsdD47XG4gIGxheW91dHMkOiBDYWNoZWRGdW5jdGlvbjwobG4/OiBzdHJpbmcpID0+IFByb21pc2U8RGVzY3JpYmVMYXlvdXRSZXN1bHQ+PjtcbiAgbGF5b3V0cyQkOiBDYWNoZWRGdW5jdGlvbjwobG4/OiBzdHJpbmcpID0+IERlc2NyaWJlTGF5b3V0UmVzdWx0PjtcbiAgLy8gY29tcGFjdExheW91dHM6ICgpID0+IFByb21pc2U8RGVzY3JpYmVDb21wYWN0TGF5b3V0c1Jlc3VsdD47XG4gIGNvbXBhY3RMYXlvdXRzJDogQ2FjaGVkRnVuY3Rpb248KCkgPT4gUHJvbWlzZTxEZXNjcmliZUNvbXBhY3RMYXlvdXRzUmVzdWx0Pj47XG4gIGNvbXBhY3RMYXlvdXRzJCQ6IENhY2hlZEZ1bmN0aW9uPCgpID0+IERlc2NyaWJlQ29tcGFjdExheW91dHNSZXN1bHQ+O1xuICAvLyBhcHByb3ZhbExheW91dHM6ICgpID0+IFByb21pc2U8RGVzY3JpYmVBcHByb3ZhbExheW91dHNSZXN1bHQ+O1xuICBhcHByb3ZhbExheW91dHMkOiBDYWNoZWRGdW5jdGlvbjxcbiAgICAoKSA9PiBQcm9taXNlPERlc2NyaWJlQXBwcm92YWxMYXlvdXRzUmVzdWx0PlxuICA+O1xuICBhcHByb3ZhbExheW91dHMkJDogQ2FjaGVkRnVuY3Rpb248KCkgPT4gRGVzY3JpYmVBcHByb3ZhbExheW91dHNSZXN1bHQ+O1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoY29ubjogQ29ubmVjdGlvbjxTPiwgdHlwZTogTikge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gICAgdGhpcy5fbG9nZ2VyID0gY29ubi5fbG9nTGV2ZWxcbiAgICAgID8gU09iamVjdC5fbG9nZ2VyLmNyZWF0ZUluc3RhbmNlKGNvbm4uX2xvZ0xldmVsKVxuICAgICAgOiBTT2JqZWN0Ll9sb2dnZXI7XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLl9jb25uLmNhY2hlO1xuICAgIGNvbnN0IGxheW91dENhY2hlS2V5ID0gKGxheW91dE5hbWU6IHN0cmluZykgPT5cbiAgICAgIGxheW91dE5hbWVcbiAgICAgICAgPyBgbGF5b3V0cy5uYW1lZExheW91dHMuJHtsYXlvdXROYW1lfWBcbiAgICAgICAgOiBgbGF5b3V0cy4ke3RoaXMudHlwZX1gO1xuICAgIGNvbnN0IGxheW91dHMgPSBTT2JqZWN0LnByb3RvdHlwZS5sYXlvdXRzO1xuICAgIHRoaXMubGF5b3V0cyA9IGNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKGxheW91dHMsIHRoaXMsIHtcbiAgICAgIGtleTogbGF5b3V0Q2FjaGVLZXksXG4gICAgICBzdHJhdGVneTogJ05PQ0FDSEUnLFxuICAgIH0pO1xuICAgIHRoaXMubGF5b3V0cyQgPSBjYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihsYXlvdXRzLCB0aGlzLCB7XG4gICAgICBrZXk6IGxheW91dENhY2hlS2V5LFxuICAgICAgc3RyYXRlZ3k6ICdISVQnLFxuICAgIH0pO1xuICAgIHRoaXMubGF5b3V0cyQkID0gY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24obGF5b3V0cywgdGhpcywge1xuICAgICAga2V5OiBsYXlvdXRDYWNoZUtleSxcbiAgICAgIHN0cmF0ZWd5OiAnSU1NRURJQVRFJyxcbiAgICB9KSBhcyBhbnk7XG4gICAgY29uc3QgY29tcGFjdExheW91dENhY2hlS2V5ID0gYGNvbXBhY3RMYXlvdXRzLiR7dGhpcy50eXBlfWA7XG4gICAgY29uc3QgY29tcGFjdExheW91dHMgPSBTT2JqZWN0LnByb3RvdHlwZS5jb21wYWN0TGF5b3V0cztcbiAgICB0aGlzLmNvbXBhY3RMYXlvdXRzID0gY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oY29tcGFjdExheW91dHMsIHRoaXMsIHtcbiAgICAgIGtleTogY29tcGFjdExheW91dENhY2hlS2V5LFxuICAgICAgc3RyYXRlZ3k6ICdOT0NBQ0hFJyxcbiAgICB9KTtcbiAgICB0aGlzLmNvbXBhY3RMYXlvdXRzJCA9IGNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKGNvbXBhY3RMYXlvdXRzLCB0aGlzLCB7XG4gICAgICBrZXk6IGNvbXBhY3RMYXlvdXRDYWNoZUtleSxcbiAgICAgIHN0cmF0ZWd5OiAnSElUJyxcbiAgICB9KTtcbiAgICB0aGlzLmNvbXBhY3RMYXlvdXRzJCQgPSBjYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihjb21wYWN0TGF5b3V0cywgdGhpcywge1xuICAgICAga2V5OiBjb21wYWN0TGF5b3V0Q2FjaGVLZXksXG4gICAgICBzdHJhdGVneTogJ0lNTUVESUFURScsXG4gICAgfSkgYXMgYW55O1xuICAgIGNvbnN0IGFwcHJvdmFsTGF5b3V0Q2FjaGVLZXkgPSBgYXBwcm92YWxMYXlvdXRzLiR7dGhpcy50eXBlfWA7XG4gICAgY29uc3QgYXBwcm92YWxMYXlvdXRzID0gU09iamVjdC5wcm90b3R5cGUuYXBwcm92YWxMYXlvdXRzO1xuICAgIHRoaXMuYXBwcm92YWxMYXlvdXRzID0gY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oYXBwcm92YWxMYXlvdXRzLCB0aGlzLCB7XG4gICAgICBrZXk6IGFwcHJvdmFsTGF5b3V0Q2FjaGVLZXksXG4gICAgICBzdHJhdGVneTogJ05PQ0FDSEUnLFxuICAgIH0pO1xuICAgIHRoaXMuYXBwcm92YWxMYXlvdXRzJCA9IGNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKGFwcHJvdmFsTGF5b3V0cywgdGhpcywge1xuICAgICAga2V5OiBhcHByb3ZhbExheW91dENhY2hlS2V5LFxuICAgICAgc3RyYXRlZ3k6ICdISVQnLFxuICAgIH0pO1xuICAgIHRoaXMuYXBwcm92YWxMYXlvdXRzJCQgPSBjYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihhcHByb3ZhbExheW91dHMsIHRoaXMsIHtcbiAgICAgIGtleTogYXBwcm92YWxMYXlvdXRDYWNoZUtleSxcbiAgICAgIHN0cmF0ZWd5OiAnSU1NRURJQVRFJyxcbiAgICB9KSBhcyBhbnk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHJlY29yZHNcbiAgICovXG4gIGNyZWF0ZShyZWNvcmRzOiBJbnB1dFJlY29yZFtdLCBvcHRpb25zPzogRG1sT3B0aW9ucyk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgY3JlYXRlKHJlY29yZHM6IElucHV0UmVjb3JkLCBvcHRpb25zPzogRG1sT3B0aW9ucyk6IFByb21pc2U8U2F2ZVJlc3VsdD47XG4gIGNyZWF0ZShcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZCB8IElucHV0UmVjb3JkW10sXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT47XG4gIGNyZWF0ZShyZWNvcmRzOiBJbnB1dFJlY29yZCB8IElucHV0UmVjb3JkW10sIG9wdGlvbnM/OiBEbWxPcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4uY3JlYXRlKHRoaXMudHlwZSwgcmVjb3Jkcywgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBTT2JqZWN0I2NyZWF0ZSgpXG4gICAqL1xuICBpbnNlcnQgPSB0aGlzLmNyZWF0ZTtcblxuICAvKipcbiAgICogUmV0cmlldmUgc3BlY2lmaWVkIHJlY29yZHNcbiAgICovXG4gIHJldHJpZXZlKGlkczogc3RyaW5nW10sIG9wdGlvbnM/OiBSZXRyaWV2ZU9wdGlvbnMpOiBQcm9taXNlPFJldHJpZXZlUmVjb3JkW10+O1xuICByZXRyaWV2ZShpZHM6IHN0cmluZywgb3B0aW9ucz86IFJldHJpZXZlT3B0aW9ucyk6IFByb21pc2U8UmV0cmlldmVSZWNvcmQ+O1xuICByZXRyaWV2ZShcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBSZXRyaWV2ZU9wdGlvbnMsXG4gICk6IFByb21pc2U8UmV0cmlldmVSZWNvcmQgfCBSZXRyaWV2ZVJlY29yZFtdPjtcbiAgcmV0cmlldmUoaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSwgb3B0aW9ucz86IFJldHJpZXZlT3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJldHJpZXZlKHRoaXMudHlwZSwgaWRzLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgcmVjb3Jkc1xuICAgKi9cbiAgdXBkYXRlKHJlY29yZHM6IFVwZGF0ZVJlY29yZFtdLCBvcHRpb25zPzogRG1sT3B0aW9ucyk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgdXBkYXRlKHJlY29yZHM6IFVwZGF0ZVJlY29yZCwgb3B0aW9ucz86IERtbE9wdGlvbnMpOiBQcm9taXNlPFNhdmVSZXN1bHQ+O1xuICB1cGRhdGUoXG4gICAgcmVjb3JkczogVXBkYXRlUmVjb3JkIHwgVXBkYXRlUmVjb3JkW10sXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT47XG4gIHVwZGF0ZShyZWNvcmRzOiBVcGRhdGVSZWNvcmQgfCBVcGRhdGVSZWNvcmRbXSwgb3B0aW9ucz86IERtbE9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5fY29ubi51cGRhdGUodGhpcy50eXBlLCByZWNvcmRzLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcHNlcnQgcmVjb3Jkc1xuICAgKi9cbiAgdXBzZXJ0KFxuICAgIHJlY29yZHM6IElucHV0UmVjb3JkW10sXG4gICAgZXh0SWRGaWVsZDogRmllbGROYW1lcyxcbiAgICBvcHRpb25zPzogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydChcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZCxcbiAgICBleHRJZEZpZWxkOiBGaWVsZE5hbWVzLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFVwc2VydFJlc3VsdD47XG4gIHVwc2VydChcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZCB8IElucHV0UmVjb3JkW10sXG4gICAgZXh0SWRGaWVsZDogRmllbGROYW1lcyxcbiAgICBvcHRpb25zPzogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxVcHNlcnRSZXN1bHQgfCBVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydChcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZCB8IElucHV0UmVjb3JkW10sXG4gICAgZXh0SWRGaWVsZDogRmllbGROYW1lcyxcbiAgICBvcHRpb25zPzogRG1sT3B0aW9ucyxcbiAgKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4udXBzZXJ0KHRoaXMudHlwZSwgcmVjb3JkcywgZXh0SWRGaWVsZCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHJlY29yZHNcbiAgICovXG4gIGRlc3Ryb3koaWRzOiBzdHJpbmdbXSwgb3B0aW9ucz86IERtbE9wdGlvbnMpOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIGRlc3Ryb3koaWRzOiBzdHJpbmcsIG9wdGlvbnM/OiBEbWxPcHRpb25zKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgZGVzdHJveShcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICBkZXN0cm95KGlkczogc3RyaW5nIHwgc3RyaW5nW10sIG9wdGlvbnM/OiBEbWxPcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4uZGVzdHJveSh0aGlzLnR5cGUsIGlkcywgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBTT2JqZWN0I2Rlc3Ryb3koKVxuICAgKi9cbiAgZGVsZXRlID0gdGhpcy5kZXN0cm95O1xuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIFNPYmplY3QjZGVzdHJveSgpXG4gICAqL1xuICBkZWwgPSB0aGlzLmRlc3Ryb3k7XG5cbiAgLyoqXG4gICAqIENhbGwgQnVsayNsb2FkKCkgdG8gZXhlY3V0ZSBidWxrbG9hZCwgcmV0dXJuaW5nIGJhdGNoIG9iamVjdFxuICAgKi9cbiAgYnVsa2xvYWQoXG4gICAgb3BlcmF0aW9uOiAnaW5zZXJ0JyB8ICd1cGRhdGUnIHwgJ3Vwc2VydCcgfCAnZGVsZXRlJyB8ICdoYXJkRGVsZXRlJyxcbiAgICBvcHRpb25zT3JJbnB1dD86IE9iamVjdCB8IFJlY29yZFtdIHwgUmVhZGFibGUgfCBzdHJpbmcsXG4gICAgaW5wdXQ/OiBSZWNvcmRbXSB8IFJlYWRhYmxlIHwgc3RyaW5nLFxuICApIHtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5idWxrLmxvYWQodGhpcy50eXBlLCBvcGVyYXRpb24sIG9wdGlvbnNPcklucHV0LCBpbnB1dCk7XG4gIH1cblxuICAvKipcbiAgICogQnVsa2x5IGluc2VydCBpbnB1dCBkYXRhIHVzaW5nIGJ1bGsgQVBJXG4gICAqL1xuICBjcmVhdGVCdWxrKGlucHV0PzogUmVjb3JkW10gfCBSZWFkYWJsZSB8IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmJ1bGtsb2FkKCdpbnNlcnQnLCBpbnB1dCk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBTT2JqZWN0I2NyZWF0ZUJ1bGsoKVxuICAgKi9cbiAgaW5zZXJ0QnVsayA9IHRoaXMuY3JlYXRlQnVsaztcblxuICAvKipcbiAgICogQnVsa2x5IHVwZGF0ZSByZWNvcmRzIGJ5IGlucHV0IGRhdGEgdXNpbmcgYnVsayBBUElcbiAgICovXG4gIHVwZGF0ZUJ1bGsoaW5wdXQ/OiBSZWNvcmRbXSB8IFJlYWRhYmxlIHwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVsa2xvYWQoJ3VwZGF0ZScsIGlucHV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWxrbHkgdXBzZXJ0IHJlY29yZHMgYnkgaW5wdXQgZGF0YSB1c2luZyBidWxrIEFQSVxuICAgKi9cbiAgdXBzZXJ0QnVsayhpbnB1dD86IFJlY29yZFtdIHwgUmVhZGFibGUgfCBzdHJpbmcsIGV4dElkRmllbGQ/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5idWxrbG9hZCgndXBzZXJ0JywgeyBleHRJZEZpZWxkIH0sIGlucHV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWxrbHkgZGVsZXRlIHJlY29yZHMgc3BlY2lmaWVkIGJ5IGlucHV0IGRhdGEgdXNpbmcgYnVsayBBUElcbiAgICovXG4gIGRlc3Ryb3lCdWxrKGlucHV0PzogUmVjb3JkW10gfCBSZWFkYWJsZSB8IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmJ1bGtsb2FkKCdkZWxldGUnLCBpbnB1dCk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBTT2JqZWN0I2Rlc3Ryb3lCdWxrKClcbiAgICovXG4gIGRlbGV0ZUJ1bGsgPSB0aGlzLmRlc3Ryb3lCdWxrO1xuXG4gIC8qKlxuICAgKiBCdWxrbHkgaGFyZCBkZWxldGUgcmVjb3JkcyBzcGVjaWZpZWQgaW4gaW5wdXQgZGF0YSB1c2luZyBidWxrIEFQSVxuICAgKi9cbiAgZGVzdHJveUhhcmRCdWxrKGlucHV0OiBSZWNvcmRbXSB8IFJlYWRhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVsa2xvYWQoJ2hhcmREZWxldGUnLCBpbnB1dCk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBTT2JqZWN0I2Rlc3Ryb3lIYXJkQnVsaygpXG4gICAqL1xuICBkZWxldGVIYXJkQnVsayA9IHRoaXMuZGVzdHJveUhhcmRCdWxrO1xuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBTT2JqZWN0IG1ldGFkYXRhXG4gICAqL1xuICBkZXNjcmliZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5kZXNjcmliZSh0aGlzLnR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBkZXNjcmliZSQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4uZGVzY3JpYmUkKHRoaXMudHlwZSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGRlc2NyaWJlJCQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4uZGVzY3JpYmUkJCh0aGlzLnR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCByZWNvcmQgcmVwcmVzZW50YXRpb24gaW5zdGFuY2UgYnkgZ2l2ZW4gaWRcbiAgICovXG4gIHJlY29yZChpZDogc3RyaW5nKTogUmVjb3JkUmVmZXJlbmNlPFMsIE4+IHtcbiAgICByZXR1cm4gbmV3IFJlY29yZFJlZmVyZW5jZSh0aGlzLl9jb25uLCB0aGlzLnR5cGUsIGlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSByZWNlbnRseSBhY2Nlc3NlZCByZWNvcmRzXG4gICAqL1xuICByZWNlbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVjZW50KHRoaXMudHlwZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIHVwZGF0ZWQgcmVjb3Jkc1xuICAgKi9cbiAgdXBkYXRlZChzdGFydDogc3RyaW5nIHwgRGF0ZSwgZW5kOiBzdHJpbmcgfCBEYXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4udXBkYXRlZCh0aGlzLnR5cGUsIHN0YXJ0LCBlbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBkZWxldGVkIHJlY29yZHNcbiAgICovXG4gIGRlbGV0ZWQoc3RhcnQ6IHN0cmluZyB8IERhdGUsIGVuZDogc3RyaW5nIHwgRGF0ZSkge1xuICAgIHJldHVybiB0aGlzLl9jb25uLmRlbGV0ZWQodGhpcy50eXBlLCBzdGFydCwgZW5kKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBsYXlvdXQgaW5mb3JtYXRpb24gZm9yIFNPYmplY3RcbiAgICovXG4gIGFzeW5jIGxheW91dHMobGF5b3V0TmFtZT86IHN0cmluZyk6IFByb21pc2U8RGVzY3JpYmVMYXlvdXRSZXN1bHQ+IHtcbiAgICBjb25zdCB1cmwgPSBgL3NvYmplY3RzLyR7dGhpcy50eXBlfS9kZXNjcmliZS8ke1xuICAgICAgbGF5b3V0TmFtZSA/IGBuYW1lZExheW91dHMvJHtsYXlvdXROYW1lfWAgOiAnbGF5b3V0cydcbiAgICB9YDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5fY29ubi5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVzY3JpYmVMYXlvdXRSZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQHR5cGVkZWYge09iamVjdH0gQ29tcGFjdExheW91dEluZm9cbiAgICogQHByb3Age0FycmF5LjxPYmplY3Q+fSBjb21wYWN0TGF5b3V0cyAtIEFycmF5IG9mIGNvbXBhY3QgbGF5b3V0c1xuICAgKiBAcHJvcCB7U3RyaW5nfSBkZWZhdWx0Q29tcGFjdExheW91dElkIC0gSUQgb2YgZGVmYXVsdCBjb21wYWN0IGxheW91dFxuICAgKiBAcHJvcCB7QXJyYXkuPE9iamVjdD59IHJlY29yZFR5cGVDb21wYWN0TGF5b3V0TWFwcGluZ3MgLSBBcnJheSBvZiByZWNvcmQgdHlwZSBtYXBwaW5nc1xuICAgKi9cbiAgLyoqXG4gICAqIERlc2NyaWJlIGNvbXBhY3QgbGF5b3V0IGluZm9ybWF0aW9uIGRlZmluZWQgZm9yIFNPYmplY3RcbiAgICpcbiAgICogQHBhcmFtIHtDYWxsYmFjay48Q29tcGFjdExheW91dEluZm8+fSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMge1Byb21pc2UuPENvbXBhY3RMYXlvdXRJbmZvPn1cbiAgICovXG4gIGFzeW5jIGNvbXBhY3RMYXlvdXRzKCk6IFByb21pc2U8RGVzY3JpYmVDb21wYWN0TGF5b3V0c1Jlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IGAvc29iamVjdHMvJHt0aGlzLnR5cGV9L2Rlc2NyaWJlL2NvbXBhY3RMYXlvdXRzYDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5fY29ubi5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVzY3JpYmVDb21wYWN0TGF5b3V0c1Jlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBjb21wYWN0IGxheW91dCBpbmZvcm1hdGlvbiBkZWZpbmVkIGZvciBTT2JqZWN0XG4gICAqXG4gICAqIEBwYXJhbSB7Q2FsbGJhY2suPEFwcHJvdmFsTGF5b3V0SW5mbz59IFtjYWxsYmFja10gLSBDYWxsYmFjayBmdW5jdGlvblxuICAgKiBAcmV0dXJucyB7UHJvbWlzZS48QXBwcm92YWxMYXlvdXRJbmZvPn1cbiAgICovXG4gIGFzeW5jIGFwcHJvdmFsTGF5b3V0cygpOiBQcm9taXNlPERlc2NyaWJlQXBwcm92YWxMYXlvdXRzUmVzdWx0PiB7XG4gICAgY29uc3QgdXJsID0gYC9zb2JqZWN0cy8ke3RoaXMudHlwZX0vZGVzY3JpYmUvYXBwcm92YWxMYXlvdXRzYDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5fY29ubi5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVzY3JpYmVBcHByb3ZhbExheW91dHNSZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBhbmQgZmV0Y2ggcmVjb3JkcyB3aGljaCBtYXRjaGVzIGdpdmVuIGNvbmRpdGlvbnNcbiAgICovXG4gIGZpbmQ8UiBleHRlbmRzIFJlY29yZCA9IFJlY29yZD4oXG4gICAgY29uZGl0aW9ucz86IE9wdGlvbmFsPFF1ZXJ5Q29uZGl0aW9uPFMsIE4+PixcbiAgKTogUXVlcnk8UywgTiwgU09iamVjdFJlY29yZDxTLCBOLCAnKicsIFI+LCAnUmVjb3Jkcyc+O1xuICBmaW5kPFxuICAgIFIgZXh0ZW5kcyBSZWNvcmQgPSBSZWNvcmQsXG4gICAgRlAgZXh0ZW5kcyBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4gPSBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4sXG4gICAgRlBDIGV4dGVuZHMgRmllbGRQcm9qZWN0aW9uQ29uZmlnID0gRmllbGRQYXRoU2NvcGVkUHJvamVjdGlvbjxTLCBOLCBGUD5cbiAgPihcbiAgICBjb25kaXRpb25zOiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBOPj4sXG4gICAgZmllbGRzPzogT3B0aW9uYWw8UXVlcnlGaWVsZDxTLCBOLCBGUD4+LFxuICAgIG9wdGlvbnM/OiBGaW5kT3B0aW9uczxTLCBOPixcbiAgKTogUXVlcnk8UywgTiwgU09iamVjdFJlY29yZDxTLCBOLCBGUEMsIFI+LCAnUmVjb3Jkcyc+O1xuICBmaW5kKFxuICAgIGNvbmRpdGlvbnM/OiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBOPj4sXG4gICAgZmllbGRzPzogT3B0aW9uYWw8UXVlcnlGaWVsZDxTLCBOLCBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4+PixcbiAgICBvcHRpb25zOiBGaW5kT3B0aW9uczxTLCBOPiA9IHt9LFxuICApOiBRdWVyeTxTLCBOLCBhbnksICdSZWNvcmRzJz4ge1xuICAgIGNvbnN0IHsgc29ydCwgbGltaXQsIG9mZnNldCwgLi4ucW9wdGlvbnMgfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgY29uZmlnOiBRdWVyeUNvbmZpZzxTLCBOPiA9IHtcbiAgICAgIGZpZWxkczogZmllbGRzID09IG51bGwgPyB1bmRlZmluZWQgOiBmaWVsZHMsXG4gICAgICBpbmNsdWRlczogb3B0aW9ucy5pbmNsdWRlcyxcbiAgICAgIHRhYmxlOiB0aGlzLnR5cGUsXG4gICAgICBjb25kaXRpb25zOiBjb25kaXRpb25zID09IG51bGwgPyB1bmRlZmluZWQgOiBjb25kaXRpb25zLFxuICAgICAgc29ydCxcbiAgICAgIGxpbWl0LFxuICAgICAgb2Zmc2V0LFxuICAgIH07XG4gICAgY29uc3QgcXVlcnkgPSBuZXcgUXVlcnk8UywgTj4odGhpcy5fY29ubiwgY29uZmlnLCBxb3B0aW9ucyk7XG4gICAgcmV0dXJuIHF1ZXJ5LnNldFJlc3BvbnNlVGFyZ2V0KFJlc3BvbnNlVGFyZ2V0cy5SZWNvcmRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaCBvbmUgcmVjb3JkIHdoaWNoIG1hdGNoZXMgZ2l2ZW4gY29uZGl0aW9uc1xuICAgKi9cbiAgZmluZE9uZTxSIGV4dGVuZHMgUmVjb3JkID0gUmVjb3JkPihcbiAgICBjb25kaXRpb25zPzogT3B0aW9uYWw8UXVlcnlDb25kaXRpb248UywgTj4+LFxuICApOiBRdWVyeTxTLCBOLCBTT2JqZWN0UmVjb3JkPFMsIE4sICcqJywgUj4sICdTaW5nbGVSZWNvcmQnPjtcbiAgZmluZE9uZTxcbiAgICBSIGV4dGVuZHMgUmVjb3JkID0gUmVjb3JkLFxuICAgIEZQIGV4dGVuZHMgRmllbGRQYXRoU3BlY2lmaWVyPFMsIE4+ID0gRmllbGRQYXRoU3BlY2lmaWVyPFMsIE4+LFxuICAgIEZQQyBleHRlbmRzIEZpZWxkUHJvamVjdGlvbkNvbmZpZyA9IEZpZWxkUGF0aFNjb3BlZFByb2plY3Rpb248UywgTiwgRlA+XG4gID4oXG4gICAgY29uZGl0aW9uczogT3B0aW9uYWw8UXVlcnlDb25kaXRpb248UywgTj4+LFxuICAgIGZpZWxkcz86IE9wdGlvbmFsPFF1ZXJ5RmllbGQ8UywgTiwgRlA+PixcbiAgICBvcHRpb25zPzogRmluZE9wdGlvbnM8UywgTj4sXG4gICk6IFF1ZXJ5PFMsIE4sIFNPYmplY3RSZWNvcmQ8UywgTiwgRlBDLCBSPiwgJ1NpbmdsZVJlY29yZCc+O1xuICBmaW5kT25lKFxuICAgIGNvbmRpdGlvbnM/OiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBOPj4sXG4gICAgZmllbGRzPzogT3B0aW9uYWw8UXVlcnlGaWVsZDxTLCBOLCBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4+PixcbiAgICBvcHRpb25zOiBGaW5kT3B0aW9uczxTLCBOPiA9IHt9LFxuICApOiBRdWVyeTxTLCBOLCBhbnksICdTaW5nbGVSZWNvcmQnPiB7XG4gICAgY29uc3QgcXVlcnkgPSB0aGlzLmZpbmQoY29uZGl0aW9ucywgZmllbGRzLCB7IC4uLm9wdGlvbnMsIGxpbWl0OiAxIH0pO1xuICAgIHJldHVybiBxdWVyeS5zZXRSZXNwb25zZVRhcmdldChSZXNwb25zZVRhcmdldHMuU2luZ2xlUmVjb3JkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIGFuZCBmZXRjaCByZWNvcmRzIG9ubHkgYnkgc3BlY2lmeWluZyBmaWVsZHMgdG8gZmV0Y2guXG4gICAqL1xuICBzZWxlY3Q8XG4gICAgUiBleHRlbmRzIFJlY29yZCA9IFJlY29yZCxcbiAgICBGUCBleHRlbmRzIEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPixcbiAgICBGUEMgZXh0ZW5kcyBGaWVsZFByb2plY3Rpb25Db25maWcgPSBGaWVsZFBhdGhTY29wZWRQcm9qZWN0aW9uPFMsIE4sIEZQPlxuICA+KFxuICAgIGZpZWxkczogUXVlcnlGaWVsZDxTLCBOLCBGUD4sXG4gICk6IFF1ZXJ5PFMsIE4sIFNPYmplY3RSZWNvcmQ8UywgTiwgRlBDLCBSPiwgJ1JlY29yZHMnPiB7XG4gICAgcmV0dXJuIHRoaXMuZmluZChudWxsLCBmaWVsZHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvdW50IG51bSBvZiByZWNvcmRzIHdoaWNoIG1hdGNoZXMgZ2l2ZW4gY29uZGl0aW9uc1xuICAgKi9cbiAgY291bnQoY29uZGl0aW9ucz86IE9wdGlvbmFsPFF1ZXJ5Q29uZGl0aW9uPFMsIE4+Pikge1xuICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5maW5kKGNvbmRpdGlvbnMsICdjb3VudCgpJyk7XG4gICAgcmV0dXJuIHF1ZXJ5LnNldFJlc3BvbnNlVGFyZ2V0KFJlc3BvbnNlVGFyZ2V0cy5Db3VudCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbGlzdCBvZiBsaXN0IHZpZXdzIGZvciB0aGUgU09iamVjdFxuICAgKlxuICAgKiBAcGFyYW0ge0NhbGxiYWNrLjxMaXN0Vmlld3NJbmZvPn0gW2NhbGxiYWNrXSAtIENhbGxiYWNrIGZ1bmN0aW9uXG4gICAqIEByZXR1cm5zIHtQcm9taXNlLjxMaXN0Vmlld3NJbmZvPn1cbiAgICovXG4gIGxpc3R2aWV3cygpIHtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9jb25uLl9iYXNlVXJsKCl9L3NvYmplY3RzLyR7dGhpcy50eXBlfS9saXN0dmlld3NgO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3QodXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBsaXN0IHZpZXcgaW5mbyBpbiBzcGVjaWZlZCB2aWV3IGlkXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCAtIExpc3QgdmlldyBJRFxuICAgKiBAcmV0dXJucyB7TGlzdFZpZXd9XG4gICAqL1xuICBsaXN0dmlldyhpZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBMaXN0Vmlldyh0aGlzLl9jb25uLCB0aGlzLnR5cGUsIGlkKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYWxsIHJlZ2lzdGVyZWQgcXVpY2sgYWN0aW9ucyBmb3IgdGhlIFNPYmplY3RcbiAgICpcbiAgICogQHBhcmFtIHtDYWxsYmFjay48QXJyYXkuPFF1aWNrQWN0aW9uflF1aWNrQWN0aW9uSW5mbz4+fSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMge1Byb21pc2UuPEFycmF5LjxRdWlja0FjdGlvbn5RdWlja0FjdGlvbkluZm8+Pn1cbiAgICovXG4gIHF1aWNrQWN0aW9ucygpIHtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0KGAvc29iamVjdHMvJHt0aGlzLnR5cGV9L3F1aWNrQWN0aW9uc2ApO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCByZWZlcmVuY2UgZm9yIHNwZWNpZmllZCBxdWljayBhY2l0b24gaW4gdGhlIFNPYmplY3RcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGFjdGlvbk5hbWUgLSBOYW1lIG9mIHRoZSBxdWljayBhY3Rpb25cbiAgICogQHJldHVybnMge1F1aWNrQWN0aW9ufVxuICAgKi9cbiAgcXVpY2tBY3Rpb24oYWN0aW9uTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBRdWlja0FjdGlvbihcbiAgICAgIHRoaXMuX2Nvbm4sXG4gICAgICBgL3NvYmplY3RzLyR7dGhpcy50eXBlfS9xdWlja0FjdGlvbnMvJHthY3Rpb25OYW1lfWAsXG4gICAgKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgY2xhc3MgZm9yIG9yZ2FuaXppbmcgbGlzdCB2aWV3IGluZm9ybWF0aW9uXG4gKlxuICogQHByb3RlY3RlZFxuICogQGNsYXNzIExpc3RWaWV3XG4gKiBAcGFyYW0ge0Nvbm5lY3Rpb259IGNvbm4gLSBDb25uZWN0aW9uIGluc3RhbmNlXG4gKiBAcGFyYW0ge1NPYmplY3R9IHR5cGUgLSBTT2JqZWN0IHR5cGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZCAtIExpc3QgdmlldyBJRFxuICovXG5jbGFzcyBMaXN0VmlldyB7XG4gIF9jb25uOiBDb25uZWN0aW9uO1xuICB0eXBlOiBzdHJpbmc7XG4gIGlkOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uLCB0eXBlOiBzdHJpbmcsIGlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9jb25uID0gY29ubjtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBxdWVyeSBmb3IgdGhlIGxpc3QgdmlldyBhbmQgcmV0dXJucyB0aGUgcmVzdWx0aW5nIGRhdGEgYW5kIHByZXNlbnRhdGlvbiBpbmZvcm1hdGlvbi5cbiAgICovXG4gIHJlc3VsdHMoKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29ubi5fYmFzZVVybCgpfS9zb2JqZWN0cy8ke3RoaXMudHlwZX0vbGlzdHZpZXdzLyR7XG4gICAgICB0aGlzLmlkXG4gICAgfS9yZXN1bHRzYDtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0KHVybCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBkZXRhaWxlZCBpbmZvcm1hdGlvbiBhYm91dCBhIGxpc3Qgdmlld1xuICAgKi9cbiAgZGVzY3JpYmUob3B0aW9uczogeyBoZWFkZXJzPzogeyBbbmFtZTogc3RyaW5nXTogc3RyaW5nIH0gfSA9IHt9KSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29ubi5fYmFzZVVybCgpfS9zb2JqZWN0cy8ke3RoaXMudHlwZX0vbGlzdHZpZXdzLyR7XG4gICAgICB0aGlzLmlkXG4gICAgfS9kZXNjcmliZWA7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdCh7IG1ldGhvZDogJ0dFVCcsIHVybCwgaGVhZGVyczogb3B0aW9ucy5oZWFkZXJzIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cGxhaW4gcGxhbiBmb3IgZXhlY3V0aW5nIGxpc3Qgdmlld1xuICAgKi9cbiAgZXhwbGFpbigpIHtcbiAgICBjb25zdCB1cmwgPSBgL3F1ZXJ5Lz9leHBsYWluPSR7dGhpcy5pZH1gO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8YW55Pih1cmwpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNPYmplY3Q7XG5cbi8vIFRPRE8gQnVsa1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0EsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBc0JBLElBQUFDLGdCQUFBLEdBQUFDLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBRyxNQUFBLEdBQUFDLHVCQUFBLENBQUFKLE9BQUE7QUFPQSxJQUFBSyxZQUFBLEdBQUFILHNCQUFBLENBQUFGLE9BQUE7QUFBeUMsU0FBQU0sUUFBQUMsTUFBQSxFQUFBQyxjQUFBLFFBQUFDLElBQUEsR0FBQUMsWUFBQSxDQUFBSCxNQUFBLE9BQUFJLDZCQUFBLFFBQUFDLE9BQUEsR0FBQUQsNkJBQUEsQ0FBQUosTUFBQSxPQUFBQyxjQUFBLEVBQUFJLE9BQUEsR0FBQUMsdUJBQUEsQ0FBQUQsT0FBQSxFQUFBRSxJQUFBLENBQUFGLE9BQUEsWUFBQUcsR0FBQSxXQUFBQyxnQ0FBQSxDQUFBVCxNQUFBLEVBQUFRLEdBQUEsRUFBQUUsVUFBQSxNQUFBUixJQUFBLENBQUFTLElBQUEsQ0FBQUMsS0FBQSxDQUFBVixJQUFBLEVBQUFHLE9BQUEsWUFBQUgsSUFBQTtBQUFBLFNBQUFXLGNBQUFDLE1BQUEsYUFBQUMsQ0FBQSxNQUFBQSxDQUFBLEdBQUFDLFNBQUEsQ0FBQUMsTUFBQSxFQUFBRixDQUFBLFVBQUFHLE1BQUEsR0FBQUYsU0FBQSxDQUFBRCxDQUFBLFlBQUFDLFNBQUEsQ0FBQUQsQ0FBQSxZQUFBQSxDQUFBLFlBQUFJLFNBQUEsRUFBQUMsd0JBQUEsQ0FBQUQsU0FBQSxHQUFBcEIsT0FBQSxDQUFBc0Is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