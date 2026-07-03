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
var _Object$keys2 = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.array.sort");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SubQuery = exports.Query = exports.ResponseTargets = void 0;
var _slice = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/slice"));
var _concat = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/concat"));
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _entries = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/entries"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));
var _includes = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/includes"));
var _sort = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/sort"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _reduce = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/reduce"));
var _events = require("events");
var _logger = require("./util/logger");
var _recordStream = _interopRequireWildcard(require("./record-stream"));
var _soqlBuilder = require("./soql-builder");
function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context15; _forEachInstanceProperty(_context15 = ownKeys(Object(source), true)).call(_context15, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context16; _forEachInstanceProperty(_context16 = ownKeys(Object(source))).call(_context16, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           * @file Manages query for records in Salesforce
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           */
/**
 *
 */

/**
 *
 */

/**
 *
 */

const ResponseTargetValues = ['QueryResult', 'Records', 'SingleRecord', 'Count'];
const ResponseTargets = (0, _reduce.default)(ResponseTargetValues).call(ResponseTargetValues, (values, target) => _objectSpread(_objectSpread({}, values), {}, {
  [target]: target
}), {});

// QRT extends 'Count'
exports.ResponseTargets = ResponseTargets;
/**
 *
 */
const DEFAULT_BULK_THRESHOLD = 200;
const DEFAULT_BULK_API_VERSION = 1;

/**
 * Query
 */
class Query extends _events.EventEmitter {
  /**
   *
   */
  constructor(conn, config, options) {
    super();
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "_soql", void 0);
    (0, _defineProperty2.default)(this, "_locator", void 0);
    (0, _defineProperty2.default)(this, "_config", {});
    (0, _defineProperty2.default)(this, "_children", []);
    (0, _defineProperty2.default)(this, "_options", void 0);
    (0, _defineProperty2.default)(this, "_executed", false);
    (0, _defineProperty2.default)(this, "_finished", false);
    (0, _defineProperty2.default)(this, "_chaining", false);
    (0, _defineProperty2.default)(this, "_promise", void 0);
    (0, _defineProperty2.default)(this, "_stream", void 0);
    (0, _defineProperty2.default)(this, "totalSize", 0);
    (0, _defineProperty2.default)(this, "totalFetched", 0);
    (0, _defineProperty2.default)(this, "records", []);
    (0, _defineProperty2.default)(this, "offset", this.skip);
    (0, _defineProperty2.default)(this, "orderby", (0, _sort.default)(this));
    (0, _defineProperty2.default)(this, "exec", this.execute);
    (0, _defineProperty2.default)(this, "run", this.execute);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    this._conn = conn;
    this._logger = conn._logLevel ? Query._logger.createInstance(conn._logLevel) : Query._logger;
    if (typeof config === 'string') {
      this._soql = config;
      this._logger.debug(`config is soql: ${config}`);
    } else if (typeof config.locator === 'string') {
      const locator = config.locator;
      this._logger.debug(`config is locator: ${locator}`);
      this._locator = (0, _includes.default)(locator).call(locator, '/') ? this.urlToLocator(locator) : locator;
    } else {
      this._logger.debug(`config is QueryConfig: ${config}`);
      const _ref = config,
        {
          fields,
          includes,
          sort
        } = _ref,
        _config = (0, _objectWithoutProperties2.default)(_ref, ["fields", "includes", "sort"]);
      this._config = _config;
      this.select(fields);
      if (includes) {
        this.includeChildren(includes);
      }
      if (sort) {
        var _context;
        (0, _sort.default)(_context = this).call(_context, sort);
      }
    }
    this._options = _objectSpread({
      headers: {},
      maxFetch: 10000,
      autoFetch: false,
      scanAll: false,
      responseTarget: 'QueryResult'
    }, options || {});
    // promise instance
    this._promise = new _promise.default((resolve, reject) => {
      this.on('response', resolve);
      this.on('error', reject);
    });
    this._stream = new _recordStream.Serializable();
    this.on('record', record => this._stream.push(record));
    this.on('end', () => this._stream.push(null));
    this.on('error', err => {
      try {
        this._stream.emit('error', err);
      } catch (e) {
        // eslint-disable-line no-empty
      }
    });
  }

  /**
   * Select fields to include in the returning result
   */
  select(fields = '*') {
    if (this._soql) {
      throw Error('Cannot set select fields for the query which has already built SOQL.');
    }
    function toFieldArray(fields) {
      var _context2, _context3, _context4, _context5;
      return typeof fields === 'string' ? fields.split(/\s*,\s*/) : (0, _isArray.default)(fields) ? (0, _reduce.default)(_context2 = (0, _map.default)(_context3 = fields).call(_context3, toFieldArray)).call(_context2, (fs, f) => [...fs, ...f], []) : (0, _reduce.default)(_context4 = (0, _map.default)(_context5 = (0, _entries.default)(fields)).call(_context5, ([f, v]) => {
        if (typeof v === 'number' || typeof v === 'boolean') {
          return v ? [f] : [];
        } else {
          var _context6;
          return (0, _map.default)(_context6 = toFieldArray(v)).call(_context6, p => `${f}.${p}`);
        }
      })).call(_context4, (fs, f) => [...fs, ...f], []);
    }
    if (fields) {
      this._config.fields = toFieldArray(fields);
    }
    // force convert query record type without changing instance;
    return this;
  }

  /**
   * Set query conditions to filter the result records
   */
  where(conditions) {
    if (this._soql) {
      throw Error('Cannot set where conditions for the query which has already built SOQL.');
    }
    this._config.conditions = conditions;
    return this;
  }

  /**
   * Limit the returning result
   */
  limit(limit) {
    if (this._soql) {
      throw Error('Cannot set limit for the query which has already built SOQL.');
    }
    this._config.limit = limit;
    return this;
  }

  /**
   * Skip records
   */
  skip(offset) {
    if (this._soql) {
      throw Error('Cannot set skip/offset for the query which has already built SOQL.');
    }
    this._config.offset = offset;
    return this;
  }

  /**
   * Synonym of Query#skip()
   */

  /**
   * Set query sort with direction
   */

  sort(sort, dir) {
    if (this._soql) {
      throw Error('Cannot set sort for the query which has already built SOQL.');
    }
    if (typeof sort === 'string' && typeof dir !== 'undefined') {
      this._config.sort = [[sort, dir]];
    } else {
      this._config.sort = sort;
    }
    return this;
  }

  /**
   * Synonym of Query#sort()
   */

  /**
   * Include child relationship query and move down to the child query context
   */

  include(childRelName, conditions, fields, options = {}) {
    if (this._soql) {
      throw Error('Cannot include child relationship into the query which has already built SOQL.');
    }
    const childConfig = {
      fields: fields === null ? undefined : fields,
      table: childRelName,
      conditions: conditions === null ? undefined : conditions,
      limit: options.limit,
      offset: options.offset,
      sort: (0, _sort.default)(options)
    };
    // eslint-disable-next-line no-use-before-define
    const childQuery = new SubQuery(this._conn, childRelName, childConfig, this);
    this._children.push(childQuery);
    return childQuery;
  }

  /**
   * Include child relationship queries, but not moving down to the children context
   */
  includeChildren(includes) {
    if (this._soql) {
      throw Error('Cannot include child relationship into the query which has already built SOQL.');
    }
    for (const crname of (0, _keys.default)(includes)) {
      const _ref2 = includes[crname],
        {
          conditions,
          fields
        } = _ref2,
        options = (0, _objectWithoutProperties2.default)(_ref2, ["conditions", "fields"]);
      this.include(crname, conditions, fields, options);
    }
    return this;
  }

  /**
   * Setting maxFetch query option
   */
  maxFetch(maxFetch) {
    this._options.maxFetch = maxFetch;
    return this;
  }

  /**
   * Switching auto fetch mode
   */
  autoFetch(autoFetch) {
    this._options.autoFetch = autoFetch;
    return this;
  }

  /**
   * Set flag to scan all records including deleted and archived.
   */
  scanAll(scanAll) {
    this._options.scanAll = scanAll;
    return this;
  }

  /**
   *
   */
  setResponseTarget(responseTarget) {
    if (responseTarget in ResponseTargets) {
      this._options.responseTarget = responseTarget;
    }
    // force change query response target without changing instance
    return this;
  }

  /**
   * Execute query and fetch records from server.
   */
  execute(options_ = {}) {
    if (this._executed) {
      throw new Error('re-executing already executed query');
    }
    if (this._finished) {
      throw new Error('executing already closed query');
    }
    const options = {
      headers: options_.headers || this._options.headers,
      responseTarget: options_.responseTarget || this._options.responseTarget,
      autoFetch: options_.autoFetch || this._options.autoFetch,
      maxFetch: options_.maxFetch || this._options.maxFetch,
      scanAll: options_.scanAll || this._options.scanAll
    };

    // collect fetched records in array
    // only when response target is Records and
    // either callback or chaining promises are available to this query.
    this.once('fetch', () => {
      if (options.responseTarget === ResponseTargets.Records && this._chaining) {
        this._logger.debug('--- collecting all fetched records ---');
        const records = [];
        const onRecord = record => records.push(record);
        this.on('record', onRecord);
        this.once('end', () => {
          this.removeListener('record', onRecord);
          this.emit('response', records, this);
        });
      }
    });

    // flag to prevent re-execution
    this._executed = true;
    (async () => {
      // start actual query
      this._logger.debug('>>> Query start >>>');
      try {
        await this._execute(options);
        this._logger.debug('*** Query finished ***');
      } catch (error) {
        this._logger.debug('--- Query error ---', error);
        this.emit('error', error);
      }
    })();

    // return Query instance for chaining
    return this;
  }

  /**
   * Synonym of Query#execute()
   */

  /**
   * Synonym of Query#execute()
   */

  locatorToUrl() {
    return this._locator ? [this._conn._baseUrl(), '/query/', this._locator].join('') : '';
  }
  urlToLocator(url) {
    return url.split('/').pop();
  }
  constructResponse(rawDone, responseTarget) {
    var _this$records$, _this$records;
    switch (responseTarget) {
      case 'Count':
        return this.totalSize;
      case 'SingleRecord':
        return (_this$records$ = (_this$records = this.records) === null || _this$records === void 0 ? void 0 : _this$records[0]) !== null && _this$records$ !== void 0 ? _this$records$ : null;
      case 'Records':
        return this.records;
      // QueryResult is default response target
      default:
        return _objectSpread(_objectSpread({}, {
          records: this.records,
          totalSize: this.totalSize,
          done: rawDone !== null && rawDone !== void 0 ? rawDone : true // when no records, done is omitted
        }), this._locator ? {
          nextRecordsUrl: this.locatorToUrl()
        } : {});
    }
  }
  /**
   * @private
   */
  async _execute(options) {
    var _this$records2, _context7, _data$records$length, _data$records;
    const {
      headers,
      responseTarget,
      autoFetch,
      maxFetch,
      scanAll
    } = options;
    this._logger.debug('execute with options', options);
    let url;
    if (this._locator) {
      url = this.locatorToUrl();
    } else {
      const soql = await this.toSOQL();
      this._logger.debug(`SOQL = ${soql}`);
      url = [this._conn._baseUrl(), '/', scanAll ? 'queryAll' : 'query', '?q=', encodeURIComponent(soql)].join('');
    }
    const data = await this._conn.request({
      method: 'GET',
      url,
      headers
    });
    this.emit('fetch');
    this.totalSize = data.totalSize;
    this.records = (_this$records2 = this.records) === null || _this$records2 === void 0 ? void 0 : (0, _concat.default)(_this$records2).call(_this$records2, maxFetch - this.records.length > data.records.length ? data.records : (0, _slice.default)(_context7 = data.records).call(_context7, 0, maxFetch - this.records.length));
    this._locator = data.nextRecordsUrl ? this.urlToLocator(data.nextRecordsUrl) : undefined;
    this._finished = this._finished || data.done || !autoFetch ||
    // this is what the response looks like when there are no results
    data.records.length === 0 && data.done === undefined;

    // streaming record instances
    const numRecords = (_data$records$length = (_data$records = data.records) === null || _data$records === void 0 ? void 0 : _data$records.length) !== null && _data$records$length !== void 0 ? _data$records$length : 0;
    let totalFetched = this.totalFetched;
    for (let i = 0; i < numRecords; i++) {
      if (totalFetched >= maxFetch) {
        this._finished = true;
        break;
      }
      const record = data.records[i];
      this.emit('record', record, totalFetched, this);
      totalFetched += 1;
    }
    this.totalFetched = totalFetched;
    if (this._finished) {
      const response = this.constructResponse(data.done, responseTarget);
      // only fire response event when it should be notified per fetch
      if (responseTarget !== ResponseTargets.Records) {
        this.emit('response', response, this);
      }
      this.emit('end');
      return response;
    } else {
      return this._execute(options);
    }
  }

  /**
   * Obtain readable stream instance
   */

  stream(type = 'csv') {
    if (!this._finished && !this._executed) {
      this.execute({
        autoFetch: true
      });
    }
    return type === 'record' ? this._stream : this._stream.stream(type);
  }

  /**
   * Pipe the queried records to another stream
   * This is for backward compatibility; Query is not a record stream instance anymore in 2.0.
   * If you want a record stream instance, use `Query#stream('record')`.
   */
  pipe(stream) {
    return this.stream('record').pipe(stream);
  }

  /**
   * @protected
   */
  async _expandFields(sobject_) {
    var _context8, _context9, _context10;
    if (this._soql) {
      throw new Error('Cannot expand fields for the query which has already built SOQL.');
    }
    const {
      fields = [],
      table = ''
    } = this._config;
    const sobject = sobject_ || table;
    this._logger.debug(`_expandFields: sobject = ${sobject}, fields = ${fields.join(', ')}`);
    const [efields] = await _promise.default.all([this._expandAsteriskFields(sobject, fields), ...(0, _map.default)(_context8 = this._children).call(_context8, async childQuery => {
      await childQuery._expandFields();
      return [];
    })]);
    this._config.fields = efields;
    this._config.includes = (0, _reduce.default)(_context9 = (0, _map.default)(_context10 = this._children).call(_context10, cquery => {
      const cconfig = cquery._query._config;
      return [cconfig.table, cconfig];
    })).call(_context9, (includes, [ctable, cconfig]) => _objectSpread(_objectSpread({}, includes), {}, {
      [ctable]: cconfig
    }), {});
  }

  /**
   *
   */
  async _findRelationObject(relName) {
    const table = this._config.table;
    if (!table) {
      throw new Error('No table information provided in the query');
    }
    this._logger.debug(`finding table for relation "${relName}" in "${table}"...`);
    const sobject = await this._conn.describe$(table);
    const upperRname = relName.toUpperCase();
    for (const cr of sobject.childRelationships) {
      if ((cr.relationshipName || '').toUpperCase() === upperRname && cr.childSObject) {
        return cr.childSObject;
      }
    }
    throw new Error(`No child relationship found: ${relName}`);
  }

  /**
   *
   */
  async _expandAsteriskFields(sobject, fields) {
    const expandedFields = await _promise.default.all((0, _map.default)(fields).call(fields, async field => this._expandAsteriskField(sobject, field)));
    return (0, _reduce.default)(expandedFields).call(expandedFields, (eflds, flds) => [...eflds, ...flds], []);
  }

  /**
   *
   */
  async _expandAsteriskField(sobject, field) {
    this._logger.debug(`expanding field "${field}" in "${sobject}"...`);
    const fpath = field.split('.');
    if (fpath[fpath.length - 1] === '*') {
      var _context11;
      const so = await this._conn.describe$(sobject);
      this._logger.debug(`table ${sobject} has been described`);
      if (fpath.length > 1) {
        const rname = fpath.shift();
        for (const f of so.fields) {
          if (f.relationshipName && rname && f.relationshipName.toUpperCase() === rname.toUpperCase()) {
            const rfield = f;
            const referenceTo = rfield.referenceTo || [];
            const rtable = referenceTo.length === 1 ? referenceTo[0] : 'Name';
            const fpaths = await this._expandAsteriskField(rtable, fpath.join('.'));
            return (0, _map.default)(fpaths).call(fpaths, fp => `${rname}.${fp}`);
          }
        }
        return [];
      }
      return (0, _map.default)(_context11 = so.fields).call(_context11, f => f.name);
    }
    return [field];
  }

  /**
   * Explain plan for executing query
   */
  async explain() {
    const soql = await this.toSOQL();
    this._logger.debug(`SOQL = ${soql}`);
    const url = `/query/?explain=${encodeURIComponent(soql)}`;
    return this._conn.request(url);
  }

  /**
   * Return SOQL expression for the query
   */
  async toSOQL() {
    if (this._soql) {
      return this._soql;
    }
    await this._expandFields();
    return (0, _soqlBuilder.createSOQL)(this._config);
  }

  /**
   * Promise/A+ interface
   * http://promises-aplus.github.io/promises-spec/
   *
   * Delegate to deferred promise, return promise instance for query result
   */
  then(onResolve, onReject) {
    this._chaining = true;
    if (!this._finished && !this._executed) {
      this.execute();
    }
    if (!this._promise) {
      throw new Error('invalid state: promise is not set after query execution');
    }
    return this._promise.then(onResolve, onReject);
  }
  catch(onReject) {
    return this.then(null, onReject);
  }
  promise() {
    return _promise.default.resolve(this);
  }

  /**
   * Bulk delete queried records
   */

  destroy(type, options) {
    var _options$bulkApiVersi;
    if (typeof type === 'object' && type !== null) {
      options = type;
      type = undefined;
    }
    options = options || {};
    const type_ = type || this._config.table;
    if (!type_) {
      throw new Error('SOQL based query needs SObject type information to bulk delete.');
    }
    // Set the threshold number to pass to bulk API
    const thresholdNum = options.allowBulk === false ? -1 : typeof options.bulkThreshold === 'number' ? options.bulkThreshold :
    // determine threshold if the connection version supports SObject collection API or not
    this._conn._ensureVersion(42) ? DEFAULT_BULK_THRESHOLD : this._conn._maxRequest / 2;
    const bulkApiVersion = (_options$bulkApiVersi = options.bulkApiVersion) !== null && _options$bulkApiVersi !== void 0 ? _options$bulkApiVersi : DEFAULT_BULK_API_VERSION;
    return new _promise.default((resolve, reject) => {
      const createBatch = () => this._conn.sobject(type_).deleteBulk().on('response', resolve).on('error', reject);
      let records = [];
      let batch = null;
      const handleRecord = rec => {
        if (!rec.Id) {
          const err = new Error('Queried record does not include Salesforce record ID.');
          this.emit('error', err);
          return;
        }
        const record = {
          Id: rec.Id
        };
        if (batch) {
          batch.write(record);
        } else {
          records.push(record);
          if (thresholdNum >= 0 && records.length > thresholdNum && bulkApiVersion === 1) {
            // Use bulk delete instead of SObject REST API
            batch = createBatch();
            for (const record of records) {
              batch.write(record);
            }
            records = [];
          }
        }
      };
      const handleEnd = () => {
        if (batch) {
          batch.end();
        } else {
          const ids = (0, _map.default)(records).call(records, record => record.Id);
          if (records.length > thresholdNum && bulkApiVersion === 2) {
            this._conn.bulk2.loadAndWaitForResults({
              object: type_,
              operation: 'delete',
              input: records
            }).then(allResults => resolve(this.mapBulkV2ResultsToSaveResults(allResults)), reject);
          } else {
            this._conn.sobject(type_).destroy(ids, {
              allowRecursive: true
            }).then(resolve, reject);
          }
        }
      };
      this.stream('record').on('data', handleRecord).on('end', handleEnd).on('error', reject);
    });
  }

  /**
   * Synonym of Query#destroy()
   */

  /**
   * Synonym of Query#destroy()
   */

  /**
   * Bulk update queried records, using given mapping function/object
   */

  update(mapping, type, options) {
    var _options$bulkApiVersi2;
    if (typeof type === 'object' && type !== null) {
      options = type;
      type = undefined;
    }
    options = options || {};
    const type_ = type || this._config && this._config.table;
    if (!type_) {
      throw new Error('SOQL based query needs SObject type information to bulk update.');
    }
    const updateStream = typeof mapping === 'function' ? (0, _map.default)(_recordStream.default).call(_recordStream.default, mapping) : _recordStream.default.recordMapStream(mapping);
    // Set the threshold number to pass to bulk API
    const thresholdNum = options.allowBulk === false ? -1 : typeof options.bulkThreshold === 'number' ? options.bulkThreshold :
    // determine threshold if the connection version supports SObject collection API or not
    this._conn._ensureVersion(42) ? DEFAULT_BULK_THRESHOLD : this._conn._maxRequest / 2;
    const bulkApiVersion = (_options$bulkApiVersi2 = options.bulkApiVersion) !== null && _options$bulkApiVersi2 !== void 0 ? _options$bulkApiVersi2 : DEFAULT_BULK_API_VERSION;
    return new _promise.default((resolve, reject) => {
      const createBatch = () => this._conn.sobject(type_).updateBulk().on('response', resolve).on('error', reject);
      let records = [];
      let batch = null;
      const handleRecord = record => {
        if (batch) {
          batch.write(record);
        } else {
          records.push(record);
        }
        if (thresholdNum >= 0 && records.length > thresholdNum && bulkApiVersion === 1) {
          // Use bulk update instead of SObject REST API
          batch = createBatch();
          for (const record of records) {
            batch.write(record);
          }
          records = [];
        }
      };
      const handleEnd = () => {
        if (batch) {
          batch.end();
        } else {
          if (records.length > thresholdNum && bulkApiVersion === 2) {
            this._conn.bulk2.loadAndWaitForResults({
              object: type_,
              operation: 'update',
              input: records
            }).then(allResults => resolve(this.mapBulkV2ResultsToSaveResults(allResults)), reject);
          } else {
            this._conn.sobject(type_).update(records, {
              allowRecursive: true
            }).then(resolve, reject);
          }
        }
      };
      this.stream('record').on('error', reject).pipe(updateStream).on('data', handleRecord).on('end', handleEnd).on('error', reject);
    });
  }
  mapBulkV2ResultsToSaveResults(bulkJobAllResults) {
    var _context12, _context13;
    const successSaveResults = (0, _map.default)(_context12 = bulkJobAllResults.successfulResults).call(_context12, r => {
      const saveResult = {
        id: r.sf__Id,
        success: true,
        errors: []
      };
      return saveResult;
    });
    const failedSaveResults = (0, _map.default)(_context13 = bulkJobAllResults.failedResults).call(_context13, r => {
      const saveResult = {
        success: false,
        errors: [{
          errorCode: r.sf__Error,
          message: r.sf__Error
        }]
      };
      return saveResult;
    });
    return [...successSaveResults, ...failedSaveResults];
  }
}

/*--------------------------------------------*/

/**
 * SubQuery object for representing child relationship query
 */
exports.Query = Query;
(0, _defineProperty2.default)(Query, "_logger", (0, _logger.getLogger)('query'));
class SubQuery {
  /**
   *
   */
  constructor(conn, relName, config, parent) {
    (0, _defineProperty2.default)(this, "_relName", void 0);
    (0, _defineProperty2.default)(this, "_query", void 0);
    (0, _defineProperty2.default)(this, "_parent", void 0);
    (0, _defineProperty2.default)(this, "offset", this.skip);
    (0, _defineProperty2.default)(this, "orderby", (0, _sort.default)(this));
    this._relName = relName;
    this._query = new Query(conn, config);
    this._parent = parent;
  }

  /**
   *
   */
  select(fields) {
    // force convert query record type without changing instance
    this._query = this._query.select(fields);
    return this;
  }

  /**
   *
   */
  where(conditions) {
    this._query = this._query.where(conditions);
    return this;
  }

  /**
   * Limit the returning result
   */
  limit(limit) {
    this._query = this._query.limit(limit);
    return this;
  }

  /**
   * Skip records
   */
  skip(offset) {
    this._query = this._query.skip(offset);
    return this;
  }

  /**
   * Synonym of SubQuery#skip()
   */

  /**
   * Set query sort with direction
   */

  sort(sort, dir) {
    var _context14;
    this._query = (0, _sort.default)(_context14 = this._query).call(_context14, sort, dir);
    return this;
  }

  /**
   * Synonym of SubQuery#sort()
   */

  /**
   *
   */
  async _expandFields() {
    const sobject = await this._parent._findRelationObject(this._relName);
    return this._query._expandFields(sobject);
  }

  /**
   * Back the context to parent query object
   */
  end() {
    return this._parent;
  }
}
exports.SubQuery = SubQuery;
var _default = Query;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9sb2dnZXIiLCJfcmVjb3JkU3RyZWFtIiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfc29xbEJ1aWxkZXIiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRrZXlzMiIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsIl9maWx0ZXJJbnN0YW5jZVByb3BlcnR5IiwiY2FsbCIsInN5bSIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiX2NvbnRleHQxNSIsIl9mb3JFYWNoSW5zdGFuY2VQcm9wZXJ0eSIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQxNiIsIl9PYmplY3QkZGVmaW5lUHJvcGVydHkiLCJSZXNwb25zZVRhcmdldFZhbHVlcyIsIlJlc3BvbnNlVGFyZ2V0cyIsIl9yZWR1Y2UiLCJ2YWx1ZXMiLCJleHBvcnRzIiwiREVGQVVMVF9CVUxLX1RIUkVTSE9MRCIsIkRFRkFVTFRfQlVMS19BUElfVkVSU0lPTiIsIlF1ZXJ5IiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJjb25uIiwiY29uZmlnIiwib3B0aW9ucyIsInNraXAiLCJfc29ydCIsImV4ZWN1dGUiLCJkZXN0cm95IiwiX2Nvbm4iLCJfbG9nTGV2ZWwiLCJjcmVhdGVJbnN0YW5jZSIsIl9zb3FsIiwiZGVidWciLCJsb2NhdG9yIiwiX2xvY2F0b3IiLCJfaW5jbHVkZXMiLCJ1cmxUb0xvY2F0b3IiLCJfcmVmIiwiZmllbGRzIiwiaW5jbHVkZXMiLCJzb3J0IiwiX2NvbmZpZyIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllczIiLCJzZWxlY3QiLCJpbmNsdWRlQ2hpbGRyZW4iLCJfY29udGV4dCIsIl9vcHRpb25zIiwiaGVhZGVycyIsIm1heEZldGNoIiwiYXV0b0ZldGNoIiwic2NhbkFsbCIsInJlc3BvbnNlVGFyZ2V0IiwiX3Byb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwib24iLCJfc3RyZWFtIiwiU2VyaWFsaXphYmxlIiwicmVjb3JkIiwiZXJyIiwiZW1pdCIsImUiLCJFcnJvciIsInRvRmllbGRBcnJheSIsIl9jb250ZXh0MiIsIl9jb250ZXh0MyIsIl9jb250ZXh0NCIsIl9jb250ZXh0NSIsInNwbGl0IiwiX2lzQXJyYXkiLCJfbWFwIiwiZnMiLCJmIiwiX2VudHJpZXMiLCJ2IiwiX2NvbnRleHQ2IiwicCIsIndoZXJlIiwiY29uZGl0aW9ucyIsImxpbWl0Iiwib2Zmc2V0IiwiZGlyIiwiaW5jbHVkZSIsImNoaWxkUmVsTmFtZSIsImNoaWxkQ29uZmlnIiwidW5kZWZpbmVkIiwidGFibGUiLCJjaGlsZFF1ZXJ5IiwiU3ViUXVlcnkiLCJfY2hpbGRyZW4iLCJjcm5hbWUiLCJfa2V5cyIsIl9yZWYyIiwic2V0UmVzcG9uc2VUYXJnZXQiLCJvcHRpb25zXyIsIl9leGVjdXRlZCIsIl9maW5pc2hlZCIsIm9uY2UiLCJSZWNvcmRzIiwiX2NoYWluaW5nIiwicmVjb3JkcyIsIm9uUmVjb3JkIiwicmVtb3ZlTGlzdGVuZXIiLCJfZXhlY3V0ZSIsImVycm9yIiwibG9jYXRvclRvVXJsIiwiX2Jhc2VVcmwiLCJqb2luIiwidXJsIiwicG9wIiwiY29uc3RydWN0UmVzcG9uc2UiLCJyYXdEb25lIiwiX3RoaXMkcmVjb3JkcyQiLCJfdGhpcyRyZWNvcmRzIiwidG90YWxTaXplIiwiZG9uZSIsIm5leHRSZWNvcmRzVXJsIiwiX3RoaXMkcmVjb3JkczIiLCJfY29udGV4dDciLCJfZGF0YSRyZWNvcmRzJGxlbmd0aCIsIl9kYXRhJHJlY29yZHMiLCJzb3FsIiwidG9TT1FMIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZGF0YSIsInJlcXVlc3QiLCJtZXRob2QiLCJfY29uY2F0IiwiX3NsaWNlIiwibnVtUmVjb3JkcyIsInRvdGFsRmV0Y2hlZCIsInJlc3BvbnNlIiwic3RyZWFtIiwidHlwZSIsInBpcGUiLCJfZXhwYW5kRmllbGRzIiwic29iamVjdF8iLCJfY29udGV4dDgiLCJfY29udGV4dDkiLCJfY29udGV4dDEwIiwic29iamVjdCIsImVmaWVsZHMiLCJhbGwiLCJfZXhwYW5kQXN0ZXJpc2tGaWVsZHMiLCJjcXVlcnkiLCJjY29uZmlnIiwiX3F1ZXJ5IiwiY3RhYmxlIiwiX2ZpbmRSZWxhdGlvbk9iamVjdCIsInJlbE5hbWUiLCJkZXNjcmliZSQiLCJ1cHBlclJuYW1lIiwidG9VcHBlckNhc2UiLCJjciIsImNoaWxkUmVsYXRpb25zaGlwcyIsInJlbGF0aW9uc2hpcE5hbWUiLCJjaGlsZFNPYmplY3QiLCJleHBhbmRlZEZpZWxkcyIsImZpZWxkIiwiX2V4cGFuZEFzdGVyaXNrRmllbGQiLCJlZmxkcyIsImZsZHMiLCJmcGF0aCIsIl9jb250ZXh0MTEiLCJzbyIsInJuYW1lIiwic2hpZnQiLCJyZmllbGQiLCJyZWZlcmVuY2VUbyIsInJ0YWJsZSIsImZwYXRocyIsImZwIiwibmFtZSIsImV4cGxhaW4iLCJjcmVhdGVTT1FMIiwidGhlbiIsIm9uUmVzb2x2ZSIsIm9uUmVqZWN0IiwiY2F0Y2giLCJwcm9taXNlIiwiX29wdGlvbnMkYnVsa0FwaVZlcnNpIiwidHlwZV8iLCJ0aHJlc2hvbGROdW0iLCJhbGxvd0J1bGsiLCJidWxrVGhyZXNob2xkIiwiX2Vuc3VyZVZlcnNpb24iLCJfbWF4UmVxdWVzdCIsImJ1bGtBcGlWZXJzaW9uIiwiY3JlYXRlQmF0Y2giLCJkZWxldGVCdWxrIiwiYmF0Y2giLCJoYW5kbGVSZWNvcmQiLCJyZWMiLCJJZCIsIndyaXRlIiwiaGFuZGxlRW5kIiwiZW5kIiwiaWRzIiwiYnVsazIiLCJsb2FkQW5kV2FpdEZvclJlc3VsdHMiLCJvcGVyYXRpb24iLCJpbnB1dCIsImFsbFJlc3VsdHMiLCJtYXBCdWxrVjJSZXN1bHRzVG9TYXZlUmVzdWx0cyIsImFsbG93UmVjdXJzaXZlIiwidXBkYXRlIiwibWFwcGluZyIsIl9vcHRpb25zJGJ1bGtBcGlWZXJzaTIiLCJ1cGRhdGVTdHJlYW0iLCJSZWNvcmRTdHJlYW0iLCJyZWNvcmRNYXBTdHJlYW0iLCJ1cGRhdGVCdWxrIiwiYnVsa0pvYkFsbFJlc3VsdHMiLCJfY29udGV4dDEyIiwiX2NvbnRleHQxMyIsInN1Y2Nlc3NTYXZlUmVzdWx0cyIsInN1Y2Nlc3NmdWxSZXN1bHRzIiwiciIsInNhdmVSZXN1bHQiLCJpZCIsInNmX19JZCIsInN1Y2Nlc3MiLCJlcnJvcnMiLCJmYWlsZWRTYXZlUmVzdWx0cyIsImZhaWxlZFJlc3VsdHMiLCJlcnJvckNvZGUiLCJzZl9fRXJyb3IiLCJtZXNzYWdlIiwiZ2V0TG9nZ2VyIiwicGFyZW50IiwiX3JlbE5hbWUiLCJfcGFyZW50IiwiX2NvbnRleHQxNCIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vc3JjL3F1ZXJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgTWFuYWdlcyBxdWVyeSBmb3IgcmVjb3JkcyBpbiBTYWxlc2ZvcmNlXG4gKiBAYXV0aG9yIFNoaW5pY2hpIFRvbWl0YSA8c2hpbmljaGkudG9taXRhQGdtYWlsLmNvbT5cbiAqL1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IExvZ2dlciwgZ2V0TG9nZ2VyIH0gZnJvbSAnLi91dGlsL2xvZ2dlcic7XG5pbXBvcnQgUmVjb3JkU3RyZWFtLCB7IFNlcmlhbGl6YWJsZSB9IGZyb20gJy4vcmVjb3JkLXN0cmVhbSc7XG5pbXBvcnQgQ29ubmVjdGlvbiBmcm9tICcuL2Nvbm5lY3Rpb24nO1xuaW1wb3J0IHsgY3JlYXRlU09RTCB9IGZyb20gJy4vc29xbC1idWlsZGVyJztcbmltcG9ydCB7IFF1ZXJ5Q29uZmlnIGFzIFNPUUxRdWVyeUNvbmZpZywgU29ydERpciB9IGZyb20gJy4vc29xbC1idWlsZGVyJztcbmltcG9ydCB7XG4gIFJlY29yZCxcbiAgT3B0aW9uYWwsXG4gIFNjaGVtYSxcbiAgU09iamVjdE5hbWVzLFxuICBDaGlsZFJlbGF0aW9uc2hpcE5hbWVzLFxuICBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lLFxuICBGaWVsZFByb2plY3Rpb25Db25maWcsXG4gIEZpZWxkUGF0aFNwZWNpZmllcixcbiAgRmllbGRQYXRoU2NvcGVkUHJvamVjdGlvbixcbiAgU09iamVjdFJlY29yZCxcbiAgU09iamVjdElucHV0UmVjb3JkLFxuICBTT2JqZWN0VXBkYXRlUmVjb3JkLFxuICBTYXZlUmVzdWx0LFxuICBEYXRlU3RyaW5nLFxuICBTT2JqZWN0Q2hpbGRSZWxhdGlvbnNoaXBQcm9wLFxuICBTT2JqZWN0RmllbGROYW1lcyxcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgU2ZEYXRlIGZyb20gJy4vZGF0ZSc7XG5pbXBvcnQgeyBJbmdlc3RKb2JWMlJlc3VsdHMgfSBmcm9tICcuL2FwaS9idWxrJztcblxuLyoqXG4gKlxuICovXG5leHBvcnQgdHlwZSBRdWVyeUZpZWxkPFxuICBTIGV4dGVuZHMgU2NoZW1hLFxuICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICBGUCBleHRlbmRzIEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPlxuPiA9IEZQIHwgRlBbXSB8IHN0cmluZyB8IHN0cmluZ1tdIHwgeyBbZmllbGQ6IHN0cmluZ106IG51bWJlciB8IGJvb2xlYW4gfTtcblxuLyoqXG4gKlxuICovXG50eXBlIENWYWx1ZTxUPiA9IFQgZXh0ZW5kcyBEYXRlU3RyaW5nXG4gID8gU2ZEYXRlXG4gIDogVCBleHRlbmRzIHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW5cbiAgPyBUXG4gIDogbmV2ZXI7XG5cbnR5cGUgQ29uZE9wPFQ+ID1cbiAgfCBbJyRlcScsIENWYWx1ZTxUPiB8IG51bGxdXG4gIHwgWyckbmUnLCBDVmFsdWU8VD4gfCBudWxsXVxuICB8IFsnJGd0JywgQ1ZhbHVlPFQ+XVxuICB8IFsnJGd0ZScsIENWYWx1ZTxUPl1cbiAgfCBbJyRsdCcsIENWYWx1ZTxUPl1cbiAgfCBbJyRsdGUnLCBDVmFsdWU8VD5dXG4gIHwgWyckbGlrZScsIFQgZXh0ZW5kcyBzdHJpbmcgPyBUIDogbmV2ZXJdXG4gIHwgWyckbmxpa2UnLCBUIGV4dGVuZHMgc3RyaW5nID8gVCA6IG5ldmVyXVxuICB8IFsnJGluJywgQXJyYXk8Q1ZhbHVlPFQ+Pl1cbiAgfCBbJyRuaW4nLCBBcnJheTxDVmFsdWU8VD4+XVxuICB8IFsnJGluY2x1ZGVzJywgVCBleHRlbmRzIHN0cmluZyA/IFRbXSA6IG5ldmVyXVxuICB8IFsnJGV4Y2x1ZGVzJywgVCBleHRlbmRzIHN0cmluZyA/IFRbXSA6IG5ldmVyXVxuICB8IFsnJGV4aXN0cycsIGJvb2xlYW5dO1xuXG50eXBlIENvbmRWYWx1ZU9iajxULCBPcCA9IENvbmRPcDxUPlswXT4gPSBPcCBleHRlbmRzIENvbmRPcDxUPlswXVxuICA/IE9wIGV4dGVuZHMgc3RyaW5nXG4gICAgPyB7IFtLIGluIE9wXTogRXh0cmFjdDxDb25kT3A8VD4sIFtPcCwgYW55XT5bMV0gfVxuICAgIDogbmV2ZXJcbiAgOiBuZXZlcjtcblxudHlwZSBDb25kVmFsdWU8VD4gPSBDVmFsdWU8VD4gfCBBcnJheTxDVmFsdWU8VD4+IHwgbnVsbCB8IENvbmRWYWx1ZU9iajxUPjtcblxudHlwZSBDb25kaXRpb25TZXQ8UiBleHRlbmRzIFJlY29yZD4gPSB7XG4gIFtLIGluIGtleW9mIFJdPzogQ29uZFZhbHVlPFJbS10+O1xufTtcblxuZXhwb3J0IHR5cGUgUXVlcnlDb25kaXRpb248UyBleHRlbmRzIFNjaGVtYSwgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4gPVxuICB8IHtcbiAgICAgICRvcjogUXVlcnlDb25kaXRpb248UywgTj5bXTtcbiAgICB9XG4gIHwge1xuICAgICAgJGFuZDogUXVlcnlDb25kaXRpb248UywgTj5bXTtcbiAgICB9XG4gIHwgQ29uZGl0aW9uU2V0PFNPYmplY3RSZWNvcmQ8UywgTj4+O1xuXG5leHBvcnQgdHlwZSBRdWVyeVNvcnQ8XG4gIFMgZXh0ZW5kcyBTY2hlbWEsXG4gIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gIFIgZXh0ZW5kcyBTT2JqZWN0UmVjb3JkPFMsIE4+ID0gU09iamVjdFJlY29yZDxTLCBOPlxuPiA9XG4gIHwge1xuICAgICAgW0sgaW4ga2V5b2YgUl0/OiBTb3J0RGlyO1xuICAgIH1cbiAgfCBBcnJheTxba2V5b2YgUiwgU29ydERpcl0+O1xuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCB0eXBlIFF1ZXJ5Q29uZmlnPFxuICBTIGV4dGVuZHMgU2NoZW1hLFxuICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICBGUCBleHRlbmRzIEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBOPlxuPiA9IHtcbiAgZmllbGRzPzogUXVlcnlGaWVsZDxTLCBOLCBGUD47XG4gIGluY2x1ZGVzPzoge1xuICAgIFtDUk4gaW4gQ2hpbGRSZWxhdGlvbnNoaXBOYW1lczxTLCBOPl0/OiBRdWVyeUNvbmZpZzxcbiAgICAgIFMsXG4gICAgICBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lPFMsIE4sIENSTj5cbiAgICA+O1xuICB9O1xuICB0YWJsZT86IHN0cmluZztcbiAgY29uZGl0aW9ucz86IFF1ZXJ5Q29uZGl0aW9uPFMsIE4+O1xuICBzb3J0PzogUXVlcnlTb3J0PFMsIE4+O1xuICBsaW1pdD86IG51bWJlcjtcbiAgb2Zmc2V0PzogbnVtYmVyO1xufTtcblxuZXhwb3J0IHR5cGUgUXVlcnlPcHRpb25zID0ge1xuICBoZWFkZXJzOiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgbWF4RmV0Y2g6IG51bWJlcjtcbiAgYXV0b0ZldGNoOiBib29sZWFuO1xuICBzY2FuQWxsOiBib29sZWFuO1xuICByZXNwb25zZVRhcmdldDogUXVlcnlSZXNwb25zZVRhcmdldDtcbn07XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5UmVzdWx0PFIgZXh0ZW5kcyBSZWNvcmQ+ID0ge1xuICBkb25lOiBib29sZWFuO1xuICB0b3RhbFNpemU6IG51bWJlcjtcbiAgcmVjb3JkczogUltdO1xuICBuZXh0UmVjb3Jkc1VybD86IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXhwbGFpblJlc3VsdCA9IHtcbiAgcGxhbnM6IEFycmF5PHtcbiAgICBjYXJkaW5hbGl0eTogbnVtYmVyO1xuICAgIGZpZWxkczogc3RyaW5nW107XG4gICAgbGVhZGluZ09wZXJhdGlvblR5cGU6ICdJbmRleCcgfCAnT3RoZXInIHwgJ1NoYXJpbmcnIHwgJ1RhYmxlU2Nhbic7XG4gICAgbm90ZXM6IEFycmF5PHtcbiAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgICBmaWVsZHM6IHN0cmluZ1tdO1xuICAgICAgdGFibGVFbnVtT3JJZDogc3RyaW5nO1xuICAgIH0+O1xuICAgIHJlbGF0aXZlQ29zdDogbnVtYmVyO1xuICAgIHNvYmplY3RDYXJkaW5hbGl0eTogbnVtYmVyO1xuICAgIHNvYmplY3RUeXBlOiBzdHJpbmc7XG4gIH0+O1xufTtcblxuY29uc3QgUmVzcG9uc2VUYXJnZXRWYWx1ZXMgPSBbXG4gICdRdWVyeVJlc3VsdCcsXG4gICdSZWNvcmRzJyxcbiAgJ1NpbmdsZVJlY29yZCcsXG4gICdDb3VudCcsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgdHlwZSBRdWVyeVJlc3BvbnNlVGFyZ2V0ID0gdHlwZW9mIFJlc3BvbnNlVGFyZ2V0VmFsdWVzW251bWJlcl07XG5cbmV4cG9ydCBjb25zdCBSZXNwb25zZVRhcmdldHM6IHtcbiAgW0sgaW4gUXVlcnlSZXNwb25zZVRhcmdldF06IEs7XG59ID0gUmVzcG9uc2VUYXJnZXRWYWx1ZXMucmVkdWNlKFxuICAodmFsdWVzLCB0YXJnZXQpID0+ICh7IC4uLnZhbHVlcywgW3RhcmdldF06IHRhcmdldCB9KSxcbiAge30gYXMge1xuICAgIFtLIGluIFF1ZXJ5UmVzcG9uc2VUYXJnZXRdOiBLO1xuICB9LFxuKTtcblxuZXhwb3J0IHR5cGUgUXVlcnlSZXNwb25zZTxcbiAgUiBleHRlbmRzIFJlY29yZCxcbiAgUVJUIGV4dGVuZHMgUXVlcnlSZXNwb25zZVRhcmdldCA9IFF1ZXJ5UmVzcG9uc2VUYXJnZXRcbj4gPSBRUlQgZXh0ZW5kcyAnUXVlcnlSZXN1bHQnXG4gID8gUXVlcnlSZXN1bHQ8Uj5cbiAgOiBRUlQgZXh0ZW5kcyAnUmVjb3JkcydcbiAgPyBSW11cbiAgOiBRUlQgZXh0ZW5kcyAnU2luZ2xlUmVjb3JkJ1xuICA/IFIgfCBudWxsXG4gIDogbnVtYmVyOyAvLyBRUlQgZXh0ZW5kcyAnQ291bnQnXG5cbmV4cG9ydCB0eXBlIEJ1bGtBcGlWZXJzaW9uID0gMSB8IDI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RGVzdHJveU9wdGlvbnMgPSB7XG4gIGFsbG93QnVsaz86IGJvb2xlYW47XG4gIGJ1bGtUaHJlc2hvbGQ/OiBudW1iZXI7XG4gIGJ1bGtBcGlWZXJzaW9uPzogQnVsa0FwaVZlcnNpb247XG59O1xuXG5leHBvcnQgdHlwZSBRdWVyeVVwZGF0ZU9wdGlvbnMgPSB7XG4gIGFsbG93QnVsaz86IGJvb2xlYW47XG4gIGJ1bGtUaHJlc2hvbGQ/OiBudW1iZXI7XG4gIGJ1bGtBcGlWZXJzaW9uPzogQnVsa0FwaVZlcnNpb247XG59O1xuXG4vKipcbiAqXG4gKi9cbmNvbnN0IERFRkFVTFRfQlVMS19USFJFU0hPTEQgPSAyMDA7XG5jb25zdCBERUZBVUxUX0JVTEtfQVBJX1ZFUlNJT04gPSAxO1xuXG4vKipcbiAqIFF1ZXJ5XG4gKi9cbmV4cG9ydCBjbGFzcyBRdWVyeTxcbiAgUyBleHRlbmRzIFNjaGVtYSxcbiAgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPixcbiAgUiBleHRlbmRzIFJlY29yZCA9IFJlY29yZCxcbiAgUVJUIGV4dGVuZHMgUXVlcnlSZXNwb25zZVRhcmdldCA9IFF1ZXJ5UmVzcG9uc2VUYXJnZXRcbj4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBzdGF0aWMgX2xvZ2dlciA9IGdldExvZ2dlcigncXVlcnknKTtcblxuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcbiAgX2xvZ2dlcjogTG9nZ2VyO1xuICBfc29xbDogT3B0aW9uYWw8c3RyaW5nPjtcbiAgX2xvY2F0b3I6IE9wdGlvbmFsPHN0cmluZz47XG4gIF9jb25maWc6IFNPUUxRdWVyeUNvbmZpZyA9IHt9O1xuICBfY2hpbGRyZW46IFN1YlF1ZXJ5PFMsIE4sIFIsIFFSVCwgYW55LCBhbnksIGFueT5bXSA9IFtdO1xuICBfb3B0aW9uczogUXVlcnlPcHRpb25zO1xuICBfZXhlY3V0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgX2ZpbmlzaGVkOiBib29sZWFuID0gZmFsc2U7XG4gIF9jaGFpbmluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBfcHJvbWlzZTogUHJvbWlzZTxRdWVyeVJlc3BvbnNlPFIsIFFSVD4+O1xuICBfc3RyZWFtOiBTZXJpYWxpemFibGU8Uj47XG5cbiAgdG90YWxTaXplID0gMDtcbiAgdG90YWxGZXRjaGVkID0gMDtcbiAgcmVjb3JkczogUltdID0gW107XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBjb25uOiBDb25uZWN0aW9uPFM+LFxuICAgIGNvbmZpZzogc3RyaW5nIHwgUXVlcnlDb25maWc8UywgTj4gfCB7IGxvY2F0b3I6IHN0cmluZyB9LFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPFF1ZXJ5T3B0aW9ucz4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gICAgdGhpcy5fbG9nZ2VyID0gY29ubi5fbG9nTGV2ZWxcbiAgICAgID8gUXVlcnkuX2xvZ2dlci5jcmVhdGVJbnN0YW5jZShjb25uLl9sb2dMZXZlbClcbiAgICAgIDogUXVlcnkuX2xvZ2dlcjtcbiAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuX3NvcWwgPSBjb25maWc7XG4gICAgICB0aGlzLl9sb2dnZXIuZGVidWcoYGNvbmZpZyBpcyBzb3FsOiAke2NvbmZpZ31gKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiAoY29uZmlnIGFzIGFueSkubG9jYXRvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGxvY2F0b3I6IHN0cmluZyA9IChjb25maWcgYXMgYW55KS5sb2NhdG9yO1xuICAgICAgdGhpcy5fbG9nZ2VyLmRlYnVnKGBjb25maWcgaXMgbG9jYXRvcjogJHtsb2NhdG9yfWApO1xuICAgICAgdGhpcy5fbG9jYXRvciA9IGxvY2F0b3IuaW5jbHVkZXMoJy8nKVxuICAgICAgICA/IHRoaXMudXJsVG9Mb2NhdG9yKGxvY2F0b3IpXG4gICAgICAgIDogbG9jYXRvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbG9nZ2VyLmRlYnVnKGBjb25maWcgaXMgUXVlcnlDb25maWc6ICR7Y29uZmlnfWApO1xuICAgICAgY29uc3QgeyBmaWVsZHMsIGluY2x1ZGVzLCBzb3J0LCAuLi5fY29uZmlnIH0gPSBjb25maWcgYXMgUXVlcnlDb25maWc8XG4gICAgICAgIFMsXG4gICAgICAgIE5cbiAgICAgID47XG4gICAgICB0aGlzLl9jb25maWcgPSBfY29uZmlnO1xuICAgICAgdGhpcy5zZWxlY3QoZmllbGRzKTtcbiAgICAgIGlmIChpbmNsdWRlcykge1xuICAgICAgICB0aGlzLmluY2x1ZGVDaGlsZHJlbihpbmNsdWRlcyk7XG4gICAgICB9XG4gICAgICBpZiAoc29ydCkge1xuICAgICAgICB0aGlzLnNvcnQoc29ydCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX29wdGlvbnMgPSB7XG4gICAgICBoZWFkZXJzOiB7fSxcbiAgICAgIG1heEZldGNoOiAxMDAwMCxcbiAgICAgIGF1dG9GZXRjaDogZmFsc2UsXG4gICAgICBzY2FuQWxsOiBmYWxzZSxcbiAgICAgIHJlc3BvbnNlVGFyZ2V0OiAnUXVlcnlSZXN1bHQnLFxuICAgICAgLi4uKG9wdGlvbnMgfHwge30pLFxuICAgIH0gYXMgUXVlcnlPcHRpb25zO1xuICAgIC8vIHByb21pc2UgaW5zdGFuY2VcbiAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5vbigncmVzcG9uc2UnLCByZXNvbHZlKTtcbiAgICAgIHRoaXMub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU2VyaWFsaXphYmxlKCk7XG4gICAgdGhpcy5vbigncmVjb3JkJywgKHJlY29yZCkgPT4gdGhpcy5fc3RyZWFtLnB1c2gocmVjb3JkKSk7XG4gICAgdGhpcy5vbignZW5kJywgKCkgPT4gdGhpcy5fc3RyZWFtLnB1c2gobnVsbCkpO1xuICAgIHRoaXMub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5fc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1lbXB0eVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbGVjdCBmaWVsZHMgdG8gaW5jbHVkZSBpbiB0aGUgcmV0dXJuaW5nIHJlc3VsdFxuICAgKi9cbiAgc2VsZWN0PFxuICAgIFIgZXh0ZW5kcyBSZWNvcmQgPSBSZWNvcmQsXG4gICAgRlAgZXh0ZW5kcyBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4gPSBGaWVsZFBhdGhTcGVjaWZpZXI8UywgTj4sXG4gICAgRlBDIGV4dGVuZHMgRmllbGRQcm9qZWN0aW9uQ29uZmlnID0gRmllbGRQYXRoU2NvcGVkUHJvamVjdGlvbjxTLCBOLCBGUD4sXG4gICAgUjIgZXh0ZW5kcyBTT2JqZWN0UmVjb3JkPFMsIE4sIEZQQywgUj4gPSBTT2JqZWN0UmVjb3JkPFMsIE4sIEZQQywgUj5cbiAgPihmaWVsZHM6IFF1ZXJ5RmllbGQ8UywgTiwgRlA+ID0gJyonKTogUXVlcnk8UywgTiwgUjIsIFFSVD4ge1xuICAgIGlmICh0aGlzLl9zb3FsKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBzZXQgc2VsZWN0IGZpZWxkcyBmb3IgdGhlIHF1ZXJ5IHdoaWNoIGhhcyBhbHJlYWR5IGJ1aWx0IFNPUUwuJyxcbiAgICAgICk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRvRmllbGRBcnJheShmaWVsZHM6IFF1ZXJ5RmllbGQ8UywgTiwgRlA+KTogc3RyaW5nW10ge1xuICAgICAgcmV0dXJuIHR5cGVvZiBmaWVsZHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gZmllbGRzLnNwbGl0KC9cXHMqLFxccyovKVxuICAgICAgICA6IEFycmF5LmlzQXJyYXkoZmllbGRzKVxuICAgICAgICA/IChmaWVsZHMgYXMgQXJyYXk8c3RyaW5nIHwgRlA+KVxuICAgICAgICAgICAgLm1hcCh0b0ZpZWxkQXJyYXkpXG4gICAgICAgICAgICAucmVkdWNlKChmcywgZikgPT4gWy4uLmZzLCAuLi5mXSwgW10gYXMgc3RyaW5nW10pXG4gICAgICAgIDogT2JqZWN0LmVudHJpZXMoZmllbGRzIGFzIHsgW25hbWU6IHN0cmluZ106IFF1ZXJ5RmllbGQ8UywgTiwgRlA+IH0pXG4gICAgICAgICAgICAubWFwKChbZiwgdl0pID0+IHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHYgPyBbZl0gOiBbXTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9GaWVsZEFycmF5KHYpLm1hcCgocCkgPT4gYCR7Zn0uJHtwfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnJlZHVjZSgoZnMsIGYpID0+IFsuLi5mcywgLi4uZl0sIFtdIGFzIHN0cmluZ1tdKTtcbiAgICB9XG4gICAgaWYgKGZpZWxkcykge1xuICAgICAgdGhpcy5fY29uZmlnLmZpZWxkcyA9IHRvRmllbGRBcnJheShmaWVsZHMpO1xuICAgIH1cbiAgICAvLyBmb3JjZSBjb252ZXJ0IHF1ZXJ5IHJlY29yZCB0eXBlIHdpdGhvdXQgY2hhbmdpbmcgaW5zdGFuY2U7XG4gICAgcmV0dXJuICh0aGlzIGFzIGFueSkgYXMgUXVlcnk8UywgTiwgUjIsIFFSVD47XG4gIH1cblxuICAvKipcbiAgICogU2V0IHF1ZXJ5IGNvbmRpdGlvbnMgdG8gZmlsdGVyIHRoZSByZXN1bHQgcmVjb3Jkc1xuICAgKi9cbiAgd2hlcmUoY29uZGl0aW9uczogUXVlcnlDb25kaXRpb248UywgTj4gfCBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICdDYW5ub3Qgc2V0IHdoZXJlIGNvbmRpdGlvbnMgZm9yIHRoZSBxdWVyeSB3aGljaCBoYXMgYWxyZWFkeSBidWlsdCBTT1FMLicsXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLl9jb25maWcuY29uZGl0aW9ucyA9IGNvbmRpdGlvbnM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogTGltaXQgdGhlIHJldHVybmluZyByZXN1bHRcbiAgICovXG4gIGxpbWl0KGxpbWl0OiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICdDYW5ub3Qgc2V0IGxpbWl0IGZvciB0aGUgcXVlcnkgd2hpY2ggaGFzIGFscmVhZHkgYnVpbHQgU09RTC4nLFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5fY29uZmlnLmxpbWl0ID0gbGltaXQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2tpcCByZWNvcmRzXG4gICAqL1xuICBza2lwKG9mZnNldDogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuX3NvcWwpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAnQ2Fubm90IHNldCBza2lwL29mZnNldCBmb3IgdGhlIHF1ZXJ5IHdoaWNoIGhhcyBhbHJlYWR5IGJ1aWx0IFNPUUwuJyxcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuX2NvbmZpZy5vZmZzZXQgPSBvZmZzZXQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBRdWVyeSNza2lwKClcbiAgICovXG4gIG9mZnNldCA9IHRoaXMuc2tpcDtcblxuICAvKipcbiAgICogU2V0IHF1ZXJ5IHNvcnQgd2l0aCBkaXJlY3Rpb25cbiAgICovXG4gIHNvcnQoc29ydDogUXVlcnlTb3J0PFMsIE4+KTogdGhpcztcbiAgc29ydChzb3J0OiBzdHJpbmcpOiB0aGlzO1xuICBzb3J0KHNvcnQ6IFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+LCBkaXI6IFNvcnREaXIpOiB0aGlzO1xuICBzb3J0KHNvcnQ6IHN0cmluZywgZGlyOiBTb3J0RGlyKTogdGhpcztcbiAgc29ydChcbiAgICBzb3J0OiBRdWVyeVNvcnQ8UywgTj4gfCBTT2JqZWN0RmllbGROYW1lczxTLCBOPiB8IHN0cmluZyxcbiAgICBkaXI/OiBTb3J0RGlyLFxuICApIHtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICdDYW5ub3Qgc2V0IHNvcnQgZm9yIHRoZSBxdWVyeSB3aGljaCBoYXMgYWxyZWFkeSBidWlsdCBTT1FMLicsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHNvcnQgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBkaXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl9jb25maWcuc29ydCA9IFtbc29ydCwgZGlyXV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NvbmZpZy5zb3J0ID0gc29ydCBhcyBzdHJpbmcgfCB7IFtmaWVsZDogc3RyaW5nXTogU29ydERpciB9O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIFF1ZXJ5I3NvcnQoKVxuICAgKi9cbiAgb3JkZXJieTogdHlwZW9mIFF1ZXJ5LnByb3RvdHlwZS5zb3J0ID0gdGhpcy5zb3J0O1xuXG4gIC8qKlxuICAgKiBJbmNsdWRlIGNoaWxkIHJlbGF0aW9uc2hpcCBxdWVyeSBhbmQgbW92ZSBkb3duIHRvIHRoZSBjaGlsZCBxdWVyeSBjb250ZXh0XG4gICAqL1xuICBpbmNsdWRlPFxuICAgIENSTiBleHRlbmRzIENoaWxkUmVsYXRpb25zaGlwTmFtZXM8UywgTj4sXG4gICAgQ04gZXh0ZW5kcyBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lPFMsIE4sIENSTj4sXG4gICAgQ0ZQIGV4dGVuZHMgRmllbGRQYXRoU3BlY2lmaWVyPFMsIENOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBDTj4sXG4gICAgQ0ZQQyBleHRlbmRzIEZpZWxkUHJvamVjdGlvbkNvbmZpZyA9IEZpZWxkUGF0aFNjb3BlZFByb2plY3Rpb248UywgQ04sIENGUD4sXG4gICAgQ1IgZXh0ZW5kcyBSZWNvcmQgPSBTT2JqZWN0UmVjb3JkPFMsIENOLCBDRlBDPlxuICA+KFxuICAgIGNoaWxkUmVsTmFtZTogQ1JOLFxuICAgIGNvbmRpdGlvbnM/OiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBDTj4+LFxuICAgIGZpZWxkcz86IE9wdGlvbmFsPFF1ZXJ5RmllbGQ8UywgQ04sIENGUD4+LFxuICAgIG9wdGlvbnM/OiB7IGxpbWl0PzogbnVtYmVyOyBvZmZzZXQ/OiBudW1iZXI7IHNvcnQ/OiBRdWVyeVNvcnQ8UywgQ04+IH0sXG4gICk6IFN1YlF1ZXJ5PFMsIE4sIFIsIFFSVCwgQ1JOLCBDTiwgQ1I+O1xuICBpbmNsdWRlPFxuICAgIENSTiBleHRlbmRzIENoaWxkUmVsYXRpb25zaGlwTmFtZXM8UywgTj4sXG4gICAgQ04gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgQ1IgZXh0ZW5kcyBSZWNvcmQgPSBTT2JqZWN0UmVjb3JkPFMsIENOPlxuICA+KFxuICAgIGNoaWxkUmVsTmFtZTogc3RyaW5nLFxuICAgIGNvbmRpdGlvbnM/OiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBDTj4+LFxuICAgIGZpZWxkcz86IE9wdGlvbmFsPFF1ZXJ5RmllbGQ8UywgQ04+PixcbiAgICBvcHRpb25zPzogeyBsaW1pdD86IG51bWJlcjsgb2Zmc2V0PzogbnVtYmVyOyBzb3J0PzogUXVlcnlTb3J0PFMsIENOPiB9LFxuICApOiBTdWJRdWVyeTxTLCBOLCBSLCBRUlQsIENSTiwgQ04sIENSPjtcblxuICBpbmNsdWRlPFxuICAgIENSTiBleHRlbmRzIENoaWxkUmVsYXRpb25zaGlwTmFtZXM8UywgTj4sXG4gICAgQ04gZXh0ZW5kcyBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lPFMsIE4sIENSTj4sXG4gICAgQ0ZQIGV4dGVuZHMgRmllbGRQYXRoU3BlY2lmaWVyPFMsIENOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBDTj4sXG4gICAgQ0ZQQyBleHRlbmRzIEZpZWxkUHJvamVjdGlvbkNvbmZpZyA9IEZpZWxkUGF0aFNjb3BlZFByb2plY3Rpb248UywgQ04sIENGUD4sXG4gICAgQ1IgZXh0ZW5kcyBSZWNvcmQgPSBTT2JqZWN0UmVjb3JkPFMsIENOLCBDRlBDPlxuICA+KFxuICAgIGNoaWxkUmVsTmFtZTogQ1JOIHwgc3RyaW5nLFxuICAgIGNvbmRpdGlvbnM/OiBPcHRpb25hbDxRdWVyeUNvbmRpdGlvbjxTLCBDTj4+LFxuICAgIGZpZWxkcz86IE9wdGlvbmFsPFF1ZXJ5RmllbGQ8UywgQ04sIENGUD4+LFxuICAgIG9wdGlvbnM6IHsgbGltaXQ/OiBudW1iZXI7IG9mZnNldD86IG51bWJlcjsgc29ydD86IFF1ZXJ5U29ydDxTLCBDTj4gfSA9IHt9LFxuICApOiBTdWJRdWVyeTxTLCBOLCBSLCBRUlQsIENSTiwgQ04sIENSPiB7XG4gICAgaWYgKHRoaXMuX3NvcWwpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAnQ2Fubm90IGluY2x1ZGUgY2hpbGQgcmVsYXRpb25zaGlwIGludG8gdGhlIHF1ZXJ5IHdoaWNoIGhhcyBhbHJlYWR5IGJ1aWx0IFNPUUwuJyxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IGNoaWxkQ29uZmlnOiBRdWVyeUNvbmZpZzxTLCBDTiwgQ0ZQPiA9IHtcbiAgICAgIGZpZWxkczogZmllbGRzID09PSBudWxsID8gdW5kZWZpbmVkIDogZmllbGRzLFxuICAgICAgdGFibGU6IGNoaWxkUmVsTmFtZSxcbiAgICAgIGNvbmRpdGlvbnM6IGNvbmRpdGlvbnMgPT09IG51bGwgPyB1bmRlZmluZWQgOiBjb25kaXRpb25zLFxuICAgICAgbGltaXQ6IG9wdGlvbnMubGltaXQsXG4gICAgICBvZmZzZXQ6IG9wdGlvbnMub2Zmc2V0LFxuICAgICAgc29ydDogb3B0aW9ucy5zb3J0LFxuICAgIH07XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lXG4gICAgY29uc3QgY2hpbGRRdWVyeSA9IG5ldyBTdWJRdWVyeTxTLCBOLCBSLCBRUlQsIENSTiwgQ04sIENSPihcbiAgICAgIHRoaXMuX2Nvbm4sXG4gICAgICBjaGlsZFJlbE5hbWUgYXMgQ1JOLFxuICAgICAgY2hpbGRDb25maWcsXG4gICAgICB0aGlzLFxuICAgICk7XG4gICAgdGhpcy5fY2hpbGRyZW4ucHVzaChjaGlsZFF1ZXJ5KTtcbiAgICByZXR1cm4gY2hpbGRRdWVyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmNsdWRlIGNoaWxkIHJlbGF0aW9uc2hpcCBxdWVyaWVzLCBidXQgbm90IG1vdmluZyBkb3duIHRvIHRoZSBjaGlsZHJlbiBjb250ZXh0XG4gICAqL1xuICBpbmNsdWRlQ2hpbGRyZW4oXG4gICAgaW5jbHVkZXM6IHtcbiAgICAgIFtDUk4gaW4gQ2hpbGRSZWxhdGlvbnNoaXBOYW1lczxTLCBOPl0/OiBRdWVyeUNvbmZpZzxcbiAgICAgICAgUyxcbiAgICAgICAgQ2hpbGRSZWxhdGlvbnNoaXBTT2JqZWN0TmFtZTxTLCBOLCBDUk4+XG4gICAgICA+O1xuICAgIH0sXG4gICkge1xuICAgIHR5cGUgQ1JOID0gQ2hpbGRSZWxhdGlvbnNoaXBOYW1lczxTLCBOPjtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICdDYW5ub3QgaW5jbHVkZSBjaGlsZCByZWxhdGlvbnNoaXAgaW50byB0aGUgcXVlcnkgd2hpY2ggaGFzIGFscmVhZHkgYnVpbHQgU09RTC4nLFxuICAgICAgKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBjcm5hbWUgb2YgT2JqZWN0LmtleXMoaW5jbHVkZXMpIGFzIENSTltdKSB7XG4gICAgICBjb25zdCB7IGNvbmRpdGlvbnMsIGZpZWxkcywgLi4ub3B0aW9ucyB9ID0gaW5jbHVkZXNbXG4gICAgICAgIGNybmFtZVxuICAgICAgXSBhcyBRdWVyeUNvbmZpZzxTLCBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lPFMsIE4sIENSTj4+O1xuICAgICAgdGhpcy5pbmNsdWRlKGNybmFtZSwgY29uZGl0aW9ucywgZmllbGRzLCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0dGluZyBtYXhGZXRjaCBxdWVyeSBvcHRpb25cbiAgICovXG4gIG1heEZldGNoKG1heEZldGNoOiBudW1iZXIpIHtcbiAgICB0aGlzLl9vcHRpb25zLm1heEZldGNoID0gbWF4RmV0Y2g7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU3dpdGNoaW5nIGF1dG8gZmV0Y2ggbW9kZVxuICAgKi9cbiAgYXV0b0ZldGNoKGF1dG9GZXRjaDogYm9vbGVhbikge1xuICAgIHRoaXMuX29wdGlvbnMuYXV0b0ZldGNoID0gYXV0b0ZldGNoO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBmbGFnIHRvIHNjYW4gYWxsIHJlY29yZHMgaW5jbHVkaW5nIGRlbGV0ZWQgYW5kIGFyY2hpdmVkLlxuICAgKi9cbiAgc2NhbkFsbChzY2FuQWxsOiBib29sZWFuKSB7XG4gICAgdGhpcy5fb3B0aW9ucy5zY2FuQWxsID0gc2NhbkFsbDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgc2V0UmVzcG9uc2VUYXJnZXQ8UVJUMSBleHRlbmRzIFF1ZXJ5UmVzcG9uc2VUYXJnZXQ+KFxuICAgIHJlc3BvbnNlVGFyZ2V0OiBRUlQxLFxuICApOiBRdWVyeTxTLCBOLCBSLCBRUlQxPiB7XG4gICAgaWYgKHJlc3BvbnNlVGFyZ2V0IGluIFJlc3BvbnNlVGFyZ2V0cykge1xuICAgICAgdGhpcy5fb3B0aW9ucy5yZXNwb25zZVRhcmdldCA9IHJlc3BvbnNlVGFyZ2V0O1xuICAgIH1cbiAgICAvLyBmb3JjZSBjaGFuZ2UgcXVlcnkgcmVzcG9uc2UgdGFyZ2V0IHdpdGhvdXQgY2hhbmdpbmcgaW5zdGFuY2VcbiAgICByZXR1cm4gKHRoaXMgYXMgUXVlcnk8UywgTiwgUj4pIGFzIFF1ZXJ5PFMsIE4sIFIsIFFSVDE+O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgcXVlcnkgYW5kIGZldGNoIHJlY29yZHMgZnJvbSBzZXJ2ZXIuXG4gICAqL1xuICBleGVjdXRlPFFSVDEgZXh0ZW5kcyBRdWVyeVJlc3BvbnNlVGFyZ2V0ID0gUVJUPihcbiAgICBvcHRpb25zXzogUGFydGlhbDxRdWVyeU9wdGlvbnM+ICYgeyByZXNwb25zZVRhcmdldD86IFFSVDEgfSA9IHt9LFxuICApOiBRdWVyeTxTLCBOLCBSLCBRUlQxPiB7XG4gICAgaWYgKHRoaXMuX2V4ZWN1dGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlLWV4ZWN1dGluZyBhbHJlYWR5IGV4ZWN1dGVkIHF1ZXJ5Jyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2ZpbmlzaGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4ZWN1dGluZyBhbHJlYWR5IGNsb3NlZCBxdWVyeScpO1xuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICBoZWFkZXJzOiBvcHRpb25zXy5oZWFkZXJzIHx8IHRoaXMuX29wdGlvbnMuaGVhZGVycyxcbiAgICAgIHJlc3BvbnNlVGFyZ2V0OiBvcHRpb25zXy5yZXNwb25zZVRhcmdldCB8fCB0aGlzLl9vcHRpb25zLnJlc3BvbnNlVGFyZ2V0LFxuICAgICAgYXV0b0ZldGNoOiBvcHRpb25zXy5hdXRvRmV0Y2ggfHwgdGhpcy5fb3B0aW9ucy5hdXRvRmV0Y2gsXG4gICAgICBtYXhGZXRjaDogb3B0aW9uc18ubWF4RmV0Y2ggfHwgdGhpcy5fb3B0aW9ucy5tYXhGZXRjaCxcbiAgICAgIHNjYW5BbGw6IG9wdGlvbnNfLnNjYW5BbGwgfHwgdGhpcy5fb3B0aW9ucy5zY2FuQWxsLFxuICAgIH07XG5cbiAgICAvLyBjb2xsZWN0IGZldGNoZWQgcmVjb3JkcyBpbiBhcnJheVxuICAgIC8vIG9ubHkgd2hlbiByZXNwb25zZSB0YXJnZXQgaXMgUmVjb3JkcyBhbmRcbiAgICAvLyBlaXRoZXIgY2FsbGJhY2sgb3IgY2hhaW5pbmcgcHJvbWlzZXMgYXJlIGF2YWlsYWJsZSB0byB0aGlzIHF1ZXJ5LlxuICAgIHRoaXMub25jZSgnZmV0Y2gnLCAoKSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIG9wdGlvbnMucmVzcG9uc2VUYXJnZXQgPT09IFJlc3BvbnNlVGFyZ2V0cy5SZWNvcmRzICYmXG4gICAgICAgIHRoaXMuX2NoYWluaW5nXG4gICAgICApIHtcbiAgICAgICAgdGhpcy5fbG9nZ2VyLmRlYnVnKCctLS0gY29sbGVjdGluZyBhbGwgZmV0Y2hlZCByZWNvcmRzIC0tLScpO1xuICAgICAgICBjb25zdCByZWNvcmRzOiBSZWNvcmRbXSA9IFtdO1xuICAgICAgICBjb25zdCBvblJlY29yZCA9IChyZWNvcmQ6IFJlY29yZCkgPT4gcmVjb3Jkcy5wdXNoKHJlY29yZCk7XG4gICAgICAgIHRoaXMub24oJ3JlY29yZCcsIG9uUmVjb3JkKTtcbiAgICAgICAgdGhpcy5vbmNlKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcigncmVjb3JkJywgb25SZWNvcmQpO1xuICAgICAgICAgIHRoaXMuZW1pdCgncmVzcG9uc2UnLCByZWNvcmRzLCB0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBmbGFnIHRvIHByZXZlbnQgcmUtZXhlY3V0aW9uXG4gICAgdGhpcy5fZXhlY3V0ZWQgPSB0cnVlO1xuXG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIHN0YXJ0IGFjdHVhbCBxdWVyeVxuICAgICAgdGhpcy5fbG9nZ2VyLmRlYnVnKCc+Pj4gUXVlcnkgc3RhcnQgPj4+Jyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLl9leGVjdXRlKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9sb2dnZXIuZGVidWcoJyoqKiBRdWVyeSBmaW5pc2hlZCAqKionKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZygnLS0tIFF1ZXJ5IGVycm9yIC0tLScsIGVycm9yKTtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLy8gcmV0dXJuIFF1ZXJ5IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgIHJldHVybiAodGhpcyBhcyBRdWVyeTxTLCBOLCBSPikgYXMgUXVlcnk8UywgTiwgUiwgUVJUMT47XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBRdWVyeSNleGVjdXRlKClcbiAgICovXG4gIGV4ZWMgPSB0aGlzLmV4ZWN1dGU7XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgUXVlcnkjZXhlY3V0ZSgpXG4gICAqL1xuICBydW4gPSB0aGlzLmV4ZWN1dGU7XG5cbiAgcHJpdmF0ZSBsb2NhdG9yVG9VcmwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xvY2F0b3JcbiAgICAgID8gW3RoaXMuX2Nvbm4uX2Jhc2VVcmwoKSwgJy9xdWVyeS8nLCB0aGlzLl9sb2NhdG9yXS5qb2luKCcnKVxuICAgICAgOiAnJztcbiAgfVxuXG4gIHByaXZhdGUgdXJsVG9Mb2NhdG9yKHVybDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHVybC5zcGxpdCgnLycpLnBvcCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RSZXNwb25zZShcbiAgICByYXdEb25lOiBib29sZWFuLFxuICAgIHJlc3BvbnNlVGFyZ2V0OiBRdWVyeVJlc3BvbnNlVGFyZ2V0WzNdLFxuICApOiBudW1iZXI7XG4gIHByaXZhdGUgY29uc3RydWN0UmVzcG9uc2UoXG4gICAgcmF3RG9uZTogYm9vbGVhbixcbiAgICByZXNwb25zZVRhcmdldDogUXVlcnlSZXNwb25zZVRhcmdldFsyXSxcbiAgKTogUjtcbiAgcHJpdmF0ZSBjb25zdHJ1Y3RSZXNwb25zZShcbiAgICByYXdEb25lOiBib29sZWFuLFxuICAgIHJlc3BvbnNlVGFyZ2V0OiBRdWVyeVJlc3BvbnNlVGFyZ2V0WzFdLFxuICApOiBSW107XG4gIHByaXZhdGUgY29uc3RydWN0UmVzcG9uc2UoXG4gICAgcmF3RG9uZTogYm9vbGVhbixcbiAgICByZXNwb25zZVRhcmdldDogUXVlcnlSZXNwb25zZVRhcmdldFswXSxcbiAgKTogUXVlcnlSZXN1bHQ8Uj47XG4gIHByaXZhdGUgY29uc3RydWN0UmVzcG9uc2UoXG4gICAgcmF3RG9uZTogYm9vbGVhbixcbiAgICByZXNwb25zZVRhcmdldDogUXVlcnlSZXNwb25zZVRhcmdldCxcbiAgKTogUXVlcnlSZXN1bHQ8Uj4gfCBSW10gfCBudW1iZXIgfCBSIHtcbiAgICBzd2l0Y2ggKHJlc3BvbnNlVGFyZ2V0KSB7XG4gICAgICBjYXNlICdDb3VudCc6XG4gICAgICAgIHJldHVybiB0aGlzLnRvdGFsU2l6ZTtcbiAgICAgIGNhc2UgJ1NpbmdsZVJlY29yZCc6XG4gICAgICAgIHJldHVybiB0aGlzLnJlY29yZHM/LlswXSA/PyBudWxsO1xuICAgICAgY2FzZSAnUmVjb3Jkcyc6XG4gICAgICAgIHJldHVybiB0aGlzLnJlY29yZHM7XG4gICAgICAvLyBRdWVyeVJlc3VsdCBpcyBkZWZhdWx0IHJlc3BvbnNlIHRhcmdldFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi57XG4gICAgICAgICAgICByZWNvcmRzOiB0aGlzLnJlY29yZHMsXG4gICAgICAgICAgICB0b3RhbFNpemU6IHRoaXMudG90YWxTaXplLFxuICAgICAgICAgICAgZG9uZTogcmF3RG9uZSA/PyB0cnVlLCAvLyB3aGVuIG5vIHJlY29yZHMsIGRvbmUgaXMgb21pdHRlZFxuICAgICAgICAgIH0sXG4gICAgICAgICAgLi4uKHRoaXMuX2xvY2F0b3IgPyB7IG5leHRSZWNvcmRzVXJsOiB0aGlzLmxvY2F0b3JUb1VybCgpIH0gOiB7fSksXG4gICAgICAgIH07XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX2V4ZWN1dGUob3B0aW9uczogUXVlcnlPcHRpb25zKTogUHJvbWlzZTxRdWVyeVJlc3BvbnNlPFI+PiB7XG4gICAgY29uc3QgeyBoZWFkZXJzLCByZXNwb25zZVRhcmdldCwgYXV0b0ZldGNoLCBtYXhGZXRjaCwgc2NhbkFsbCB9ID0gb3B0aW9ucztcbiAgICB0aGlzLl9sb2dnZXIuZGVidWcoJ2V4ZWN1dGUgd2l0aCBvcHRpb25zJywgb3B0aW9ucyk7XG4gICAgbGV0IHVybDtcbiAgICBpZiAodGhpcy5fbG9jYXRvcikge1xuICAgICAgdXJsID0gdGhpcy5sb2NhdG9yVG9VcmwoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc29xbCA9IGF3YWl0IHRoaXMudG9TT1FMKCk7XG4gICAgICB0aGlzLl9sb2dnZXIuZGVidWcoYFNPUUwgPSAke3NvcWx9YCk7XG4gICAgICB1cmwgPSBbXG4gICAgICAgIHRoaXMuX2Nvbm4uX2Jhc2VVcmwoKSxcbiAgICAgICAgJy8nLFxuICAgICAgICBzY2FuQWxsID8gJ3F1ZXJ5QWxsJyA6ICdxdWVyeScsXG4gICAgICAgICc/cT0nLFxuICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc29xbCksXG4gICAgICBdLmpvaW4oJycpO1xuICAgIH1cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5fY29ubi5yZXF1ZXN0PFI+KHsgbWV0aG9kOiAnR0VUJywgdXJsLCBoZWFkZXJzIH0pO1xuICAgIHRoaXMuZW1pdCgnZmV0Y2gnKTtcbiAgICB0aGlzLnRvdGFsU2l6ZSA9IGRhdGEudG90YWxTaXplO1xuICAgIHRoaXMucmVjb3JkcyA9IHRoaXMucmVjb3Jkcz8uY29uY2F0KFxuICAgICAgbWF4RmV0Y2ggLSB0aGlzLnJlY29yZHMubGVuZ3RoID4gZGF0YS5yZWNvcmRzLmxlbmd0aFxuICAgICAgICA/IGRhdGEucmVjb3Jkc1xuICAgICAgICA6IGRhdGEucmVjb3Jkcy5zbGljZSgwLCBtYXhGZXRjaCAtIHRoaXMucmVjb3Jkcy5sZW5ndGgpLFxuICAgICk7XG4gICAgdGhpcy5fbG9jYXRvciA9IGRhdGEubmV4dFJlY29yZHNVcmxcbiAgICAgID8gdGhpcy51cmxUb0xvY2F0b3IoZGF0YS5uZXh0UmVjb3Jkc1VybClcbiAgICAgIDogdW5kZWZpbmVkO1xuICAgIHRoaXMuX2ZpbmlzaGVkID1cbiAgICAgIHRoaXMuX2ZpbmlzaGVkIHx8XG4gICAgICBkYXRhLmRvbmUgfHxcbiAgICAgICFhdXRvRmV0Y2ggfHxcbiAgICAgIC8vIHRoaXMgaXMgd2hhdCB0aGUgcmVzcG9uc2UgbG9va3MgbGlrZSB3aGVuIHRoZXJlIGFyZSBubyByZXN1bHRzXG4gICAgICAoZGF0YS5yZWNvcmRzLmxlbmd0aCA9PT0gMCAmJiBkYXRhLmRvbmUgPT09IHVuZGVmaW5lZCk7XG5cbiAgICAvLyBzdHJlYW1pbmcgcmVjb3JkIGluc3RhbmNlc1xuICAgIGNvbnN0IG51bVJlY29yZHMgPSBkYXRhLnJlY29yZHM/Lmxlbmd0aCA/PyAwO1xuICAgIGxldCB0b3RhbEZldGNoZWQgPSB0aGlzLnRvdGFsRmV0Y2hlZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVJlY29yZHM7IGkrKykge1xuICAgICAgaWYgKHRvdGFsRmV0Y2hlZCA+PSBtYXhGZXRjaCkge1xuICAgICAgICB0aGlzLl9maW5pc2hlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVjb3JkID0gZGF0YS5yZWNvcmRzW2ldO1xuICAgICAgdGhpcy5lbWl0KCdyZWNvcmQnLCByZWNvcmQsIHRvdGFsRmV0Y2hlZCwgdGhpcyk7XG4gICAgICB0b3RhbEZldGNoZWQgKz0gMTtcbiAgICB9XG4gICAgdGhpcy50b3RhbEZldGNoZWQgPSB0b3RhbEZldGNoZWQ7XG5cbiAgICBpZiAodGhpcy5fZmluaXNoZWQpIHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5jb25zdHJ1Y3RSZXNwb25zZShkYXRhLmRvbmUsIHJlc3BvbnNlVGFyZ2V0KTtcbiAgICAgIC8vIG9ubHkgZmlyZSByZXNwb25zZSBldmVudCB3aGVuIGl0IHNob3VsZCBiZSBub3RpZmllZCBwZXIgZmV0Y2hcbiAgICAgIGlmIChyZXNwb25zZVRhcmdldCAhPT0gUmVzcG9uc2VUYXJnZXRzLlJlY29yZHMpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdyZXNwb25zZScsIHJlc3BvbnNlLCB0aGlzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZW1pdCgnZW5kJyk7XG4gICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9leGVjdXRlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPYnRhaW4gcmVhZGFibGUgc3RyZWFtIGluc3RhbmNlXG4gICAqL1xuICBzdHJlYW0odHlwZTogJ3JlY29yZCcpOiBTZXJpYWxpemFibGU8Uj47XG4gIHN0cmVhbSh0eXBlOiAnY3N2Jyk6IFJlYWRhYmxlO1xuICBzdHJlYW0odHlwZTogJ3JlY29yZCcgfCAnY3N2JyA9ICdjc3YnKSB7XG4gICAgaWYgKCF0aGlzLl9maW5pc2hlZCAmJiAhdGhpcy5fZXhlY3V0ZWQpIHtcbiAgICAgIHRoaXMuZXhlY3V0ZSh7IGF1dG9GZXRjaDogdHJ1ZSB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHR5cGUgPT09ICdyZWNvcmQnID8gdGhpcy5fc3RyZWFtIDogdGhpcy5fc3RyZWFtLnN0cmVhbSh0eXBlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQaXBlIHRoZSBxdWVyaWVkIHJlY29yZHMgdG8gYW5vdGhlciBzdHJlYW1cbiAgICogVGhpcyBpcyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eTsgUXVlcnkgaXMgbm90IGEgcmVjb3JkIHN0cmVhbSBpbnN0YW5jZSBhbnltb3JlIGluIDIuMC5cbiAgICogSWYgeW91IHdhbnQgYSByZWNvcmQgc3RyZWFtIGluc3RhbmNlLCB1c2UgYFF1ZXJ5I3N0cmVhbSgncmVjb3JkJylgLlxuICAgKi9cbiAgcGlwZShzdHJlYW06IE5vZGVKUy5Xcml0YWJsZVN0cmVhbSkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbSgncmVjb3JkJykucGlwZShzdHJlYW0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIGFzeW5jIF9leHBhbmRGaWVsZHMoc29iamVjdF8/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQ2Fubm90IGV4cGFuZCBmaWVsZHMgZm9yIHRoZSBxdWVyeSB3aGljaCBoYXMgYWxyZWFkeSBidWlsdCBTT1FMLicsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB7IGZpZWxkcyA9IFtdLCB0YWJsZSA9ICcnIH0gPSB0aGlzLl9jb25maWc7XG4gICAgY29uc3Qgc29iamVjdCA9IHNvYmplY3RfIHx8IHRhYmxlO1xuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGBfZXhwYW5kRmllbGRzOiBzb2JqZWN0ID0gJHtzb2JqZWN0fSwgZmllbGRzID0gJHtmaWVsZHMuam9pbignLCAnKX1gLFxuICAgICk7XG4gICAgY29uc3QgW2VmaWVsZHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5fZXhwYW5kQXN0ZXJpc2tGaWVsZHMoc29iamVjdCwgZmllbGRzKSxcbiAgICAgIC4uLnRoaXMuX2NoaWxkcmVuLm1hcChhc3luYyAoY2hpbGRRdWVyeSkgPT4ge1xuICAgICAgICBhd2FpdCBjaGlsZFF1ZXJ5Ll9leHBhbmRGaWVsZHMoKTtcbiAgICAgICAgcmV0dXJuIFtdIGFzIHN0cmluZ1tdO1xuICAgICAgfSksXG4gICAgXSk7XG4gICAgdGhpcy5fY29uZmlnLmZpZWxkcyA9IGVmaWVsZHM7XG4gICAgdGhpcy5fY29uZmlnLmluY2x1ZGVzID0gdGhpcy5fY2hpbGRyZW5cbiAgICAgIC5tYXAoKGNxdWVyeSkgPT4ge1xuICAgICAgICBjb25zdCBjY29uZmlnID0gY3F1ZXJ5Ll9xdWVyeS5fY29uZmlnO1xuICAgICAgICByZXR1cm4gW2Njb25maWcudGFibGUsIGNjb25maWddIGFzIFtzdHJpbmcsIFNPUUxRdWVyeUNvbmZpZ107XG4gICAgICB9KVxuICAgICAgLnJlZHVjZShcbiAgICAgICAgKGluY2x1ZGVzLCBbY3RhYmxlLCBjY29uZmlnXSkgPT4gKHtcbiAgICAgICAgICAuLi5pbmNsdWRlcyxcbiAgICAgICAgICBbY3RhYmxlXTogY2NvbmZpZyxcbiAgICAgICAgfSksXG4gICAgICAgIHt9IGFzIHsgW25hbWU6IHN0cmluZ106IFNPUUxRdWVyeUNvbmZpZyB9LFxuICAgICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgX2ZpbmRSZWxhdGlvbk9iamVjdChyZWxOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHRhYmxlID0gdGhpcy5fY29uZmlnLnRhYmxlO1xuICAgIGlmICghdGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gdGFibGUgaW5mb3JtYXRpb24gcHJvdmlkZWQgaW4gdGhlIHF1ZXJ5Jyk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGBmaW5kaW5nIHRhYmxlIGZvciByZWxhdGlvbiBcIiR7cmVsTmFtZX1cIiBpbiBcIiR7dGFibGV9XCIuLi5gLFxuICAgICk7XG4gICAgY29uc3Qgc29iamVjdCA9IGF3YWl0IHRoaXMuX2Nvbm4uZGVzY3JpYmUkKHRhYmxlKTtcbiAgICBjb25zdCB1cHBlclJuYW1lID0gcmVsTmFtZS50b1VwcGVyQ2FzZSgpO1xuICAgIGZvciAoY29uc3QgY3Igb2Ygc29iamVjdC5jaGlsZFJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGNyLnJlbGF0aW9uc2hpcE5hbWUgfHwgJycpLnRvVXBwZXJDYXNlKCkgPT09IHVwcGVyUm5hbWUgJiZcbiAgICAgICAgY3IuY2hpbGRTT2JqZWN0XG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGNyLmNoaWxkU09iamVjdDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBObyBjaGlsZCByZWxhdGlvbnNoaXAgZm91bmQ6ICR7cmVsTmFtZX1gKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgX2V4cGFuZEFzdGVyaXNrRmllbGRzKFxuICAgIHNvYmplY3Q6IHN0cmluZyxcbiAgICBmaWVsZHM6IHN0cmluZ1tdLFxuICApOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgZXhwYW5kZWRGaWVsZHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGZpZWxkcy5tYXAoYXN5bmMgKGZpZWxkKSA9PiB0aGlzLl9leHBhbmRBc3Rlcmlza0ZpZWxkKHNvYmplY3QsIGZpZWxkKSksXG4gICAgKTtcbiAgICByZXR1cm4gZXhwYW5kZWRGaWVsZHMucmVkdWNlKFxuICAgICAgKGVmbGRzOiBzdHJpbmdbXSwgZmxkczogc3RyaW5nW10pOiBzdHJpbmdbXSA9PiBbLi4uZWZsZHMsIC4uLmZsZHNdLFxuICAgICAgW10sXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgX2V4cGFuZEFzdGVyaXNrRmllbGQoXG4gICAgc29iamVjdDogc3RyaW5nLFxuICAgIGZpZWxkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICB0aGlzLl9sb2dnZXIuZGVidWcoYGV4cGFuZGluZyBmaWVsZCBcIiR7ZmllbGR9XCIgaW4gXCIke3NvYmplY3R9XCIuLi5gKTtcbiAgICBjb25zdCBmcGF0aCA9IGZpZWxkLnNwbGl0KCcuJyk7XG4gICAgaWYgKGZwYXRoW2ZwYXRoLmxlbmd0aCAtIDFdID09PSAnKicpIHtcbiAgICAgIGNvbnN0IHNvID0gYXdhaXQgdGhpcy5fY29ubi5kZXNjcmliZSQoc29iamVjdCk7XG4gICAgICB0aGlzLl9sb2dnZXIuZGVidWcoYHRhYmxlICR7c29iamVjdH0gaGFzIGJlZW4gZGVzY3JpYmVkYCk7XG4gICAgICBpZiAoZnBhdGgubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCBybmFtZSA9IGZwYXRoLnNoaWZ0KCk7XG4gICAgICAgIGZvciAoY29uc3QgZiBvZiBzby5maWVsZHMpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBmLnJlbGF0aW9uc2hpcE5hbWUgJiZcbiAgICAgICAgICAgIHJuYW1lICYmXG4gICAgICAgICAgICBmLnJlbGF0aW9uc2hpcE5hbWUudG9VcHBlckNhc2UoKSA9PT0gcm5hbWUudG9VcHBlckNhc2UoKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY29uc3QgcmZpZWxkID0gZjtcbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZVRvID0gcmZpZWxkLnJlZmVyZW5jZVRvIHx8IFtdO1xuICAgICAgICAgICAgY29uc3QgcnRhYmxlID0gcmVmZXJlbmNlVG8ubGVuZ3RoID09PSAxID8gcmVmZXJlbmNlVG9bMF0gOiAnTmFtZSc7XG4gICAgICAgICAgICBjb25zdCBmcGF0aHMgPSBhd2FpdCB0aGlzLl9leHBhbmRBc3Rlcmlza0ZpZWxkKFxuICAgICAgICAgICAgICBydGFibGUsXG4gICAgICAgICAgICAgIGZwYXRoLmpvaW4oJy4nKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZnBhdGhzLm1hcCgoZnApID0+IGAke3JuYW1lfS4ke2ZwfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICByZXR1cm4gc28uZmllbGRzLm1hcCgoZikgPT4gZi5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIFtmaWVsZF07XG4gIH1cblxuICAvKipcbiAgICogRXhwbGFpbiBwbGFuIGZvciBleGVjdXRpbmcgcXVlcnlcbiAgICovXG4gIGFzeW5jIGV4cGxhaW4oKSB7XG4gICAgY29uc3Qgc29xbCA9IGF3YWl0IHRoaXMudG9TT1FMKCk7XG4gICAgdGhpcy5fbG9nZ2VyLmRlYnVnKGBTT1FMID0gJHtzb3FsfWApO1xuICAgIGNvbnN0IHVybCA9IGAvcXVlcnkvP2V4cGxhaW49JHtlbmNvZGVVUklDb21wb25lbnQoc29xbCl9YDtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFF1ZXJ5RXhwbGFpblJlc3VsdD4odXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gU09RTCBleHByZXNzaW9uIGZvciB0aGUgcXVlcnlcbiAgICovXG4gIGFzeW5jIHRvU09RTCgpIHtcbiAgICBpZiAodGhpcy5fc29xbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3NvcWw7XG4gICAgfVxuICAgIGF3YWl0IHRoaXMuX2V4cGFuZEZpZWxkcygpO1xuICAgIHJldHVybiBjcmVhdGVTT1FMKHRoaXMuX2NvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICogUHJvbWlzZS9BKyBpbnRlcmZhY2VcbiAgICogaHR0cDovL3Byb21pc2VzLWFwbHVzLmdpdGh1Yi5pby9wcm9taXNlcy1zcGVjL1xuICAgKlxuICAgKiBEZWxlZ2F0ZSB0byBkZWZlcnJlZCBwcm9taXNlLCByZXR1cm4gcHJvbWlzZSBpbnN0YW5jZSBmb3IgcXVlcnkgcmVzdWx0XG4gICAqL1xuICB0aGVuPFUsIFY+KFxuICAgIG9uUmVzb2x2ZT86XG4gICAgICB8ICgocXI6IFF1ZXJ5UmVzcG9uc2U8UiwgUVJUPikgPT4gVSB8IFByb21pc2U8VT4pXG4gICAgICB8IG51bGxcbiAgICAgIHwgdW5kZWZpbmVkLFxuICAgIG9uUmVqZWN0PzogKChlcnI6IEVycm9yKSA9PiBWIHwgUHJvbWlzZTxWPikgfCBudWxsIHwgdW5kZWZpbmVkLFxuICApOiBQcm9taXNlPFUgfCBWPiB7XG4gICAgdGhpcy5fY2hhaW5pbmcgPSB0cnVlO1xuICAgIGlmICghdGhpcy5fZmluaXNoZWQgJiYgIXRoaXMuX2V4ZWN1dGVkKSB7XG4gICAgICB0aGlzLmV4ZWN1dGUoKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLl9wcm9taXNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdpbnZhbGlkIHN0YXRlOiBwcm9taXNlIGlzIG5vdCBzZXQgYWZ0ZXIgcXVlcnkgZXhlY3V0aW9uJyxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wcm9taXNlLnRoZW4ob25SZXNvbHZlLCBvblJlamVjdCk7XG4gIH1cblxuICBjYXRjaChcbiAgICBvblJlamVjdDogKFxuICAgICAgZXJyOiBFcnJvcixcbiAgICApID0+IFF1ZXJ5UmVzcG9uc2U8UiwgUVJUPiB8IFByb21pc2U8UXVlcnlSZXNwb25zZTxSLCBRUlQ+PixcbiAgKTogUHJvbWlzZTxRdWVyeVJlc3BvbnNlPFIsIFFSVD4+IHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0KTtcbiAgfVxuXG4gIHByb21pc2UoKTogUHJvbWlzZTxRdWVyeVJlc3BvbnNlPFIsIFFSVD4+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1bGsgZGVsZXRlIHF1ZXJpZWQgcmVjb3Jkc1xuICAgKi9cbiAgZGVzdHJveShvcHRpb25zPzogUXVlcnlEZXN0cm95T3B0aW9ucyk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgZGVzdHJveSh0eXBlOiBOLCBvcHRpb25zPzogUXVlcnlEZXN0cm95T3B0aW9ucyk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgZGVzdHJveSh0eXBlPzogTiB8IFF1ZXJ5RGVzdHJveU9wdGlvbnMsIG9wdGlvbnM/OiBRdWVyeURlc3Ryb3lPcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnb2JqZWN0JyAmJiB0eXBlICE9PSBudWxsKSB7XG4gICAgICBvcHRpb25zID0gdHlwZTtcbiAgICAgIHR5cGUgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIGNvbnN0IHR5cGVfOiBPcHRpb25hbDxOPiA9IHR5cGUgfHwgKHRoaXMuX2NvbmZpZy50YWJsZSBhcyBPcHRpb25hbDxOPik7XG4gICAgaWYgKCF0eXBlXykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnU09RTCBiYXNlZCBxdWVyeSBuZWVkcyBTT2JqZWN0IHR5cGUgaW5mb3JtYXRpb24gdG8gYnVsayBkZWxldGUuJyxcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIFNldCB0aGUgdGhyZXNob2xkIG51bWJlciB0byBwYXNzIHRvIGJ1bGsgQVBJXG4gICAgY29uc3QgdGhyZXNob2xkTnVtID1cbiAgICAgIG9wdGlvbnMuYWxsb3dCdWxrID09PSBmYWxzZVxuICAgICAgICA/IC0xXG4gICAgICAgIDogdHlwZW9mIG9wdGlvbnMuYnVsa1RocmVzaG9sZCA9PT0gJ251bWJlcidcbiAgICAgICAgPyBvcHRpb25zLmJ1bGtUaHJlc2hvbGRcbiAgICAgICAgOiAvLyBkZXRlcm1pbmUgdGhyZXNob2xkIGlmIHRoZSBjb25uZWN0aW9uIHZlcnNpb24gc3VwcG9ydHMgU09iamVjdCBjb2xsZWN0aW9uIEFQSSBvciBub3RcbiAgICAgICAgdGhpcy5fY29ubi5fZW5zdXJlVmVyc2lvbig0MilcbiAgICAgICAgPyBERUZBVUxUX0JVTEtfVEhSRVNIT0xEXG4gICAgICAgIDogdGhpcy5fY29ubi5fbWF4UmVxdWVzdCAvIDI7XG5cbiAgICBjb25zdCBidWxrQXBpVmVyc2lvbiA9IG9wdGlvbnMuYnVsa0FwaVZlcnNpb24gPz8gREVGQVVMVF9CVUxLX0FQSV9WRVJTSU9OO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGNyZWF0ZUJhdGNoID0gKCkgPT5cbiAgICAgICAgdGhpcy5fY29ublxuICAgICAgICAgIC5zb2JqZWN0KHR5cGVfKVxuICAgICAgICAgIC5kZWxldGVCdWxrKClcbiAgICAgICAgICAub24oJ3Jlc3BvbnNlJywgcmVzb2x2ZSlcbiAgICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgIGxldCByZWNvcmRzOiBSZWNvcmRbXSA9IFtdO1xuICAgICAgbGV0IGJhdGNoOiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVCYXRjaD4gfCBudWxsID0gbnVsbDtcbiAgICAgIGNvbnN0IGhhbmRsZVJlY29yZCA9IChyZWM6IFJlY29yZCkgPT4ge1xuICAgICAgICBpZiAoIXJlYy5JZCkge1xuICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdRdWVyaWVkIHJlY29yZCBkb2VzIG5vdCBpbmNsdWRlIFNhbGVzZm9yY2UgcmVjb3JkIElELicsXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVjb3JkOiBSZWNvcmQgPSB7IElkOiByZWMuSWQgfTtcbiAgICAgICAgaWYgKGJhdGNoKSB7XG4gICAgICAgICAgYmF0Y2gud3JpdGUocmVjb3JkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWNvcmRzLnB1c2gocmVjb3JkKTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aHJlc2hvbGROdW0gPj0gMCAmJlxuICAgICAgICAgICAgcmVjb3Jkcy5sZW5ndGggPiB0aHJlc2hvbGROdW0gJiZcbiAgICAgICAgICAgIGJ1bGtBcGlWZXJzaW9uID09PSAxXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBVc2UgYnVsayBkZWxldGUgaW5zdGVhZCBvZiBTT2JqZWN0IFJFU1QgQVBJXG4gICAgICAgICAgICBiYXRjaCA9IGNyZWF0ZUJhdGNoKCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZWNvcmRzKSB7XG4gICAgICAgICAgICAgIGJhdGNoLndyaXRlKHJlY29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWNvcmRzID0gW107XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgY29uc3QgaGFuZGxlRW5kID0gKCkgPT4ge1xuICAgICAgICBpZiAoYmF0Y2gpIHtcbiAgICAgICAgICBiYXRjaC5lbmQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBpZHMgPSByZWNvcmRzLm1hcCgocmVjb3JkKSA9PiByZWNvcmQuSWQgYXMgc3RyaW5nKTtcbiAgICAgICAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiB0aHJlc2hvbGROdW0gJiYgYnVsa0FwaVZlcnNpb24gPT09IDIpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvbm4uYnVsazJcbiAgICAgICAgICAgICAgLmxvYWRBbmRXYWl0Rm9yUmVzdWx0cyh7XG4gICAgICAgICAgICAgICAgb2JqZWN0OiB0eXBlXyxcbiAgICAgICAgICAgICAgICBvcGVyYXRpb246ICdkZWxldGUnLFxuICAgICAgICAgICAgICAgIGlucHV0OiByZWNvcmRzLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICAoYWxsUmVzdWx0cykgPT5cbiAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5tYXBCdWxrVjJSZXN1bHRzVG9TYXZlUmVzdWx0cyhhbGxSZXN1bHRzKSksXG4gICAgICAgICAgICAgICAgcmVqZWN0LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb25uXG4gICAgICAgICAgICAgIC5zb2JqZWN0KHR5cGVfKVxuICAgICAgICAgICAgICAuZGVzdHJveShpZHMsIHsgYWxsb3dSZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgICAgICAgICAgLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB0aGlzLnN0cmVhbSgncmVjb3JkJylcbiAgICAgICAgLm9uKCdkYXRhJywgaGFuZGxlUmVjb3JkKVxuICAgICAgICAub24oJ2VuZCcsIGhhbmRsZUVuZClcbiAgICAgICAgLm9uKCdlcnJvcicsIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBRdWVyeSNkZXN0cm95KClcbiAgICovXG4gIGRlbGV0ZSA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogU3lub255bSBvZiBRdWVyeSNkZXN0cm95KClcbiAgICovXG4gIGRlbCA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogQnVsayB1cGRhdGUgcXVlcmllZCByZWNvcmRzLCB1c2luZyBnaXZlbiBtYXBwaW5nIGZ1bmN0aW9uL29iamVjdFxuICAgKi9cbiAgdXBkYXRlPFVSIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+PihcbiAgICBtYXBwaW5nOiAoKHJlYzogUikgPT4gVVIpIHwgVVIsXG4gICAgdHlwZTogTixcbiAgICBvcHRpb25zPzogUXVlcnlVcGRhdGVPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIHVwZGF0ZTxVUiBleHRlbmRzIFNPYmplY3RJbnB1dFJlY29yZDxTLCBOPj4oXG4gICAgbWFwcGluZzogKChyZWM6IFIpID0+IFVSKSB8IFVSLFxuICAgIG9wdGlvbnM/OiBRdWVyeVVwZGF0ZU9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgdXBkYXRlPFVSIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+PihcbiAgICBtYXBwaW5nOiAoKHJlYzogUikgPT4gVVIpIHwgVVIsXG4gICAgdHlwZT86IE4gfCBRdWVyeVVwZGF0ZU9wdGlvbnMsXG4gICAgb3B0aW9ucz86IFF1ZXJ5VXBkYXRlT3B0aW9ucyxcbiAgKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnb2JqZWN0JyAmJiB0eXBlICE9PSBudWxsKSB7XG4gICAgICBvcHRpb25zID0gdHlwZTtcbiAgICAgIHR5cGUgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIGNvbnN0IHR5cGVfOiBPcHRpb25hbDxOPiA9XG4gICAgICB0eXBlIHx8ICh0aGlzLl9jb25maWcgJiYgKHRoaXMuX2NvbmZpZy50YWJsZSBhcyBPcHRpb25hbDxOPikpO1xuICAgIGlmICghdHlwZV8pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1NPUUwgYmFzZWQgcXVlcnkgbmVlZHMgU09iamVjdCB0eXBlIGluZm9ybWF0aW9uIHRvIGJ1bGsgdXBkYXRlLicsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB1cGRhdGVTdHJlYW0gPVxuICAgICAgdHlwZW9mIG1hcHBpbmcgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBSZWNvcmRTdHJlYW0ubWFwKG1hcHBpbmcpXG4gICAgICAgIDogUmVjb3JkU3RyZWFtLnJlY29yZE1hcFN0cmVhbShtYXBwaW5nKTtcbiAgICAvLyBTZXQgdGhlIHRocmVzaG9sZCBudW1iZXIgdG8gcGFzcyB0byBidWxrIEFQSVxuICAgIGNvbnN0IHRocmVzaG9sZE51bSA9XG4gICAgICBvcHRpb25zLmFsbG93QnVsayA9PT0gZmFsc2VcbiAgICAgICAgPyAtMVxuICAgICAgICA6IHR5cGVvZiBvcHRpb25zLmJ1bGtUaHJlc2hvbGQgPT09ICdudW1iZXInXG4gICAgICAgID8gb3B0aW9ucy5idWxrVGhyZXNob2xkXG4gICAgICAgIDogLy8gZGV0ZXJtaW5lIHRocmVzaG9sZCBpZiB0aGUgY29ubmVjdGlvbiB2ZXJzaW9uIHN1cHBvcnRzIFNPYmplY3QgY29sbGVjdGlvbiBBUEkgb3Igbm90XG4gICAgICAgIHRoaXMuX2Nvbm4uX2Vuc3VyZVZlcnNpb24oNDIpXG4gICAgICAgID8gREVGQVVMVF9CVUxLX1RIUkVTSE9MRFxuICAgICAgICA6IHRoaXMuX2Nvbm4uX21heFJlcXVlc3QgLyAyO1xuICAgIGNvbnN0IGJ1bGtBcGlWZXJzaW9uID0gb3B0aW9ucy5idWxrQXBpVmVyc2lvbiA/PyBERUZBVUxUX0JVTEtfQVBJX1ZFUlNJT047XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGNyZWF0ZUJhdGNoID0gKCkgPT5cbiAgICAgICAgdGhpcy5fY29ublxuICAgICAgICAgIC5zb2JqZWN0KHR5cGVfKVxuICAgICAgICAgIC51cGRhdGVCdWxrKClcbiAgICAgICAgICAub24oJ3Jlc3BvbnNlJywgcmVzb2x2ZSlcbiAgICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgIGxldCByZWNvcmRzOiBTT2JqZWN0VXBkYXRlUmVjb3JkPFMsIE4+W10gPSBbXTtcbiAgICAgIGxldCBiYXRjaDogUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlQmF0Y2g+IHwgbnVsbCA9IG51bGw7XG4gICAgICBjb25zdCBoYW5kbGVSZWNvcmQgPSAocmVjb3JkOiBSZWNvcmQpID0+IHtcbiAgICAgICAgaWYgKGJhdGNoKSB7XG4gICAgICAgICAgYmF0Y2gud3JpdGUocmVjb3JkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWNvcmRzLnB1c2gocmVjb3JkIGFzIFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj4pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aHJlc2hvbGROdW0gPj0gMCAmJlxuICAgICAgICAgIHJlY29yZHMubGVuZ3RoID4gdGhyZXNob2xkTnVtICYmXG4gICAgICAgICAgYnVsa0FwaVZlcnNpb24gPT09IDFcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gVXNlIGJ1bGsgdXBkYXRlIGluc3RlYWQgb2YgU09iamVjdCBSRVNUIEFQSVxuICAgICAgICAgIGJhdGNoID0gY3JlYXRlQmF0Y2goKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZWNvcmRzKSB7XG4gICAgICAgICAgICBiYXRjaC53cml0ZShyZWNvcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWNvcmRzID0gW107XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBjb25zdCBoYW5kbGVFbmQgPSAoKSA9PiB7XG4gICAgICAgIGlmIChiYXRjaCkge1xuICAgICAgICAgIGJhdGNoLmVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IHRocmVzaG9sZE51bSAmJiBidWxrQXBpVmVyc2lvbiA9PT0gMikge1xuICAgICAgICAgICAgdGhpcy5fY29ubi5idWxrMlxuICAgICAgICAgICAgICAubG9hZEFuZFdhaXRGb3JSZXN1bHRzKHtcbiAgICAgICAgICAgICAgICBvYmplY3Q6IHR5cGVfLFxuICAgICAgICAgICAgICAgIG9wZXJhdGlvbjogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgaW5wdXQ6IHJlY29yZHMsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIChhbGxSZXN1bHRzKSA9PlxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLm1hcEJ1bGtWMlJlc3VsdHNUb1NhdmVSZXN1bHRzKGFsbFJlc3VsdHMpKSxcbiAgICAgICAgICAgICAgICByZWplY3QsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvbm5cbiAgICAgICAgICAgICAgLnNvYmplY3QodHlwZV8pXG4gICAgICAgICAgICAgIC51cGRhdGUocmVjb3JkcywgeyBhbGxvd1JlY3Vyc2l2ZTogdHJ1ZSB9KVxuICAgICAgICAgICAgICAudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHRoaXMuc3RyZWFtKCdyZWNvcmQnKVxuICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgICAucGlwZSh1cGRhdGVTdHJlYW0pXG4gICAgICAgIC5vbignZGF0YScsIGhhbmRsZVJlY29yZClcbiAgICAgICAgLm9uKCdlbmQnLCBoYW5kbGVFbmQpXG4gICAgICAgIC5vbignZXJyb3InLCByZWplY3QpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXBCdWxrVjJSZXN1bHRzVG9TYXZlUmVzdWx0cyhcbiAgICBidWxrSm9iQWxsUmVzdWx0czogSW5nZXN0Sm9iVjJSZXN1bHRzPFM+LFxuICApOiBTYXZlUmVzdWx0W10ge1xuICAgIGNvbnN0IHN1Y2Nlc3NTYXZlUmVzdWx0czogU2F2ZVJlc3VsdFtdID0gYnVsa0pvYkFsbFJlc3VsdHMuc3VjY2Vzc2Z1bFJlc3VsdHMubWFwKFxuICAgICAgKHIpID0+IHtcbiAgICAgICAgY29uc3Qgc2F2ZVJlc3VsdDogU2F2ZVJlc3VsdCA9IHtcbiAgICAgICAgICBpZDogci5zZl9fSWQsXG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBlcnJvcnM6IFtdLFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gc2F2ZVJlc3VsdDtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIGNvbnN0IGZhaWxlZFNhdmVSZXN1bHRzID0gYnVsa0pvYkFsbFJlc3VsdHMuZmFpbGVkUmVzdWx0cy5tYXAoKHIpID0+IHtcbiAgICAgIGNvbnN0IHNhdmVSZXN1bHQ6IFNhdmVSZXN1bHQgPSB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBlcnJvckNvZGU6IHIuc2ZfX0Vycm9yLFxuICAgICAgICAgICAgbWVzc2FnZTogci5zZl9fRXJyb3IsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgICByZXR1cm4gc2F2ZVJlc3VsdDtcbiAgICB9KTtcblxuICAgIHJldHVybiBbLi4uc3VjY2Vzc1NhdmVSZXN1bHRzLCAuLi5mYWlsZWRTYXZlUmVzdWx0c107XG4gIH1cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qKlxuICogU3ViUXVlcnkgb2JqZWN0IGZvciByZXByZXNlbnRpbmcgY2hpbGQgcmVsYXRpb25zaGlwIHF1ZXJ5XG4gKi9cbmV4cG9ydCBjbGFzcyBTdWJRdWVyeTxcbiAgUyBleHRlbmRzIFNjaGVtYSxcbiAgUE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gIFBSIGV4dGVuZHMgUmVjb3JkLFxuICBQUVJUIGV4dGVuZHMgUXVlcnlSZXNwb25zZVRhcmdldCxcbiAgQ1JOIGV4dGVuZHMgQ2hpbGRSZWxhdGlvbnNoaXBOYW1lczxTLCBQTj4gPSBDaGlsZFJlbGF0aW9uc2hpcE5hbWVzPFMsIFBOPixcbiAgQ04gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4gPSBDaGlsZFJlbGF0aW9uc2hpcFNPYmplY3ROYW1lPFMsIFBOLCBDUk4+LFxuICBDUiBleHRlbmRzIFJlY29yZCA9IFJlY29yZFxuPiB7XG4gIF9yZWxOYW1lOiBDUk47XG4gIF9xdWVyeTogUXVlcnk8UywgQ04sIENSPjtcbiAgX3BhcmVudDogUXVlcnk8UywgUE4sIFBSLCBQUVJUPjtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbm46IENvbm5lY3Rpb248Uz4sXG4gICAgcmVsTmFtZTogQ1JOLFxuICAgIGNvbmZpZzogUXVlcnlDb25maWc8UywgQ04+LFxuICAgIHBhcmVudDogUXVlcnk8UywgUE4sIFBSLCBQUVJUPixcbiAgKSB7XG4gICAgdGhpcy5fcmVsTmFtZSA9IHJlbE5hbWU7XG4gICAgdGhpcy5fcXVlcnkgPSBuZXcgUXVlcnkoY29ubiwgY29uZmlnKTtcbiAgICB0aGlzLl9wYXJlbnQgPSBwYXJlbnQ7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHNlbGVjdDxcbiAgICBSIGV4dGVuZHMgUmVjb3JkID0gUmVjb3JkLFxuICAgIEZQIGV4dGVuZHMgRmllbGRQYXRoU3BlY2lmaWVyPFMsIENOPiA9IEZpZWxkUGF0aFNwZWNpZmllcjxTLCBDTj4sXG4gICAgRlBDIGV4dGVuZHMgRmllbGRQcm9qZWN0aW9uQ29uZmlnID0gRmllbGRQYXRoU2NvcGVkUHJvamVjdGlvbjxTLCBDTiwgRlA+XG4gID4oXG4gICAgZmllbGRzOiBRdWVyeUZpZWxkPFMsIENOLCBGUD4sXG4gICk6IFN1YlF1ZXJ5PFMsIFBOLCBQUiwgUFFSVCwgQ1JOLCBDTiwgU09iamVjdFJlY29yZDxTLCBDTiwgRlBDLCBSPj4ge1xuICAgIC8vIGZvcmNlIGNvbnZlcnQgcXVlcnkgcmVjb3JkIHR5cGUgd2l0aG91dCBjaGFuZ2luZyBpbnN0YW5jZVxuICAgIHRoaXMuX3F1ZXJ5ID0gdGhpcy5fcXVlcnkuc2VsZWN0KGZpZWxkcykgYXMgYW55O1xuICAgIHJldHVybiAodGhpcyBhcyBhbnkpIGFzIFN1YlF1ZXJ5PFxuICAgICAgUyxcbiAgICAgIFBOLFxuICAgICAgUFIsXG4gICAgICBQUVJULFxuICAgICAgQ1JOLFxuICAgICAgQ04sXG4gICAgICBTT2JqZWN0UmVjb3JkPFMsIENOLCBGUEMsIFI+XG4gICAgPjtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgd2hlcmUoY29uZGl0aW9uczogUXVlcnlDb25kaXRpb248UywgQ04+IHwgc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5fcXVlcnkgPSB0aGlzLl9xdWVyeS53aGVyZShjb25kaXRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBMaW1pdCB0aGUgcmV0dXJuaW5nIHJlc3VsdFxuICAgKi9cbiAgbGltaXQobGltaXQ6IG51bWJlcikge1xuICAgIHRoaXMuX3F1ZXJ5ID0gdGhpcy5fcXVlcnkubGltaXQobGltaXQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNraXAgcmVjb3Jkc1xuICAgKi9cbiAgc2tpcChvZmZzZXQ6IG51bWJlcikge1xuICAgIHRoaXMuX3F1ZXJ5ID0gdGhpcy5fcXVlcnkuc2tpcChvZmZzZXQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgU3ViUXVlcnkjc2tpcCgpXG4gICAqL1xuICBvZmZzZXQgPSB0aGlzLnNraXA7XG5cbiAgLyoqXG4gICAqIFNldCBxdWVyeSBzb3J0IHdpdGggZGlyZWN0aW9uXG4gICAqL1xuICBzb3J0KHNvcnQ6IFF1ZXJ5U29ydDxTLCBDTj4pOiB0aGlzO1xuICBzb3J0KHNvcnQ6IHN0cmluZyk6IHRoaXM7XG4gIHNvcnQoc29ydDogU09iamVjdEZpZWxkTmFtZXM8UywgQ04+LCBkaXI6IFNvcnREaXIpOiB0aGlzO1xuICBzb3J0KHNvcnQ6IHN0cmluZywgZGlyOiBTb3J0RGlyKTogdGhpcztcbiAgc29ydChcbiAgICBzb3J0OiBRdWVyeVNvcnQ8UywgQ04+IHwgU09iamVjdEZpZWxkTmFtZXM8UywgQ04+IHwgc3RyaW5nLFxuICAgIGRpcj86IFNvcnREaXIsXG4gICkge1xuICAgIHRoaXMuX3F1ZXJ5ID0gdGhpcy5fcXVlcnkuc29ydChzb3J0IGFzIGFueSwgZGlyIGFzIFNvcnREaXIpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgU3ViUXVlcnkjc29ydCgpXG4gICAqL1xuICBvcmRlcmJ5OiB0eXBlb2YgU3ViUXVlcnkucHJvdG90eXBlLnNvcnQgPSB0aGlzLnNvcnQ7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBhc3luYyBfZXhwYW5kRmllbGRzKCkge1xuICAgIGNvbnN0IHNvYmplY3QgPSBhd2FpdCB0aGlzLl9wYXJlbnQuX2ZpbmRSZWxhdGlvbk9iamVjdCh0aGlzLl9yZWxOYW1lKTtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnkuX2V4cGFuZEZpZWxkcyhzb2JqZWN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCYWNrIHRoZSBjb250ZXh0IHRvIHBhcmVudCBxdWVyeSBvYmplY3RcbiAgICovXG4gIGVuZDxcbiAgICBDUlAgZXh0ZW5kcyBTT2JqZWN0Q2hpbGRSZWxhdGlvbnNoaXBQcm9wPFxuICAgICAgQ1JOLFxuICAgICAgQ1JcbiAgICA+ID0gU09iamVjdENoaWxkUmVsYXRpb25zaGlwUHJvcDxDUk4sIENSPixcbiAgICBQUjEgZXh0ZW5kcyBSZWNvcmQgPSBQUiAmIENSUFxuICA+KCk6IFF1ZXJ5PFMsIFBOLCBQUjEsIFBRUlQ+IHtcbiAgICByZXR1cm4gKHRoaXMuX3BhcmVudCBhcyBhbnkpIGFzIFF1ZXJ5PFMsIFBOLCBQUjEsIFBRUlQ+O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFF1ZXJ5O1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsT0FBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsYUFBQSxHQUFBQyx1QkFBQSxDQUFBSCxPQUFBO0FBRUEsSUFBQUksWUFBQSxHQUFBSixPQUFBO0FBQTRDLFNBQUFLLFFBQUFDLE1BQUEsRUFBQUMsY0FBQSxRQUFBQyxJQUFBLEdBQUFDLGFBQUEsQ0FBQUgsTUFBQSxPQUFBSSw2QkFBQSxRQUFBQyxPQUFBLEdBQUFELDZCQUFBLENBQUFKLE1BQUEsT0FBQUMsY0FBQSxFQUFBSSxPQUFBLEdBQUFDLHVCQUFBLENBQUFELE9BQUEsRUFB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