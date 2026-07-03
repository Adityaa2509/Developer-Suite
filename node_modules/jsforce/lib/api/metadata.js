"use strict";

var _context4;
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
var _exportNames = {
  MetadataApi: true,
  AsyncResultLocator: true,
  RetrieveResultLocator: true,
  DeployResultLocator: true
};
exports.default = exports.DeployResultLocator = exports.RetrieveResultLocator = exports.AsyncResultLocator = exports.MetadataApi = void 0;
var _setTimeout2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set-timeout"));
var _concat = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/concat"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));
var _events = require("events");
var _stream = require("stream");
var _formData = _interopRequireDefault(require("form-data"));
var _jsforce = require("../jsforce");
var _soap = _interopRequireDefault(require("../soap"));
var _function = require("../util/function");
var _schema = require("./metadata/schema");
_forEachInstanceProperty(_context4 = _Object$keys(_schema)).call(_context4, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _schema[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _schema[key];
    }
  });
});
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source), true)).call(_context2, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source))).call(_context3, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @file Manages Salesforce Metadata API
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
/**
 *
 */

/**
 *
 */
function deallocateTypeWithMetadata(metadata) {
  const _ref = metadata,
    {
      $
    } = _ref,
    md = (0, _objectWithoutProperties2.default)(_ref, ["$"]);
  return md;
}
function assignTypeWithMetadata(metadata, type) {
  const convert = md => _objectSpread({
    ['@xsi:type']: type
  }, md);
  return (0, _isArray.default)(metadata) ? (0, _map.default)(metadata).call(metadata, convert) : convert(metadata);
}

/**
 * Class for Salesforce Metadata API
 */
class MetadataApi {
  /**
   * Polling interval in milliseconds
   */

  /**
   * Polling timeout in milliseconds
   */

  /**
   *
   */
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "pollInterval", 1000);
    (0, _defineProperty2.default)(this, "pollTimeout", 10000);
    this._conn = conn;
  }

  /**
   * Call Metadata API SOAP endpoint
   *
   * @private
   */
  async _invoke(method, message, schema) {
    const soapEndpoint = new _soap.default(this._conn, {
      xmlns: 'http://soap.sforce.com/2006/04/metadata',
      endpointUrl: `${this._conn.instanceUrl}/services/Soap/m/${this._conn.version}`
    });
    const res = await soapEndpoint.invoke(method, message, schema ? {
      result: schema
    } : undefined, _schema.ApiSchemas);
    return res.result;
  }

  /**
   * Add one or more new metadata components to the organization.
   */

  create(type, metadata) {
    const isArray = (0, _isArray.default)(metadata);
    metadata = assignTypeWithMetadata(metadata, type);
    const schema = isArray ? [_schema.ApiSchemas.SaveResult] : _schema.ApiSchemas.SaveResult;
    return this._invoke('createMetadata', {
      metadata
    }, schema);
  }

  /**
   * Read specified metadata components in the organization.
   */

  async read(type, fullNames) {
    var _context;
    const ReadResultSchema = type in _schema.ApiSchemas ? {
      type: _schema.ApiSchemas.ReadResult.type,
      props: {
        records: [type]
      }
    } : _schema.ApiSchemas.ReadResult;
    const res = await this._invoke('readMetadata', {
      type,
      fullNames
    }, ReadResultSchema);
    return (0, _isArray.default)(fullNames) ? (0, _map.default)(_context = res.records).call(_context, deallocateTypeWithMetadata) : deallocateTypeWithMetadata(res.records[0]);
  }

  /**
   * Update one or more metadata components in the organization.
   */

  update(type, metadata) {
    const isArray = (0, _isArray.default)(metadata);
    metadata = assignTypeWithMetadata(metadata, type);
    const schema = isArray ? [_schema.ApiSchemas.SaveResult] : _schema.ApiSchemas.SaveResult;
    return this._invoke('updateMetadata', {
      metadata
    }, schema);
  }

  /**
   * Upsert one or more components in your organization's data.
   */

  upsert(type, metadata) {
    const isArray = (0, _isArray.default)(metadata);
    metadata = assignTypeWithMetadata(metadata, type);
    const schema = isArray ? [_schema.ApiSchemas.UpsertResult] : _schema.ApiSchemas.UpsertResult;
    return this._invoke('upsertMetadata', {
      metadata
    }, schema);
  }

  /**
   * Deletes specified metadata components in the organization.
   */

  delete(type, fullNames) {
    const schema = (0, _isArray.default)(fullNames) ? [_schema.ApiSchemas.SaveResult] : _schema.ApiSchemas.SaveResult;
    return this._invoke('deleteMetadata', {
      type,
      fullNames
    }, schema);
  }

  /**
   * Rename fullname of a metadata component in the organization
   */
  rename(type, oldFullName, newFullName) {
    return this._invoke('renameMetadata', {
      type,
      oldFullName,
      newFullName
    }, _schema.ApiSchemas.SaveResult);
  }

  /**
   * Retrieves the metadata which describes your organization, including Apex classes and triggers,
   * custom objects, custom fields on standard objects, tab sets that define an app,
   * and many other components.
   */
  describe(asOfVersion) {
    if (!asOfVersion) {
      asOfVersion = this._conn.version;
    }
    return this._invoke('describeMetadata', {
      asOfVersion
    }, _schema.ApiSchemas.DescribeMetadataResult);
  }

  /**
   * Retrieves property information about metadata components in your organization
   */
  list(queries, asOfVersion) {
    if (!asOfVersion) {
      asOfVersion = this._conn.version;
    }
    return this._invoke('listMetadata', {
      queries,
      asOfVersion
    }, [_schema.ApiSchemas.FileProperties]);
  }

  /**
   * Checks the status of asynchronous metadata calls
   */
  checkStatus(asyncProcessId) {
    const res = this._invoke('checkStatus', {
      asyncProcessId
    }, _schema.ApiSchemas.AsyncResult);
    return new AsyncResultLocator(this, res);
  }

  /**
   * Retrieves XML file representations of components in an organization
   */
  retrieve(request) {
    const res = this._invoke('retrieve', {
      request
    }, _schema.ApiSchemas.RetrieveResult);
    return new RetrieveResultLocator(this, res);
  }

  /**
   * Checks the status of declarative metadata call retrieve() and returns the zip file contents
   */
  checkRetrieveStatus(asyncProcessId) {
    return this._invoke('checkRetrieveStatus', {
      asyncProcessId
    }, _schema.ApiSchemas.RetrieveResult);
  }

  /**
   * Will deploy a recently validated deploy request
   *
   * @param options.id = the deploy ID that's been validated already from a previous checkOnly deploy request
   * @param options.rest = a boolean whether or not to use the REST API
   * @returns the deploy ID of the recent validation request
   */
  async deployRecentValidation(options) {
    const {
      id,
      rest
    } = options;
    let response;
    if (rest) {
      const messageBody = (0, _stringify.default)({
        validatedDeployRequestId: id
      });
      const requestInfo = {
        method: 'POST',
        url: `${this._conn._baseUrl()}/metadata/deployRequest`,
        body: messageBody,
        headers: {
          'content-type': 'application/json'
        }
      };
      const requestOptions = {
        headers: 'json'
      };
      // This is the deploy ID of the deployRecentValidation response, not
      // the already validated deploy ID (i.e., validateddeployrequestid).
      // REST returns an object with an id property, SOAP returns the id as a string directly.
      response = (await this._conn.request(requestInfo, requestOptions)).id;
    } else {
      response = await this._invoke('deployRecentValidation', {
        validationId: id
      });
    }
    return response;
  }

  /**
   * Deploy components into an organization using zipped file representations
   * using the REST Metadata API instead of SOAP
   */
  deployRest(zipInput, options = {}) {
    const form = new _formData.default();
    form.append('file', zipInput, {
      contentType: 'application/zip',
      filename: 'package.xml'
    });

    // Add the deploy options
    form.append('entity_content', (0, _stringify.default)({
      deployOptions: options
    }), {
      contentType: 'application/json'
    });
    const request = {
      url: '/metadata/deployRequest',
      method: 'POST',
      headers: _objectSpread({}, form.getHeaders()),
      body: form.getBuffer()
    };
    const res = this._conn.request(request);
    return new DeployResultLocator(this, res);
  }

  /**
   * Deploy components into an organization using zipped file representations
   */
  deploy(zipInput, options = {}) {
    const res = (async () => {
      const zipContentB64 = await new _promise.default((resolve, reject) => {
        if ((0, _function.isObject)(zipInput) && 'pipe' in zipInput && typeof zipInput.pipe === 'function') {
          const bufs = [];
          zipInput.on('data', d => bufs.push(d));
          zipInput.on('error', reject);
          zipInput.on('end', () => {
            resolve((0, _concat.default)(Buffer).call(Buffer, bufs).toString('base64'));
          });
          // zipInput.resume();
        } else if (zipInput instanceof Buffer) {
          resolve(zipInput.toString('base64'));
        } else if (zipInput instanceof String || typeof zipInput === 'string') {
          resolve(zipInput);
        } else {
          throw 'Unexpected zipInput type';
        }
      });
      return this._invoke('deploy', {
        ZipFile: zipContentB64,
        DeployOptions: options
      }, _schema.ApiSchemas.DeployResult);
    })();
    return new DeployResultLocator(this, res);
  }

  /**
   * Checks the status of declarative metadata call deploy()
   */
  checkDeployStatus(asyncProcessId, includeDetails = false) {
    return this._invoke('checkDeployStatus', {
      asyncProcessId,
      includeDetails
    }, _schema.ApiSchemas.DeployResult);
  }
}

/*--------------------------------------------*/

/**
 * The locator class for Metadata API asynchronous call result
 */
exports.MetadataApi = MetadataApi;
class AsyncResultLocator extends _events.EventEmitter {
  /**
   *
   */
  constructor(meta, promise) {
    super();
    (0, _defineProperty2.default)(this, "_meta", void 0);
    (0, _defineProperty2.default)(this, "_promise", void 0);
    (0, _defineProperty2.default)(this, "_id", void 0);
    this._meta = meta;
    this._promise = promise;
  }

  /**
   * Promise/A+ interface
   * http://promises-aplus.github.io/promises-spec/
   *
   * @method Metadata~AsyncResultLocator#then
   */
  then(onResolve, onReject) {
    return this._promise.then(onResolve, onReject);
  }

  /**
   * Check the status of async request
   */
  async check() {
    const result = await this._promise;
    this._id = result.id;
    return await this._meta.checkStatus(result.id);
  }

  /**
   * Polling until async call status becomes complete or error
   */
  poll(interval, timeout) {
    const startTime = new Date().getTime();
    const poll = async () => {
      try {
        const now = new Date().getTime();
        if (startTime + timeout < now) {
          let errMsg = 'Polling time out.';
          if (this._id) {
            errMsg += ' Process Id = ' + this._id;
          }
          this.emit('error', new Error(errMsg));
          return;
        }
        const result = await this.check();
        if (result.done) {
          this.emit('complete', result);
        } else {
          this.emit('progress', result);
          (0, _setTimeout2.default)(poll, interval);
        }
      } catch (err) {
        this.emit('error', err);
      }
    };
    (0, _setTimeout2.default)(poll, interval);
  }

  /**
   * Check and wait until the async requests become in completed status
   */
  complete() {
    return new _promise.default((resolve, reject) => {
      this.on('complete', resolve);
      this.on('error', reject);
      this.poll(this._meta.pollInterval, this._meta.pollTimeout);
    });
  }
}

/*--------------------------------------------*/
/**
 * The locator class to track retreive() Metadata API call result
 */
exports.AsyncResultLocator = AsyncResultLocator;
class RetrieveResultLocator extends AsyncResultLocator {
  /**
   * Check and wait until the async request becomes in completed status,
   * and retrieve the result data.
   */
  async complete() {
    const result = await super.complete();
    return this._meta.checkRetrieveStatus(result.id);
  }

  /**
   * Change the retrieved result to Node.js readable stream
   */
  stream() {
    const resultStream = new _stream.Readable();
    let reading = false;
    resultStream._read = async () => {
      if (reading) {
        return;
      }
      reading = true;
      try {
        const result = await this.complete();
        resultStream.push(Buffer.from(result.zipFile, 'base64'));
        resultStream.push(null);
      } catch (e) {
        resultStream.emit('error', e);
      }
    };
    return resultStream;
  }
}

/*--------------------------------------------*/
/**
 * The locator class to track deploy() Metadata API call result
 *
 * @protected
 * @class Metadata~DeployResultLocator
 * @extends Metadata~AsyncResultLocator
 * @param {Metadata} meta - Metadata API object
 * @param {Promise.<Metadata~AsyncResult>} result - Promise object for async result of deploy() call
 */
exports.RetrieveResultLocator = RetrieveResultLocator;
class DeployResultLocator extends AsyncResultLocator {
  /**
   * Check and wait until the async request becomes in completed status,
   * and retrieve the result data.
   */
  async complete(includeDetails) {
    const result = await super.complete();
    return this._meta.checkDeployStatus(result.id, includeDetails);
  }
}

/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
exports.DeployResultLocator = DeployResultLocator;
(0, _jsforce.registerModule)('metadata', conn => new MetadataApi(conn));
var _default = MetadataApi;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9zdHJlYW0iLCJfZm9ybURhdGEiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX2pzZm9yY2UiLCJfc29hcCIsIl9mdW5jdGlvbiIsIl9zY2hlbWEiLCJfZm9yRWFjaEluc3RhbmNlUHJvcGVydHkiLCJfY29udGV4dDQiLCJfT2JqZWN0JGtleXMiLCJjYWxsIiwia2V5IiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJfZXhwb3J0TmFtZXMiLCJleHBvcnRzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiLCJnZXQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiX2ZpbHRlckluc3RhbmNlUHJvcGVydHkiLCJzeW0iLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvciIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiX2NvbnRleHQyIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJfT2JqZWN0JGRlZmluZVByb3BlcnRpZXMiLCJfY29udGV4dDMiLCJkZWFsbG9jYXRlVHlwZVdpdGhNZXRhZGF0YSIsIm1ldGFkYXRhIiwiX3JlZiIsIiQiLCJtZCIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllczIiLCJhc3NpZ25UeXBlV2l0aE1ldGFkYXRhIiwidHlwZSIsImNvbnZlcnQiLCJfaXNBcnJheSIsIl9tYXAiLCJNZXRhZGF0YUFwaSIsImNvbnN0cnVjdG9yIiwiY29ubiIsIl9jb25uIiwiX2ludm9rZSIsIm1ldGhvZCIsIm1lc3NhZ2UiLCJzY2hlbWEiLCJzb2FwRW5kcG9pbnQiLCJTT0FQIiwieG1sbnMiLCJlbmRwb2ludFVybCIsImluc3RhbmNlVXJsIiwidmVyc2lvbiIsInJlcyIsImludm9rZSIsInJlc3VsdCIsInVuZGVmaW5lZCIsIkFwaVNjaGVtYXMiLCJjcmVhdGUiLCJpc0FycmF5IiwiU2F2ZVJlc3VsdCIsInJlYWQiLCJmdWxsTmFtZXMiLCJfY29udGV4dCIsIlJlYWRSZXN1bHRTY2hlbWEiLCJSZWFkUmVzdWx0IiwicHJvcHMiLCJyZWNvcmRzIiwidXBkYXRlIiwidXBzZXJ0IiwiVXBzZXJ0UmVzdWx0IiwiZGVsZXRlIiwicmVuYW1lIiwib2xkRnVsbE5hbWUiLCJuZXdGdWxsTmFtZSIsImRlc2NyaWJlIiwiYXNPZlZlcnNpb24iLCJEZXNjcmliZU1ldGFkYXRhUmVzdWx0IiwibGlzdCIsInF1ZXJpZXMiLCJGaWxlUHJvcGVydGllcyIsImNoZWNrU3RhdHVzIiwiYXN5bmNQcm9jZXNzSWQiLCJBc3luY1Jlc3VsdCIsIkFzeW5jUmVzdWx0TG9jYXRvciIsInJldHJpZXZlIiwicmVxdWVzdCIsIlJldHJpZXZlUmVzdWx0IiwiUmV0cmlldmVSZXN1bHRMb2NhdG9yIiwiY2hlY2tSZXRyaWV2ZVN0YXR1cyIsImRlcGxveVJlY2VudFZhbGlkYXRpb24iLCJvcHRpb25zIiwiaWQiLCJyZXN0IiwicmVzcG9uc2UiLCJtZXNzYWdlQm9keSIsIl9zdHJpbmdpZnkiLCJ2YWxpZGF0ZWREZXBsb3lSZXF1ZXN0SWQiLCJyZXF1ZXN0SW5mbyIsInVybCIsIl9iYXNlVXJsIiwiYm9keSIsImhlYWRlcnMiLCJyZXF1ZXN0T3B0aW9ucyIsInZhbGlkYXRpb25JZCIsImRlcGxveVJlc3QiLCJ6aXBJbnB1dCIsImZvcm0iLCJGb3JtRGF0YSIsImFwcGVuZCIsImNvbnRlbnRUeXBlIiwiZmlsZW5hbWUiLCJkZXBsb3lPcHRpb25zIiwiZ2V0SGVhZGVycyIsImdldEJ1ZmZlciIsIkRlcGxveVJlc3VsdExvY2F0b3IiLCJkZXBsb3kiLCJ6aXBDb250ZW50QjY0IiwiX3Byb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiaXNPYmplY3QiLCJwaXBlIiwiYnVmcyIsIm9uIiwiZCIsIl9jb25jYXQiLCJCdWZmZXIiLCJ0b1N0cmluZyIsIlN0cmluZyIsIlppcEZpbGUiLCJEZXBsb3lPcHRpb25zIiwiRGVwbG95UmVzdWx0IiwiY2hlY2tEZXBsb3lTdGF0dXMiLCJpbmNsdWRlRGV0YWlscyIsIkV2ZW50RW1pdHRlciIsIm1ldGEiLCJwcm9taXNlIiwiX21ldGEiLCJ0aGVuIiwib25SZXNvbHZlIiwib25SZWplY3QiLCJjaGVjayIsIl9pZCIsInBvbGwiLCJpbnRlcnZhbCIsInRpbWVvdXQiLCJzdGFydFRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsIm5vdyIsImVyck1zZyIsImVtaXQiLCJFcnJvciIsImRvbmUiLCJfc2V0VGltZW91dDIiLCJlcnIiLCJjb21wbGV0ZSIsInBvbGxJbnRlcnZhbCIsInBvbGxUaW1lb3V0Iiwic3RyZWFtIiwicmVzdWx0U3RyZWFtIiwiUmVhZGFibGUiLCJyZWFkaW5nIiwiX3JlYWQiLCJmcm9tIiwiemlwRmlsZSIsImUiLCJyZWdpc3Rlck1vZHVsZSIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FwaS9tZXRhZGF0YS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIE1hbmFnZXMgU2FsZXNmb3JjZSBNZXRhZGF0YSBBUElcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgUmVhZGFibGUgfSBmcm9tICdzdHJlYW0nO1xuaW1wb3J0IEZvcm1EYXRhIGZyb20gJ2Zvcm0tZGF0YSc7XG5pbXBvcnQgeyByZWdpc3Rlck1vZHVsZSB9IGZyb20gJy4uL2pzZm9yY2UnO1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi4vY29ubmVjdGlvbic7XG5pbXBvcnQgU09BUCBmcm9tICcuLi9zb2FwJztcbmltcG9ydCB7IGlzT2JqZWN0IH0gZnJvbSAnLi4vdXRpbC9mdW5jdGlvbic7XG5pbXBvcnQgeyBTY2hlbWEsIFNvYXBTY2hlbWFEZWYsIFNvYXBTY2hlbWEsIEh0dHBSZXF1ZXN0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHtcbiAgQXBpU2NoZW1hcyxcbiAgTWV0YWRhdGEsXG4gIFJlYWRSZXN1bHQsXG4gIFNhdmVSZXN1bHQsXG4gIFVwc2VydFJlc3VsdCxcbiAgTGlzdE1ldGFkYXRhUXVlcnksXG4gIEZpbGVQcm9wZXJ0aWVzLFxuICBEZXNjcmliZU1ldGFkYXRhUmVzdWx0LFxuICBSZXRyaWV2ZVJlcXVlc3QsXG4gIERlcGxveU9wdGlvbnMsXG4gIFJldHJpZXZlUmVzdWx0LFxuICBEZXBsb3lSZXN1bHQsXG4gIEFzeW5jUmVzdWx0LFxuICBBcGlTY2hlbWFUeXBlcyxcbn0gZnJvbSAnLi9tZXRhZGF0YS9zY2hlbWEnO1xuZXhwb3J0ICogZnJvbSAnLi9tZXRhZGF0YS9zY2hlbWEnO1xuXG4vKipcbiAqXG4gKi9cbnR5cGUgTWV0YWRhdGFUeXBlXzxcbiAgSyBleHRlbmRzIGtleW9mIEFwaVNjaGVtYVR5cGVzID0ga2V5b2YgQXBpU2NoZW1hVHlwZXNcbj4gPSBLIGV4dGVuZHMga2V5b2YgQXBpU2NoZW1hVHlwZXNcbiAgPyBBcGlTY2hlbWFUeXBlc1tLXSBleHRlbmRzIE1ldGFkYXRhXG4gICAgPyBLXG4gICAgOiBuZXZlclxuICA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBNZXRhZGF0YVR5cGUgPSBNZXRhZGF0YVR5cGVfO1xuXG5leHBvcnQgdHlwZSBNZXRhZGF0YURlZmluaXRpb248XG4gIFQgZXh0ZW5kcyBzdHJpbmcsXG4gIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhXG4+ID0gTWV0YWRhdGEgZXh0ZW5kcyBNXG4gID8gVCBleHRlbmRzIGtleW9mIEFwaVNjaGVtYVR5cGVzICYgTWV0YWRhdGFUeXBlXG4gICAgPyBBcGlTY2hlbWFUeXBlc1tUXSBleHRlbmRzIE1ldGFkYXRhXG4gICAgICA/IEFwaVNjaGVtYVR5cGVzW1RdXG4gICAgICA6IE1ldGFkYXRhXG4gICAgOiBNZXRhZGF0YVxuICA6IE07XG5cbnR5cGUgRGVlcFBhcnRpYWw8VD4gPSBUIGV4dGVuZHMgYW55W11cbiAgPyBEZWVwUGFydGlhbDxUW251bWJlcl0+W11cbiAgOiBUIGV4dGVuZHMgb2JqZWN0XG4gID8geyBbSyBpbiBrZXlvZiBUXT86IERlZXBQYXJ0aWFsPFRbS10+IH1cbiAgOiBUO1xuXG5leHBvcnQgdHlwZSBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxcbiAgVCBleHRlbmRzIHN0cmluZyxcbiAgTSBleHRlbmRzIE1ldGFkYXRhID0gTWV0YWRhdGFcbj4gPSBEZWVwUGFydGlhbDxNZXRhZGF0YURlZmluaXRpb248VCwgTT4+O1xuXG4vKipcbiAqXG4gKi9cbmZ1bmN0aW9uIGRlYWxsb2NhdGVUeXBlV2l0aE1ldGFkYXRhPE0gZXh0ZW5kcyBNZXRhZGF0YT4obWV0YWRhdGE6IE0pOiBNIHtcbiAgY29uc3QgeyAkLCAuLi5tZCB9ID0gbWV0YWRhdGEgYXMgYW55O1xuICByZXR1cm4gbWQ7XG59XG5cbmZ1bmN0aW9uIGFzc2lnblR5cGVXaXRoTWV0YWRhdGEobWV0YWRhdGE6IE1ldGFkYXRhIHwgTWV0YWRhdGFbXSwgdHlwZTogc3RyaW5nKSB7XG4gIGNvbnN0IGNvbnZlcnQgPSAobWQ6IE1ldGFkYXRhKSA9PiAoeyBbJ0B4c2k6dHlwZSddOiB0eXBlLCAuLi5tZCB9KTtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkobWV0YWRhdGEpID8gbWV0YWRhdGEubWFwKGNvbnZlcnQpIDogY29udmVydChtZXRhZGF0YSk7XG59XG5cbi8qKlxuICogQ2xhc3MgZm9yIFNhbGVzZm9yY2UgTWV0YWRhdGEgQVBJXG4gKi9cbmV4cG9ydCBjbGFzcyBNZXRhZGF0YUFwaTxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIF9jb25uOiBDb25uZWN0aW9uPFM+O1xuXG4gIC8qKlxuICAgKiBQb2xsaW5nIGludGVydmFsIGluIG1pbGxpc2Vjb25kc1xuICAgKi9cbiAgcG9sbEludGVydmFsOiBudW1iZXIgPSAxMDAwO1xuXG4gIC8qKlxuICAgKiBQb2xsaW5nIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzXG4gICAqL1xuICBwb2xsVGltZW91dDogbnVtYmVyID0gMTAwMDA7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+KSB7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBNZXRhZGF0YSBBUEkgU09BUCBlbmRwb2ludFxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX2ludm9rZShcbiAgICBtZXRob2Q6IHN0cmluZyxcbiAgICBtZXNzYWdlOiBvYmplY3QsXG4gICAgc2NoZW1hPzogU29hcFNjaGVtYSB8IFNvYXBTY2hlbWFEZWYsXG4gICkge1xuICAgIGNvbnN0IHNvYXBFbmRwb2ludCA9IG5ldyBTT0FQKHRoaXMuX2Nvbm4sIHtcbiAgICAgIHhtbG5zOiAnaHR0cDovL3NvYXAuc2ZvcmNlLmNvbS8yMDA2LzA0L21ldGFkYXRhJyxcbiAgICAgIGVuZHBvaW50VXJsOiBgJHt0aGlzLl9jb25uLmluc3RhbmNlVXJsfS9zZXJ2aWNlcy9Tb2FwL20vJHt0aGlzLl9jb25uLnZlcnNpb259YCxcbiAgICB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBzb2FwRW5kcG9pbnQuaW52b2tlKFxuICAgICAgbWV0aG9kLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIHNjaGVtYSA/ICh7IHJlc3VsdDogc2NoZW1hIH0gYXMgU29hcFNjaGVtYSkgOiB1bmRlZmluZWQsXG4gICAgICBBcGlTY2hlbWFzLFxuICAgICk7XG4gICAgcmV0dXJuIHJlcy5yZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIG9uZSBvciBtb3JlIG5ldyBtZXRhZGF0YSBjb21wb25lbnRzIHRvIHRoZSBvcmdhbml6YXRpb24uXG4gICAqL1xuICBjcmVhdGU8XG4gICAgTSBleHRlbmRzIE1ldGFkYXRhID0gTWV0YWRhdGEsXG4gICAgVCBleHRlbmRzIE1ldGFkYXRhVHlwZSA9IE1ldGFkYXRhVHlwZSxcbiAgICBNRCBleHRlbmRzIElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+ID0gSW5wdXRNZXRhZGF0YURlZmluaXRpb248VCwgTT5cbiAgPih0eXBlOiBULCBtZXRhZGF0YTogTURbXSk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgY3JlYXRlPFxuICAgIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhLFxuICAgIFQgZXh0ZW5kcyBNZXRhZGF0YVR5cGUgPSBNZXRhZGF0YVR5cGUsXG4gICAgTUQgZXh0ZW5kcyBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4odHlwZTogVCwgbWV0YWRhdGE6IE1EKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgY3JlYXRlPFxuICAgIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhLFxuICAgIFQgZXh0ZW5kcyBNZXRhZGF0YVR5cGUgPSBNZXRhZGF0YVR5cGUsXG4gICAgTUQgZXh0ZW5kcyBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4odHlwZTogVCwgbWV0YWRhdGE6IE1EIHwgTURbXSk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT47XG4gIGNyZWF0ZSh0eXBlOiBzdHJpbmcsIG1ldGFkYXRhOiBNZXRhZGF0YSB8IE1ldGFkYXRhW10pIHtcbiAgICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShtZXRhZGF0YSk7XG4gICAgbWV0YWRhdGEgPSBhc3NpZ25UeXBlV2l0aE1ldGFkYXRhKG1ldGFkYXRhLCB0eXBlKTtcbiAgICBjb25zdCBzY2hlbWEgPSBpc0FycmF5ID8gW0FwaVNjaGVtYXMuU2F2ZVJlc3VsdF0gOiBBcGlTY2hlbWFzLlNhdmVSZXN1bHQ7XG4gICAgcmV0dXJuIHRoaXMuX2ludm9rZSgnY3JlYXRlTWV0YWRhdGEnLCB7IG1ldGFkYXRhIH0sIHNjaGVtYSk7XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBzcGVjaWZpZWQgbWV0YWRhdGEgY29tcG9uZW50cyBpbiB0aGUgb3JnYW5pemF0aW9uLlxuICAgKi9cbiAgcmVhZDxcbiAgICBNIGV4dGVuZHMgTWV0YWRhdGEgPSBNZXRhZGF0YSxcbiAgICBUIGV4dGVuZHMgTWV0YWRhdGFUeXBlID0gTWV0YWRhdGFUeXBlLFxuICAgIE1EIGV4dGVuZHMgTWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+ID0gTWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4odHlwZTogVCwgZnVsbE5hbWVzOiBzdHJpbmdbXSk6IFByb21pc2U8TURbXT47XG4gIHJlYWQ8XG4gICAgTSBleHRlbmRzIE1ldGFkYXRhID0gTWV0YWRhdGEsXG4gICAgVCBleHRlbmRzIE1ldGFkYXRhVHlwZSA9IE1ldGFkYXRhVHlwZSxcbiAgICBNRCBleHRlbmRzIE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPlxuICA+KHR5cGU6IFQsIGZ1bGxOYW1lczogc3RyaW5nKTogUHJvbWlzZTxNRD47XG4gIHJlYWQ8XG4gICAgTSBleHRlbmRzIE1ldGFkYXRhID0gTWV0YWRhdGEsXG4gICAgVCBleHRlbmRzIE1ldGFkYXRhVHlwZSA9IE1ldGFkYXRhVHlwZSxcbiAgICBNRCBleHRlbmRzIE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPlxuICA+KHR5cGU6IFQsIGZ1bGxOYW1lczogc3RyaW5nIHwgc3RyaW5nW10pOiBQcm9taXNlPE1EIHwgTURbXT47XG4gIGFzeW5jIHJlYWQodHlwZTogc3RyaW5nLCBmdWxsTmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgUmVhZFJlc3VsdFNjaGVtYSA9XG4gICAgICB0eXBlIGluIEFwaVNjaGVtYXNcbiAgICAgICAgPyAoe1xuICAgICAgICAgICAgdHlwZTogQXBpU2NoZW1hcy5SZWFkUmVzdWx0LnR5cGUsXG4gICAgICAgICAgICBwcm9wczoge1xuICAgICAgICAgICAgICByZWNvcmRzOiBbdHlwZV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0gYXMgY29uc3QpXG4gICAgICAgIDogQXBpU2NoZW1hcy5SZWFkUmVzdWx0O1xuICAgIGNvbnN0IHJlczogUmVhZFJlc3VsdCA9IGF3YWl0IHRoaXMuX2ludm9rZShcbiAgICAgICdyZWFkTWV0YWRhdGEnLFxuICAgICAgeyB0eXBlLCBmdWxsTmFtZXMgfSxcbiAgICAgIFJlYWRSZXN1bHRTY2hlbWEsXG4gICAgKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShmdWxsTmFtZXMpXG4gICAgICA/IHJlcy5yZWNvcmRzLm1hcChkZWFsbG9jYXRlVHlwZVdpdGhNZXRhZGF0YSlcbiAgICAgIDogZGVhbGxvY2F0ZVR5cGVXaXRoTWV0YWRhdGEocmVzLnJlY29yZHNbMF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBvbmUgb3IgbW9yZSBtZXRhZGF0YSBjb21wb25lbnRzIGluIHRoZSBvcmdhbml6YXRpb24uXG4gICAqL1xuICB1cGRhdGU8XG4gICAgTSBleHRlbmRzIE1ldGFkYXRhID0gTWV0YWRhdGEsXG4gICAgVCBleHRlbmRzIHN0cmluZyA9IHN0cmluZyxcbiAgICBNRCBleHRlbmRzIElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+ID0gSW5wdXRNZXRhZGF0YURlZmluaXRpb248VCwgTT5cbiAgPih0eXBlOiBULCBtZXRhZGF0YTogUGFydGlhbDxNRD5bXSk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgdXBkYXRlPFxuICAgIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhLFxuICAgIFQgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmcsXG4gICAgTUQgZXh0ZW5kcyBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4odHlwZTogVCwgbWV0YWRhdGE6IFBhcnRpYWw8TUQ+KTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgdXBkYXRlPFxuICAgIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhLFxuICAgIFQgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmcsXG4gICAgTUQgZXh0ZW5kcyBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4oXG4gICAgdHlwZTogVCxcbiAgICBtZXRhZGF0YTogUGFydGlhbDxNRD4gfCBQYXJ0aWFsPE1EPltdLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICB1cGRhdGUodHlwZTogc3RyaW5nLCBtZXRhZGF0YTogTWV0YWRhdGEgfCBNZXRhZGF0YVtdKSB7XG4gICAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkobWV0YWRhdGEpO1xuICAgIG1ldGFkYXRhID0gYXNzaWduVHlwZVdpdGhNZXRhZGF0YShtZXRhZGF0YSwgdHlwZSk7XG4gICAgY29uc3Qgc2NoZW1hID0gaXNBcnJheSA/IFtBcGlTY2hlbWFzLlNhdmVSZXN1bHRdIDogQXBpU2NoZW1hcy5TYXZlUmVzdWx0O1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ3VwZGF0ZU1ldGFkYXRhJywgeyBtZXRhZGF0YSB9LCBzY2hlbWEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwc2VydCBvbmUgb3IgbW9yZSBjb21wb25lbnRzIGluIHlvdXIgb3JnYW5pemF0aW9uJ3MgZGF0YS5cbiAgICovXG4gIHVwc2VydDxcbiAgICBNIGV4dGVuZHMgTWV0YWRhdGEgPSBNZXRhZGF0YSxcbiAgICBUIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nLFxuICAgIE1EIGV4dGVuZHMgSW5wdXRNZXRhZGF0YURlZmluaXRpb248VCwgTT4gPSBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPlxuICA+KHR5cGU6IFQsIG1ldGFkYXRhOiBNRFtdKTogUHJvbWlzZTxVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydDxcbiAgICBNIGV4dGVuZHMgTWV0YWRhdGEgPSBNZXRhZGF0YSxcbiAgICBUIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nLFxuICAgIE1EIGV4dGVuZHMgSW5wdXRNZXRhZGF0YURlZmluaXRpb248VCwgTT4gPSBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPlxuICA+KHR5cGU6IFQsIG1ldGFkYXRhOiBNRCk6IFByb21pc2U8VXBzZXJ0UmVzdWx0PjtcbiAgdXBzZXJ0PFxuICAgIE0gZXh0ZW5kcyBNZXRhZGF0YSA9IE1ldGFkYXRhLFxuICAgIFQgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmcsXG4gICAgTUQgZXh0ZW5kcyBJbnB1dE1ldGFkYXRhRGVmaW5pdGlvbjxULCBNPiA9IElucHV0TWV0YWRhdGFEZWZpbml0aW9uPFQsIE0+XG4gID4odHlwZTogVCwgbWV0YWRhdGE6IE1EIHwgTURbXSk6IFByb21pc2U8VXBzZXJ0UmVzdWx0IHwgVXBzZXJ0UmVzdWx0W10+O1xuICB1cHNlcnQodHlwZTogc3RyaW5nLCBtZXRhZGF0YTogTWV0YWRhdGEgfCBNZXRhZGF0YVtdKSB7XG4gICAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkobWV0YWRhdGEpO1xuICAgIG1ldGFkYXRhID0gYXNzaWduVHlwZVdpdGhNZXRhZGF0YShtZXRhZGF0YSwgdHlwZSk7XG4gICAgY29uc3Qgc2NoZW1hID0gaXNBcnJheVxuICAgICAgPyBbQXBpU2NoZW1hcy5VcHNlcnRSZXN1bHRdXG4gICAgICA6IEFwaVNjaGVtYXMuVXBzZXJ0UmVzdWx0O1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ3Vwc2VydE1ldGFkYXRhJywgeyBtZXRhZGF0YSB9LCBzY2hlbWEpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgc3BlY2lmaWVkIG1ldGFkYXRhIGNvbXBvbmVudHMgaW4gdGhlIG9yZ2FuaXphdGlvbi5cbiAgICovXG4gIGRlbGV0ZSh0eXBlOiBzdHJpbmcsIGZ1bGxOYW1lczogc3RyaW5nW10pOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIGRlbGV0ZSh0eXBlOiBzdHJpbmcsIGZ1bGxOYW1lczogc3RyaW5nKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgZGVsZXRlKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBmdWxsTmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICBkZWxldGUodHlwZTogc3RyaW5nLCBmdWxsTmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gQXJyYXkuaXNBcnJheShmdWxsTmFtZXMpXG4gICAgICA/IFtBcGlTY2hlbWFzLlNhdmVSZXN1bHRdXG4gICAgICA6IEFwaVNjaGVtYXMuU2F2ZVJlc3VsdDtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKCdkZWxldGVNZXRhZGF0YScsIHsgdHlwZSwgZnVsbE5hbWVzIH0sIHNjaGVtYSk7XG4gIH1cblxuICAvKipcbiAgICogUmVuYW1lIGZ1bGxuYW1lIG9mIGEgbWV0YWRhdGEgY29tcG9uZW50IGluIHRoZSBvcmdhbml6YXRpb25cbiAgICovXG4gIHJlbmFtZShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgb2xkRnVsbE5hbWU6IHN0cmluZyxcbiAgICBuZXdGdWxsTmFtZTogc3RyaW5nLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKFxuICAgICAgJ3JlbmFtZU1ldGFkYXRhJyxcbiAgICAgIHsgdHlwZSwgb2xkRnVsbE5hbWUsIG5ld0Z1bGxOYW1lIH0sXG4gICAgICBBcGlTY2hlbWFzLlNhdmVSZXN1bHQsXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIG1ldGFkYXRhIHdoaWNoIGRlc2NyaWJlcyB5b3VyIG9yZ2FuaXphdGlvbiwgaW5jbHVkaW5nIEFwZXggY2xhc3NlcyBhbmQgdHJpZ2dlcnMsXG4gICAqIGN1c3RvbSBvYmplY3RzLCBjdXN0b20gZmllbGRzIG9uIHN0YW5kYXJkIG9iamVjdHMsIHRhYiBzZXRzIHRoYXQgZGVmaW5lIGFuIGFwcCxcbiAgICogYW5kIG1hbnkgb3RoZXIgY29tcG9uZW50cy5cbiAgICovXG4gIGRlc2NyaWJlKGFzT2ZWZXJzaW9uPzogc3RyaW5nKTogUHJvbWlzZTxEZXNjcmliZU1ldGFkYXRhUmVzdWx0PiB7XG4gICAgaWYgKCFhc09mVmVyc2lvbikge1xuICAgICAgYXNPZlZlcnNpb24gPSB0aGlzLl9jb25uLnZlcnNpb247XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9pbnZva2UoXG4gICAgICAnZGVzY3JpYmVNZXRhZGF0YScsXG4gICAgICB7IGFzT2ZWZXJzaW9uIH0sXG4gICAgICBBcGlTY2hlbWFzLkRlc2NyaWJlTWV0YWRhdGFSZXN1bHQsXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgcHJvcGVydHkgaW5mb3JtYXRpb24gYWJvdXQgbWV0YWRhdGEgY29tcG9uZW50cyBpbiB5b3VyIG9yZ2FuaXphdGlvblxuICAgKi9cbiAgbGlzdChcbiAgICBxdWVyaWVzOiBMaXN0TWV0YWRhdGFRdWVyeSB8IExpc3RNZXRhZGF0YVF1ZXJ5W10sXG4gICAgYXNPZlZlcnNpb24/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8RmlsZVByb3BlcnRpZXNbXT4ge1xuICAgIGlmICghYXNPZlZlcnNpb24pIHtcbiAgICAgIGFzT2ZWZXJzaW9uID0gdGhpcy5fY29ubi52ZXJzaW9uO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5faW52b2tlKCdsaXN0TWV0YWRhdGEnLCB7IHF1ZXJpZXMsIGFzT2ZWZXJzaW9uIH0sIFtcbiAgICAgIEFwaVNjaGVtYXMuRmlsZVByb3BlcnRpZXMsXG4gICAgXSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHRoZSBzdGF0dXMgb2YgYXN5bmNocm9ub3VzIG1ldGFkYXRhIGNhbGxzXG4gICAqL1xuICBjaGVja1N0YXR1cyhhc3luY1Byb2Nlc3NJZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzID0gdGhpcy5faW52b2tlKFxuICAgICAgJ2NoZWNrU3RhdHVzJyxcbiAgICAgIHsgYXN5bmNQcm9jZXNzSWQgfSxcbiAgICAgIEFwaVNjaGVtYXMuQXN5bmNSZXN1bHQsXG4gICAgKTtcbiAgICByZXR1cm4gbmV3IEFzeW5jUmVzdWx0TG9jYXRvcih0aGlzLCByZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBYTUwgZmlsZSByZXByZXNlbnRhdGlvbnMgb2YgY29tcG9uZW50cyBpbiBhbiBvcmdhbml6YXRpb25cbiAgICovXG4gIHJldHJpZXZlKHJlcXVlc3Q6IFBhcnRpYWw8UmV0cmlldmVSZXF1ZXN0Pikge1xuICAgIGNvbnN0IHJlcyA9IHRoaXMuX2ludm9rZShcbiAgICAgICdyZXRyaWV2ZScsXG4gICAgICB7IHJlcXVlc3QgfSxcbiAgICAgIEFwaVNjaGVtYXMuUmV0cmlldmVSZXN1bHQsXG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFJldHJpZXZlUmVzdWx0TG9jYXRvcih0aGlzLCByZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyB0aGUgc3RhdHVzIG9mIGRlY2xhcmF0aXZlIG1ldGFkYXRhIGNhbGwgcmV0cmlldmUoKSBhbmQgcmV0dXJucyB0aGUgemlwIGZpbGUgY29udGVudHNcbiAgICovXG4gIGNoZWNrUmV0cmlldmVTdGF0dXMoYXN5bmNQcm9jZXNzSWQ6IHN0cmluZyk6IFByb21pc2U8UmV0cmlldmVSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKFxuICAgICAgJ2NoZWNrUmV0cmlldmVTdGF0dXMnLFxuICAgICAgeyBhc3luY1Byb2Nlc3NJZCB9LFxuICAgICAgQXBpU2NoZW1hcy5SZXRyaWV2ZVJlc3VsdCxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFdpbGwgZGVwbG95IGEgcmVjZW50bHkgdmFsaWRhdGVkIGRlcGxveSByZXF1ZXN0XG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zLmlkID0gdGhlIGRlcGxveSBJRCB0aGF0J3MgYmVlbiB2YWxpZGF0ZWQgYWxyZWFkeSBmcm9tIGEgcHJldmlvdXMgY2hlY2tPbmx5IGRlcGxveSByZXF1ZXN0XG4gICAqIEBwYXJhbSBvcHRpb25zLnJlc3QgPSBhIGJvb2xlYW4gd2hldGhlciBvciBub3QgdG8gdXNlIHRoZSBSRVNUIEFQSVxuICAgKiBAcmV0dXJucyB0aGUgZGVwbG95IElEIG9mIHRoZSByZWNlbnQgdmFsaWRhdGlvbiByZXF1ZXN0XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZGVwbG95UmVjZW50VmFsaWRhdGlvbihvcHRpb25zOiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICByZXN0PzogYm9vbGVhbjtcbiAgfSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgeyBpZCwgcmVzdCB9ID0gb3B0aW9ucztcbiAgICBsZXQgcmVzcG9uc2U6IHN0cmluZztcbiAgICBpZiAocmVzdCkge1xuICAgICAgY29uc3QgbWVzc2FnZUJvZHkgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHZhbGlkYXRlZERlcGxveVJlcXVlc3RJZDogaWQsXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcmVxdWVzdEluZm86IEh0dHBSZXF1ZXN0ID0ge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgdXJsOiBgJHt0aGlzLl9jb25uLl9iYXNlVXJsKCl9L21ldGFkYXRhL2RlcGxveVJlcXVlc3RgLFxuICAgICAgICBib2R5OiBtZXNzYWdlQm9keSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgY29uc3QgcmVxdWVzdE9wdGlvbnMgPSB7IGhlYWRlcnM6ICdqc29uJyB9O1xuICAgICAgLy8gVGhpcyBpcyB0aGUgZGVwbG95IElEIG9mIHRoZSBkZXBsb3lSZWNlbnRWYWxpZGF0aW9uIHJlc3BvbnNlLCBub3RcbiAgICAgIC8vIHRoZSBhbHJlYWR5IHZhbGlkYXRlZCBkZXBsb3kgSUQgKGkuZS4sIHZhbGlkYXRlZGRlcGxveXJlcXVlc3RpZCkuXG4gICAgICAvLyBSRVNUIHJldHVybnMgYW4gb2JqZWN0IHdpdGggYW4gaWQgcHJvcGVydHksIFNPQVAgcmV0dXJucyB0aGUgaWQgYXMgYSBzdHJpbmcgZGlyZWN0bHkuXG4gICAgICByZXNwb25zZSA9IChcbiAgICAgICAgYXdhaXQgdGhpcy5fY29ubi5yZXF1ZXN0PHsgaWQ6IHN0cmluZyB9PihyZXF1ZXN0SW5mbywgcmVxdWVzdE9wdGlvbnMpXG4gICAgICApLmlkO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZSA9IGF3YWl0IHRoaXMuX2ludm9rZSgnZGVwbG95UmVjZW50VmFsaWRhdGlvbicsIHtcbiAgICAgICAgdmFsaWRhdGlvbklkOiBpZCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXBsb3kgY29tcG9uZW50cyBpbnRvIGFuIG9yZ2FuaXphdGlvbiB1c2luZyB6aXBwZWQgZmlsZSByZXByZXNlbnRhdGlvbnNcbiAgICogdXNpbmcgdGhlIFJFU1QgTWV0YWRhdGEgQVBJIGluc3RlYWQgb2YgU09BUFxuICAgKi9cbiAgZGVwbG95UmVzdChcbiAgICB6aXBJbnB1dDogQnVmZmVyLFxuICAgIG9wdGlvbnM6IFBhcnRpYWw8RGVwbG95T3B0aW9ucz4gPSB7fSxcbiAgKTogRGVwbG95UmVzdWx0TG9jYXRvcjxTPiB7XG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm0uYXBwZW5kKCdmaWxlJywgemlwSW5wdXQsIHtcbiAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vemlwJyxcbiAgICAgIGZpbGVuYW1lOiAncGFja2FnZS54bWwnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRoZSBkZXBsb3kgb3B0aW9uc1xuICAgIGZvcm0uYXBwZW5kKCdlbnRpdHlfY29udGVudCcsIEpTT04uc3RyaW5naWZ5KHsgZGVwbG95T3B0aW9uczogb3B0aW9ucyB9KSwge1xuICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlcXVlc3Q6IEh0dHBSZXF1ZXN0ID0ge1xuICAgICAgdXJsOiAnL21ldGFkYXRhL2RlcGxveVJlcXVlc3QnLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7IC4uLmZvcm0uZ2V0SGVhZGVycygpIH0sXG4gICAgICBib2R5OiBmb3JtLmdldEJ1ZmZlcigpLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gdGhpcy5fY29ubi5yZXF1ZXN0PEFzeW5jUmVzdWx0PihyZXF1ZXN0KTtcblxuICAgIHJldHVybiBuZXcgRGVwbG95UmVzdWx0TG9jYXRvcih0aGlzLCByZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlcGxveSBjb21wb25lbnRzIGludG8gYW4gb3JnYW5pemF0aW9uIHVzaW5nIHppcHBlZCBmaWxlIHJlcHJlc2VudGF0aW9uc1xuICAgKi9cbiAgZGVwbG95KFxuICAgIHppcElucHV0OiBSZWFkYWJsZSB8IEJ1ZmZlciB8IHN0cmluZyxcbiAgICBvcHRpb25zOiBQYXJ0aWFsPERlcGxveU9wdGlvbnM+ID0ge30sXG4gICk6IERlcGxveVJlc3VsdExvY2F0b3I8Uz4ge1xuICAgIGNvbnN0IHJlcyA9IChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB6aXBDb250ZW50QjY0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgaXNPYmplY3QoemlwSW5wdXQpICYmXG4gICAgICAgICAgJ3BpcGUnIGluIHppcElucHV0ICYmXG4gICAgICAgICAgdHlwZW9mIHppcElucHV0LnBpcGUgPT09ICdmdW5jdGlvbidcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgYnVmczogQnVmZmVyW10gPSBbXTtcbiAgICAgICAgICB6aXBJbnB1dC5vbignZGF0YScsIChkKSA9PiBidWZzLnB1c2goZCkpO1xuICAgICAgICAgIHppcElucHV0Lm9uKCdlcnJvcicsIHJlamVjdCk7XG4gICAgICAgICAgemlwSW5wdXQub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoQnVmZmVyLmNvbmNhdChidWZzKS50b1N0cmluZygnYmFzZTY0JykpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIHppcElucHV0LnJlc3VtZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHppcElucHV0IGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgICAgcmVzb2x2ZSh6aXBJbnB1dC50b1N0cmluZygnYmFzZTY0JykpO1xuICAgICAgICB9IGVsc2UgaWYgKHppcElucHV0IGluc3RhbmNlb2YgU3RyaW5nIHx8IHR5cGVvZiB6aXBJbnB1dCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXNvbHZlKHppcElucHV0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyAnVW5leHBlY3RlZCB6aXBJbnB1dCB0eXBlJztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB0aGlzLl9pbnZva2UoXG4gICAgICAgICdkZXBsb3knLFxuICAgICAgICB7XG4gICAgICAgICAgWmlwRmlsZTogemlwQ29udGVudEI2NCxcbiAgICAgICAgICBEZXBsb3lPcHRpb25zOiBvcHRpb25zLFxuICAgICAgICB9LFxuICAgICAgICBBcGlTY2hlbWFzLkRlcGxveVJlc3VsdCxcbiAgICAgICk7XG4gICAgfSkoKTtcblxuICAgIHJldHVybiBuZXcgRGVwbG95UmVzdWx0TG9jYXRvcih0aGlzLCByZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyB0aGUgc3RhdHVzIG9mIGRlY2xhcmF0aXZlIG1ldGFkYXRhIGNhbGwgZGVwbG95KClcbiAgICovXG4gIGNoZWNrRGVwbG95U3RhdHVzKFxuICAgIGFzeW5jUHJvY2Vzc0lkOiBzdHJpbmcsXG4gICAgaW5jbHVkZURldGFpbHM6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKTogUHJvbWlzZTxEZXBsb3lSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKFxuICAgICAgJ2NoZWNrRGVwbG95U3RhdHVzJyxcbiAgICAgIHtcbiAgICAgICAgYXN5bmNQcm9jZXNzSWQsXG4gICAgICAgIGluY2x1ZGVEZXRhaWxzLFxuICAgICAgfSxcbiAgICAgIEFwaVNjaGVtYXMuRGVwbG95UmVzdWx0LFxuICAgICk7XG4gIH1cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qKlxuICogVGhlIGxvY2F0b3IgY2xhc3MgZm9yIE1ldGFkYXRhIEFQSSBhc3luY2hyb25vdXMgY2FsbCByZXN1bHRcbiAqL1xuZXhwb3J0IGNsYXNzIEFzeW5jUmVzdWx0TG9jYXRvcjxcbiAgUyBleHRlbmRzIFNjaGVtYSxcbiAgUiBleHRlbmRzIHt9ID0gQXN5bmNSZXN1bHRcbj4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBfbWV0YTogTWV0YWRhdGFBcGk8Uz47XG4gIF9wcm9taXNlOiBQcm9taXNlPEFzeW5jUmVzdWx0PjtcbiAgX2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihtZXRhOiBNZXRhZGF0YUFwaTxTPiwgcHJvbWlzZTogUHJvbWlzZTxBc3luY1Jlc3VsdD4pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX21ldGEgPSBtZXRhO1xuICAgIHRoaXMuX3Byb21pc2UgPSBwcm9taXNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb21pc2UvQSsgaW50ZXJmYWNlXG4gICAqIGh0dHA6Ly9wcm9taXNlcy1hcGx1cy5naXRodWIuaW8vcHJvbWlzZXMtc3BlYy9cbiAgICpcbiAgICogQG1ldGhvZCBNZXRhZGF0YX5Bc3luY1Jlc3VsdExvY2F0b3IjdGhlblxuICAgKi9cbiAgdGhlbjxVLCBWPihcbiAgICBvblJlc29sdmU/OiAoKHJlc3VsdDogQXN5bmNSZXN1bHQpID0+IFUgfCBQcm9taXNlPFU+KSB8IG51bGwgfCB1bmRlZmluZWQsXG4gICAgb25SZWplY3Q/OiAoKGVycjogRXJyb3IpID0+IFYgfCBQcm9taXNlPFY+KSB8IG51bGwgfCB1bmRlZmluZWQsXG4gICk6IFByb21pc2U8VSB8IFY+IHtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZS50aGVuKG9uUmVzb2x2ZSwgb25SZWplY3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBzdGF0dXMgb2YgYXN5bmMgcmVxdWVzdFxuICAgKi9cbiAgYXN5bmMgY2hlY2soKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJvbWlzZTtcbiAgICB0aGlzLl9pZCA9IHJlc3VsdC5pZDtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5fbWV0YS5jaGVja1N0YXR1cyhyZXN1bHQuaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBvbGxpbmcgdW50aWwgYXN5bmMgY2FsbCBzdGF0dXMgYmVjb21lcyBjb21wbGV0ZSBvciBlcnJvclxuICAgKi9cbiAgcG9sbChpbnRlcnZhbDogbnVtYmVyLCB0aW1lb3V0OiBudW1iZXIpIHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICBjb25zdCBwb2xsID0gYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGlmIChzdGFydFRpbWUgKyB0aW1lb3V0IDwgbm93KSB7XG4gICAgICAgICAgbGV0IGVyck1zZyA9ICdQb2xsaW5nIHRpbWUgb3V0Lic7XG4gICAgICAgICAgaWYgKHRoaXMuX2lkKSB7XG4gICAgICAgICAgICBlcnJNc2cgKz0gJyBQcm9jZXNzIElkID0gJyArIHRoaXMuX2lkO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKGVyck1zZykpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNoZWNrKCk7XG4gICAgICAgIGlmIChyZXN1bHQuZG9uZSkge1xuICAgICAgICAgIHRoaXMuZW1pdCgnY29tcGxldGUnLCByZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZW1pdCgncHJvZ3Jlc3MnLCByZXN1bHQpO1xuICAgICAgICAgIHNldFRpbWVvdXQocG9sbCwgaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9XG4gICAgfTtcbiAgICBzZXRUaW1lb3V0KHBvbGwsIGludGVydmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBhbmQgd2FpdCB1bnRpbCB0aGUgYXN5bmMgcmVxdWVzdHMgYmVjb21lIGluIGNvbXBsZXRlZCBzdGF0dXNcbiAgICovXG4gIGNvbXBsZXRlKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxSPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLm9uKCdjb21wbGV0ZScsIHJlc29sdmUpO1xuICAgICAgdGhpcy5vbignZXJyb3InLCByZWplY3QpO1xuICAgICAgdGhpcy5wb2xsKHRoaXMuX21ldGEucG9sbEludGVydmFsLCB0aGlzLl9tZXRhLnBvbGxUaW1lb3V0KTtcbiAgICB9KTtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogVGhlIGxvY2F0b3IgY2xhc3MgdG8gdHJhY2sgcmV0cmVpdmUoKSBNZXRhZGF0YSBBUEkgY2FsbCByZXN1bHRcbiAqL1xuZXhwb3J0IGNsYXNzIFJldHJpZXZlUmVzdWx0TG9jYXRvcjxTIGV4dGVuZHMgU2NoZW1hPiBleHRlbmRzIEFzeW5jUmVzdWx0TG9jYXRvcjxcbiAgUyxcbiAgUmV0cmlldmVSZXN1bHRcbj4ge1xuICAvKipcbiAgICogQ2hlY2sgYW5kIHdhaXQgdW50aWwgdGhlIGFzeW5jIHJlcXVlc3QgYmVjb21lcyBpbiBjb21wbGV0ZWQgc3RhdHVzLFxuICAgKiBhbmQgcmV0cmlldmUgdGhlIHJlc3VsdCBkYXRhLlxuICAgKi9cbiAgYXN5bmMgY29tcGxldGUoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3VwZXIuY29tcGxldGUoKTtcbiAgICByZXR1cm4gdGhpcy5fbWV0YS5jaGVja1JldHJpZXZlU3RhdHVzKHJlc3VsdC5pZCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIHRoZSByZXRyaWV2ZWQgcmVzdWx0IHRvIE5vZGUuanMgcmVhZGFibGUgc3RyZWFtXG4gICAqL1xuICBzdHJlYW0oKSB7XG4gICAgY29uc3QgcmVzdWx0U3RyZWFtID0gbmV3IFJlYWRhYmxlKCk7XG4gICAgbGV0IHJlYWRpbmcgPSBmYWxzZTtcbiAgICByZXN1bHRTdHJlYW0uX3JlYWQgPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAocmVhZGluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZWFkaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29tcGxldGUoKTtcbiAgICAgICAgcmVzdWx0U3RyZWFtLnB1c2goQnVmZmVyLmZyb20ocmVzdWx0LnppcEZpbGUsICdiYXNlNjQnKSk7XG4gICAgICAgIHJlc3VsdFN0cmVhbS5wdXNoKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXN1bHRTdHJlYW0uZW1pdCgnZXJyb3InLCBlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiByZXN1bHRTdHJlYW07XG4gIH1cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIFRoZSBsb2NhdG9yIGNsYXNzIHRvIHRyYWNrIGRlcGxveSgpIE1ldGFkYXRhIEFQSSBjYWxsIHJlc3VsdFxuICpcbiAqIEBwcm90ZWN0ZWRcbiAqIEBjbGFzcyBNZXRhZGF0YX5EZXBsb3lSZXN1bHRMb2NhdG9yXG4gKiBAZXh0ZW5kcyBNZXRhZGF0YX5Bc3luY1Jlc3VsdExvY2F0b3JcbiAqIEBwYXJhbSB7TWV0YWRhdGF9IG1ldGEgLSBNZXRhZGF0YSBBUEkgb2JqZWN0XG4gKiBAcGFyYW0ge1Byb21pc2UuPE1ldGFkYXRhfkFzeW5jUmVzdWx0Pn0gcmVzdWx0IC0gUHJvbWlzZSBvYmplY3QgZm9yIGFzeW5jIHJlc3VsdCBvZiBkZXBsb3koKSBjYWxsXG4gKi9cbmV4cG9ydCBjbGFzcyBEZXBsb3lSZXN1bHRMb2NhdG9yPFMgZXh0ZW5kcyBTY2hlbWE+IGV4dGVuZHMgQXN5bmNSZXN1bHRMb2NhdG9yPFxuICBTLFxuICBEZXBsb3lSZXN1bHRcbj4ge1xuICAvKipcbiAgICogQ2hlY2sgYW5kIHdhaXQgdW50aWwgdGhlIGFzeW5jIHJlcXVlc3QgYmVjb21lcyBpbiBjb21wbGV0ZWQgc3RhdHVzLFxuICAgKiBhbmQgcmV0cmlldmUgdGhlIHJlc3VsdCBkYXRhLlxuICAgKi9cbiAgYXN5bmMgY29tcGxldGUoaW5jbHVkZURldGFpbHM/OiBib29sZWFuKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3VwZXIuY29tcGxldGUoKTtcbiAgICByZXR1cm4gdGhpcy5fbWV0YS5jaGVja0RlcGxveVN0YXR1cyhyZXN1bHQuaWQsIGluY2x1ZGVEZXRhaWxzKTtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qXG4gKiBSZWdpc3RlciBob29rIGluIGNvbm5lY3Rpb24gaW5zdGFudGlhdGlvbiBmb3IgZHluYW1pY2FsbHkgYWRkaW5nIHRoaXMgQVBJIG1vZHVsZSBmZWF0dXJlc1xuICovXG5yZWdpc3Rlck1vZHVsZSgnbWV0YWRhdGEnLCAoY29ubikgPT4gbmV3IE1ldGFkYXRhQXBpKGNvbm4pKTtcblxuZXhwb3J0IGRlZmF1bHQgTWV0YWRhdGFBcGk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdBQUFELE9BQUE7QUFDQSxJQUFBRSxTQUFBLEdBQUFDLHNCQUFBLENBQUFILE9BQUE7QUFDQSxJQUFBSSxRQUFBLEdBQUFKLE9BQUE7QUFFQSxJQUFBSyxLQUFBLEdBQUFGLHNCQUFBLENBQUFILE9BQUE7QUFDQSxJQUFBTSxTQUFBLEdBQUFOLE9BQUE7QUFFQSxJQUFBTyxPQUFBLEdBQUFQLE9BQUE7QUFnQkFRLHdCQUFBLENBQUFDLFNBQUEsR0FBQUMsWUFBQSxDQUFBSCxPQUFBLEdBQUFJLElBQUEsQ0FBQUYsU0FBQSxZQUFBRyxHQUFBO0VBQUEsSUFBQUEsR0FBQSxrQkFBQUEsR0FBQTtFQUFBLElBQUFDLE1BQUEsQ0FBQUMsU0FBQSxDQUFBQyxjQUFBLENBQUFKLElBQUEsQ0FBQUssWUFBQSxFQUFBSixHQUFBO0VBQUEsSUFBQUEsR0FBQSxJQUFBSyxPQUFBLElBQUFBLE9BQUEsQ0FBQUwsR0FBQSxNQUFBTCxPQUFBLENBQUFLLEdBQUE7RUFBQU0sc0JBQUEsQ0FBQUQsT0FBQSxFQUFBTCxHQUFBO0lBQUFPLFVBQUE7SUFBQUMsR0FBQSxXQUFBQSxDQUFBO01BQUEsT0FBQWIsT0FBQSxDQUFBSyxHQUFBO0lBQUE7RUFBQTtBQUFBO0FBQWtDLFNBQUFTLFFBQUFDLE1BQUEsRUFBQUMsY0FBQSxRQUFBQyxJQUFBLEdBQUFkLFlBQUEsQ0FBQVksTUFBQSxPQUFBRyw2QkFBQSxRQUFBQyxPQUFBLEdBQUFELDZCQUFBLENBQUFILE1BQUEsT0FBQUMsY0FBQSxFQUFBRyxPQUFBLEdBQUFDLHVCQUFBLENBQUFELE9BQUEsRUFBQWYsSUFBQSxDQUFBZSxP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