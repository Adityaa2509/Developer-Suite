"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty2 = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys2 = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Chatter = exports.Resource = void 0;
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _forEach = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/for-each"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _jsforce = require("../jsforce");
var _function = require("../util/function");
function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context3; _forEachInstanceProperty2(_context3 = ownKeys(Object(source), true)).call(_context3, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context4; _forEachInstanceProperty2(_context4 = ownKeys(Object(source))).call(_context4, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       * @file Manages Salesforce Chatter REST API calls
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       */
/**
 *
 */

/*--------------------------------------------*/
/**
 * A class representing chatter API request
 */
class Request {
  constructor(chatter, request) {
    (0, _defineProperty2.default)(this, "_chatter", void 0);
    (0, _defineProperty2.default)(this, "_request", void 0);
    (0, _defineProperty2.default)(this, "_promise", void 0);
    this._chatter = chatter;
    this._request = request;
  }

  /**
   * Retrieve parameters in batch request form
   */
  batchParams() {
    const {
      method,
      url,
      body
    } = this._request;
    return _objectSpread({
      method,
      url: this._chatter._normalizeUrl(url)
    }, typeof body !== 'undefined' ? {
      richInput: body
    } : {});
  }

  /**
   * Retrieve parameters in batch request form
   *
   * @method Chatter~Request#promise
   * @returns {Promise.<Chatter~RequestResult>}
   */
  promise() {
    return this._promise || (this._promise = this._chatter._request(this._request));
  }

  /**
   * Returns Node.js Stream object for request
   *
   * @method Chatter~Request#stream
   * @returns {stream.Stream}
   */
  stream() {
    return this._chatter._request(this._request).stream();
  }

  /**
   * Promise/A+ interface
   * http://promises-aplus.github.io/promises-spec/
   *
   * Delegate to deferred promise, return promise instance for batch result
   */
  then(onResolve, onReject) {
    return this.promise().then(onResolve, onReject);
  }
}
function apppendQueryParamsToUrl(url, queryParams) {
  if (queryParams) {
    var _context;
    const qstring = (0, _map.default)(_context = (0, _keys.default)(queryParams)).call(_context, name => {
      var _queryParams$name;
      return `${name}=${encodeURIComponent(String((_queryParams$name = queryParams[name]) !== null && _queryParams$name !== void 0 ? _queryParams$name : ''))}`;
    }).join('&');
    url += ((0, _indexOf.default)(url).call(url, '?') > 0 ? '&' : '?') + qstring;
  }
  return url;
}

/*------------------------------*/
class Resource extends Request {
  /**
   *
   */
  constructor(chatter, url, queryParams) {
    super(chatter, {
      method: 'GET',
      url: apppendQueryParamsToUrl(url, queryParams)
    });
    (0, _defineProperty2.default)(this, "_url", void 0);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    this._url = this._request.url;
  }

  /**
   * Create a new resource
   */
  create(data) {
    return this._chatter.request({
      method: 'POST',
      url: this._url,
      body: data
    });
  }

  /**
   * Retrieve resource content
   */
  retrieve() {
    return this._chatter.request({
      method: 'GET',
      url: this._url
    });
  }

  /**
   * Update specified resource
   */
  update(data) {
    return this._chatter.request({
      method: 'POST',
      url: this._url,
      body: data
    });
  }

  /**
   * Delete specified resource
   */
  destroy() {
    return this._chatter.request({
      method: 'DELETE',
      url: this._url
    });
  }

  /**
   * Synonym of Resource#destroy()
   */

  /**
   * Synonym of Resource#destroy()
   */
}

/*------------------------------*/
/**
 * API class for Chatter REST API call
 */
exports.Resource = Resource;
class Chatter {
  /**
   *
   */
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    this._conn = conn;
  }

  /**
   * Sending request to API endpoint
   * @private
   */
  _request(req_) {
    const {
      method,
      url: url_,
      headers: headers_,
      body: body_
    } = req_;
    let headers = headers_ !== null && headers_ !== void 0 ? headers_ : {};
    let body;
    if (/^(put|post|patch)$/i.test(method)) {
      if ((0, _function.isObject)(body_)) {
        headers = _objectSpread(_objectSpread({}, headers_), {}, {
          'Content-Type': 'application/json'
        });
        body = (0, _stringify.default)(body_);
      } else {
        body = body_;
      }
    }
    const url = this._normalizeUrl(url_);
    return this._conn.request({
      method,
      url,
      headers,
      body
    });
  }

  /**
   * Convert path to site root relative url
   * @private
   */
  _normalizeUrl(url) {
    if ((0, _indexOf.default)(url).call(url, '/chatter/') === 0 || (0, _indexOf.default)(url).call(url, '/connect/') === 0) {
      return '/services/data/v' + this._conn.version + url;
    } else if (/^\/v[\d]+\.[\d]+\//.test(url)) {
      return '/services/data' + url;
    } else if ((0, _indexOf.default)(url).call(url, '/services/') !== 0 && url[0] === '/') {
      return '/services/data/v' + this._conn.version + '/chatter' + url;
    } else {
      return url;
    }
  }

  /**
   * Make a request for chatter API resource
   */
  request(req) {
    return new Request(this, req);
  }

  /**
   * Make a resource request to chatter API
   */
  resource(url, queryParams) {
    return new Resource(this, url, queryParams);
  }

  /**
   * Make a batch request to chatter API
   */
  async batch(requests) {
    var _context2;
    const deferreds = (0, _map.default)(requests).call(requests, request => {
      const deferred = defer();
      request._promise = deferred.promise;
      return deferred;
    });
    const res = await this.request({
      method: 'POST',
      url: this._normalizeUrl('/connect/batch'),
      body: {
        batchRequests: (0, _map.default)(requests).call(requests, request => request.batchParams())
      }
    });
    (0, _forEach.default)(_context2 = res.results).call(_context2, (result, i) => {
      const deferred = deferreds[i];
      if (result.statusCode >= 400) {
        deferred.reject(result.result);
      } else {
        deferred.resolve(result.result);
      }
    });
    return res;
  }
}
exports.Chatter = Chatter;
function defer() {
  let resolve_ = () => {};
  let reject_ = () => {};
  const promise = new _promise.default((resolve, reject) => {
    resolve_ = resolve;
    reject_ = reject;
  });
  return {
    promise,
    resolve: resolve_,
    reject: reject_
  };
}

/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
(0, _jsforce.registerModule)('chatter', conn => new Chatter(conn));
var _default = Chatter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfanNmb3JjZSIsInJlcXVpcmUiLCJfZnVuY3Rpb24iLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRrZXlzMiIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsIl9maWx0ZXJJbnN0YW5jZVByb3BlcnR5IiwiY2FsbCIsInN5bSIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiX2NvbnRleHQzIiwiX2ZvckVhY2hJbnN0YW5jZVByb3BlcnR5MiIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQ0IiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsIlJlcXVlc3QiLCJjb25zdHJ1Y3RvciIsImNoYXR0ZXIiLCJyZXF1ZXN0IiwiX2NoYXR0ZXIiLCJfcmVxdWVzdCIsImJhdGNoUGFyYW1zIiwibWV0aG9kIiwidXJsIiwiYm9keSIsIl9ub3JtYWxpemVVcmwiLCJyaWNoSW5wdXQiLCJwcm9taXNlIiwiX3Byb21pc2UiLCJzdHJlYW0iLCJ0aGVuIiwib25SZXNvbHZlIiwib25SZWplY3QiLCJhcHBwZW5kUXVlcnlQYXJhbXNUb1VybCIsInF1ZXJ5UGFyYW1zIiwiX2NvbnRleHQiLCJxc3RyaW5nIiwiX21hcCIsIl9rZXlzIiwibmFtZSIsIl9xdWVyeVBhcmFtcyRuYW1lIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiU3RyaW5nIiwiam9pbiIsIl9pbmRleE9mIiwiUmVzb3VyY2UiLCJkZXN0cm95IiwiX3VybCIsImNyZWF0ZSIsImRhdGEiLCJyZXRyaWV2ZSIsInVwZGF0ZSIsImV4cG9ydHMiLCJDaGF0dGVyIiwiY29ubiIsIl9jb25uIiwicmVxXyIsInVybF8iLCJoZWFkZXJzIiwiaGVhZGVyc18iLCJib2R5XyIsInRlc3QiLCJpc09iamVjdCIsIl9zdHJpbmdpZnkiLCJ2ZXJzaW9uIiwicmVxIiwicmVzb3VyY2UiLCJiYXRjaCIsInJlcXVlc3RzIiwiX2NvbnRleHQyIiwiZGVmZXJyZWRzIiwiZGVmZXJyZWQiLCJkZWZlciIsInJlcyIsImJhdGNoUmVxdWVzdHMiLCJfZm9yRWFjaCIsInJlc3VsdHMiLCJyZXN1bHQiLCJzdGF0dXNDb2RlIiwicmVqZWN0IiwicmVzb2x2ZSIsInJlc29sdmVfIiwicmVqZWN0XyIsInJlZ2lzdGVyTW9kdWxlIiwiX2RlZmF1bHQiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvYXBpL2NoYXR0ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZSBNYW5hZ2VzIFNhbGVzZm9yY2UgQ2hhdHRlciBSRVNUIEFQSSBjYWxsc1xuICogQGF1dGhvciBTaGluaWNoaSBUb21pdGEgPHNoaW5pY2hpLnRvbWl0YUBnbWFpbC5jb20+XG4gKi9cbmltcG9ydCB7IHJlZ2lzdGVyTW9kdWxlIH0gZnJvbSAnLi4vanNmb3JjZSc7XG5pbXBvcnQgQ29ubmVjdGlvbiBmcm9tICcuLi9jb25uZWN0aW9uJztcbmltcG9ydCB7IEh0dHBSZXF1ZXN0LCBTY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBpc09iamVjdCB9IGZyb20gJy4uL3V0aWwvZnVuY3Rpb24nO1xuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCB0eXBlIENoYXR0ZXJSZXF1ZXN0UGFyYW1zID0gT21pdDxIdHRwUmVxdWVzdCwgJ2JvZHknPiAmIHtcbiAgYm9keT86IHN0cmluZyB8IG9iamVjdCB8IG51bGw7XG59O1xuXG5leHBvcnQgdHlwZSBCYXRjaFJlcXVlc3RQYXJhbXMgPSB7XG4gIG1ldGhvZDogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgcmljaElucHV0PzogYW55O1xufTtcblxudHlwZSBCYXRjaFJlcXVlc3RUdXBwbGU8UyBleHRlbmRzIFNjaGVtYSwgUlQgZXh0ZW5kcyBhbnlbXT4gPSB7XG4gIFtLIGluIGtleW9mIFJUXTogUmVxdWVzdDxTLCBSVFtLXT47XG59O1xuXG50eXBlIEJhdGNoUmVzdWx0VHVwcGxlPFJUIGV4dGVuZHMgYW55W10+ID0ge1xuICBbSyBpbiBrZXlvZiBSVF06IHtcbiAgICBzdGF0dXNDb2RlOiBudW1iZXI7XG4gICAgcmVzdWx0OiBSVFtLXTtcbiAgfTtcbn07XG5cbmV4cG9ydCB0eXBlIEJhdGNoUmVzcG9uc2U8UlQgZXh0ZW5kcyBhbnlbXT4gPSB7XG4gIGhhc0Vycm9yczogYm9vbGVhbjtcbiAgcmVzdWx0czogQmF0Y2hSZXN1bHRUdXBwbGU8UlQ+O1xufTtcblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50aW5nIGNoYXR0ZXIgQVBJIHJlcXVlc3RcbiAqL1xuY2xhc3MgUmVxdWVzdDxTIGV4dGVuZHMgU2NoZW1hLCBSPiB7XG4gIF9jaGF0dGVyOiBDaGF0dGVyPFM+O1xuICBfcmVxdWVzdDogQ2hhdHRlclJlcXVlc3RQYXJhbXM7XG4gIF9wcm9taXNlOiBQcm9taXNlPFI+IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKGNoYXR0ZXI6IENoYXR0ZXI8Uz4sIHJlcXVlc3Q6IENoYXR0ZXJSZXF1ZXN0UGFyYW1zKSB7XG4gICAgdGhpcy5fY2hhdHRlciA9IGNoYXR0ZXI7XG4gICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3Q7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgcGFyYW1ldGVycyBpbiBiYXRjaCByZXF1ZXN0IGZvcm1cbiAgICovXG4gIGJhdGNoUGFyYW1zKCkge1xuICAgIGNvbnN0IHsgbWV0aG9kLCB1cmwsIGJvZHkgfSA9IHRoaXMuX3JlcXVlc3Q7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1ldGhvZCxcbiAgICAgIHVybDogdGhpcy5fY2hhdHRlci5fbm9ybWFsaXplVXJsKHVybCksXG4gICAgICAuLi4odHlwZW9mIGJvZHkgIT09ICd1bmRlZmluZWQnID8geyByaWNoSW5wdXQ6IGJvZHkgfSA6IHt9KSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHBhcmFtZXRlcnMgaW4gYmF0Y2ggcmVxdWVzdCBmb3JtXG4gICAqXG4gICAqIEBtZXRob2QgQ2hhdHRlcn5SZXF1ZXN0I3Byb21pc2VcbiAgICogQHJldHVybnMge1Byb21pc2UuPENoYXR0ZXJ+UmVxdWVzdFJlc3VsdD59XG4gICAqL1xuICBwcm9taXNlKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9wcm9taXNlIHx8ICh0aGlzLl9wcm9taXNlID0gdGhpcy5fY2hhdHRlci5fcmVxdWVzdCh0aGlzLl9yZXF1ZXN0KSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgTm9kZS5qcyBTdHJlYW0gb2JqZWN0IGZvciByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgQ2hhdHRlcn5SZXF1ZXN0I3N0cmVhbVxuICAgKiBAcmV0dXJucyB7c3RyZWFtLlN0cmVhbX1cbiAgICovXG4gIHN0cmVhbSgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhdHRlci5fcmVxdWVzdDxSPih0aGlzLl9yZXF1ZXN0KS5zdHJlYW0oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9taXNlL0ErIGludGVyZmFjZVxuICAgKiBodHRwOi8vcHJvbWlzZXMtYXBsdXMuZ2l0aHViLmlvL3Byb21pc2VzLXNwZWMvXG4gICAqXG4gICAqIERlbGVnYXRlIHRvIGRlZmVycmVkIHByb21pc2UsIHJldHVybiBwcm9taXNlIGluc3RhbmNlIGZvciBiYXRjaCByZXN1bHRcbiAgICovXG4gIHRoZW48VT4oXG4gICAgb25SZXNvbHZlPzogKHZhbHVlOiBSKSA9PiBVIHwgUHJvbWlzZUxpa2U8VT4sXG4gICAgb25SZWplY3Q/OiAoZTogYW55KSA9PiBVIHwgUHJvbWlzZUxpa2U8VT4sXG4gICkge1xuICAgIHJldHVybiB0aGlzLnByb21pc2UoKS50aGVuKG9uUmVzb2x2ZSwgb25SZWplY3QpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFwcHBlbmRRdWVyeVBhcmFtc1RvVXJsKFxuICB1cmw6IHN0cmluZyxcbiAgcXVlcnlQYXJhbXM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHwgbnVsbCB9IHwgbnVsbCxcbikge1xuICBpZiAocXVlcnlQYXJhbXMpIHtcbiAgICBjb25zdCBxc3RyaW5nID0gT2JqZWN0LmtleXMocXVlcnlQYXJhbXMpXG4gICAgICAubWFwKFxuICAgICAgICAobmFtZSkgPT5cbiAgICAgICAgICBgJHtuYW1lfT0ke2VuY29kZVVSSUNvbXBvbmVudChTdHJpbmcocXVlcnlQYXJhbXNbbmFtZV0gPz8gJycpKX1gLFxuICAgICAgKVxuICAgICAgLmpvaW4oJyYnKTtcbiAgICB1cmwgKz0gKHVybC5pbmRleE9mKCc/JykgPiAwID8gJyYnIDogJz8nKSArIHFzdHJpbmc7XG4gIH1cbiAgcmV0dXJuIHVybDtcbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuZXhwb3J0IGNsYXNzIFJlc291cmNlPFMgZXh0ZW5kcyBTY2hlbWEsIFI+IGV4dGVuZHMgUmVxdWVzdDxTLCBSPiB7XG4gIF91cmw6IHN0cmluZztcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNoYXR0ZXI6IENoYXR0ZXI8Uz4sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgcXVlcnlQYXJhbXM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHwgbnVsbCB9IHwgbnVsbCxcbiAgKSB7XG4gICAgc3VwZXIoY2hhdHRlciwge1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHVybDogYXBwcGVuZFF1ZXJ5UGFyYW1zVG9VcmwodXJsLCBxdWVyeVBhcmFtcyksXG4gICAgfSk7XG4gICAgdGhpcy5fdXJsID0gdGhpcy5fcmVxdWVzdC51cmw7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHJlc291cmNlXG4gICAqL1xuICBjcmVhdGU8UjEgPSBhbnk+KGRhdGE6IHN0cmluZyB8IG9iamVjdCB8IG51bGwpIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhdHRlci5yZXF1ZXN0PFIxPih7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHVybDogdGhpcy5fdXJsLFxuICAgICAgYm9keTogZGF0YSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSByZXNvdXJjZSBjb250ZW50XG4gICAqL1xuICByZXRyaWV2ZTxSMSA9IFI+KCkge1xuICAgIHJldHVybiB0aGlzLl9jaGF0dGVyLnJlcXVlc3Q8UjE+KHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICB1cmw6IHRoaXMuX3VybCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgc3BlY2lmaWVkIHJlc291cmNlXG4gICAqL1xuICB1cGRhdGU8UjEgPSBhbnk+KGRhdGE6IG9iamVjdCkge1xuICAgIHJldHVybiB0aGlzLl9jaGF0dGVyLnJlcXVlc3Q8UjE+KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsOiB0aGlzLl91cmwsXG4gICAgICBib2R5OiBkYXRhLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBzcGVjaWZpZWQgcmVzb3VyY2VcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NoYXR0ZXIucmVxdWVzdDx2b2lkPih7XG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgdXJsOiB0aGlzLl91cmwsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBSZXNvdXJjZSNkZXN0cm95KClcbiAgICovXG4gIGRlbGV0ZSA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogU3lub255bSBvZiBSZXNvdXJjZSNkZXN0cm95KClcbiAgICovXG4gIGRlbCA9IHRoaXMuZGVzdHJveTtcbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKiBBUEkgY2xhc3MgZm9yIENoYXR0ZXIgUkVTVCBBUEkgY2FsbFxuICovXG5leHBvcnQgY2xhc3MgQ2hhdHRlcjxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIF9jb25uOiBDb25uZWN0aW9uPFM+O1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoY29ubjogQ29ubmVjdGlvbjxTPikge1xuICAgIHRoaXMuX2Nvbm4gPSBjb25uO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmRpbmcgcmVxdWVzdCB0byBBUEkgZW5kcG9pbnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXF1ZXN0PFI+KHJlcV86IENoYXR0ZXJSZXF1ZXN0UGFyYW1zKSB7XG4gICAgY29uc3QgeyBtZXRob2QsIHVybDogdXJsXywgaGVhZGVyczogaGVhZGVyc18sIGJvZHk6IGJvZHlfIH0gPSByZXFfO1xuICAgIGxldCBoZWFkZXJzID0gaGVhZGVyc18gPz8ge307XG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKC9eKHB1dHxwb3N0fHBhdGNoKSQvaS50ZXN0KG1ldGhvZCkpIHtcbiAgICAgIGlmIChpc09iamVjdChib2R5XykpIHtcbiAgICAgICAgaGVhZGVycyA9IHtcbiAgICAgICAgICAuLi5oZWFkZXJzXyxcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9O1xuICAgICAgICBib2R5ID0gSlNPTi5zdHJpbmdpZnkoYm9keV8pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYm9keSA9IGJvZHlfO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB1cmwgPSB0aGlzLl9ub3JtYWxpemVVcmwodXJsXyk7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxSPih7XG4gICAgICBtZXRob2QsXG4gICAgICB1cmwsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IHBhdGggdG8gc2l0ZSByb290IHJlbGF0aXZlIHVybFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX25vcm1hbGl6ZVVybCh1cmw6IHN0cmluZykge1xuICAgIGlmICh1cmwuaW5kZXhPZignL2NoYXR0ZXIvJykgPT09IDAgfHwgdXJsLmluZGV4T2YoJy9jb25uZWN0LycpID09PSAwKSB7XG4gICAgICByZXR1cm4gJy9zZXJ2aWNlcy9kYXRhL3YnICsgdGhpcy5fY29ubi52ZXJzaW9uICsgdXJsO1xuICAgIH0gZWxzZSBpZiAoL15cXC92W1xcZF0rXFwuW1xcZF0rXFwvLy50ZXN0KHVybCkpIHtcbiAgICAgIHJldHVybiAnL3NlcnZpY2VzL2RhdGEnICsgdXJsO1xuICAgIH0gZWxzZSBpZiAodXJsLmluZGV4T2YoJy9zZXJ2aWNlcy8nKSAhPT0gMCAmJiB1cmxbMF0gPT09ICcvJykge1xuICAgICAgcmV0dXJuICcvc2VydmljZXMvZGF0YS92JyArIHRoaXMuX2Nvbm4udmVyc2lvbiArICcvY2hhdHRlcicgKyB1cmw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1cmw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgYSByZXF1ZXN0IGZvciBjaGF0dGVyIEFQSSByZXNvdXJjZVxuICAgKi9cbiAgcmVxdWVzdDxSID0gdW5rbm93bj4ocmVxOiBDaGF0dGVyUmVxdWVzdFBhcmFtcykge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdDxTLCBSPih0aGlzLCByZXEpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgYSByZXNvdXJjZSByZXF1ZXN0IHRvIGNoYXR0ZXIgQVBJXG4gICAqL1xuICByZXNvdXJjZTxSID0gdW5rbm93bj4oXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgcXVlcnlQYXJhbXM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHwgbnVsbCB9IHwgbnVsbCxcbiAgKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNvdXJjZTxTLCBSPih0aGlzLCB1cmwsIHF1ZXJ5UGFyYW1zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlIGEgYmF0Y2ggcmVxdWVzdCB0byBjaGF0dGVyIEFQSVxuICAgKi9cbiAgYXN5bmMgYmF0Y2g8UlQgZXh0ZW5kcyBhbnlbXT4oXG4gICAgcmVxdWVzdHM6IEJhdGNoUmVxdWVzdFR1cHBsZTxTLCBSVD4sXG4gICk6IFByb21pc2U8QmF0Y2hSZXNwb25zZTxSVD4+IHtcbiAgICBjb25zdCBkZWZlcnJlZHMgPSByZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgIGNvbnN0IGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICAgIHJlcXVlc3QuX3Byb21pc2UgPSBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgcmV0dXJuIGRlZmVycmVkO1xuICAgIH0pO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMucmVxdWVzdDxCYXRjaFJlc3BvbnNlPFJUPj4oe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmw6IHRoaXMuX25vcm1hbGl6ZVVybCgnL2Nvbm5lY3QvYmF0Y2gnKSxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgYmF0Y2hSZXF1ZXN0czogcmVxdWVzdHMubWFwKChyZXF1ZXN0KSA9PiByZXF1ZXN0LmJhdGNoUGFyYW1zKCkpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICByZXMucmVzdWx0cy5mb3JFYWNoKChyZXN1bHQsIGkpID0+IHtcbiAgICAgIGNvbnN0IGRlZmVycmVkID0gZGVmZXJyZWRzW2ldO1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QocmVzdWx0LnJlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdC5yZXN1bHQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmZXI8VD4oKSB7XG4gIGxldCByZXNvbHZlXzogKHI6IFQgfCBQcm9taXNlTGlrZTxUPikgPT4gdm9pZCA9ICgpID0+IHt9O1xuICBsZXQgcmVqZWN0XzogKGU6IGFueSkgPT4gdm9pZCA9ICgpID0+IHt9O1xuICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHJlc29sdmVfID0gcmVzb2x2ZTtcbiAgICByZWplY3RfID0gcmVqZWN0O1xuICB9KTtcbiAgcmV0dXJuIHtcbiAgICBwcm9taXNlLFxuICAgIHJlc29sdmU6IHJlc29sdmVfLFxuICAgIHJlamVjdDogcmVqZWN0XyxcbiAgfTtcbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKlxuICogUmVnaXN0ZXIgaG9vayBpbiBjb25uZWN0aW9uIGluc3RhbnRpYXRpb24gZm9yIGR5bmFtaWNhbGx5IGFkZGluZyB0aGlzIEFQSSBtb2R1bGUgZmVhdHVyZXNcbiAqL1xucmVnaXN0ZXJNb2R1bGUoJ2NoYXR0ZXInLCAoY29ubikgPT4gbmV3IENoYXR0ZXIoY29ubikpO1xuXG5leHBvcnQgZGVmYXVsdCBDaGF0dGVyO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlBLElBQUFBLFFBQUEsR0FBQUMsT0FBQTtBQUdBLElBQUFDLFNBQUEsR0FBQUQsT0FBQTtBQUE0QyxTQUFBRSxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFBQSxHQUFBQyxhQUFBLENBQUFILE1BQUEsT0FBQUksNkJBQUEsUUFBQUMsT0FBQSxHQUFBRCw2QkFBQSxDQUFBSixNQUFBLE9BQUFDLGNBQUEsRUFBQUksT0FBQSxHQUFBQyx1QkFBQSxDQUFBRCxPQUFBLEVBQUFFLElBQUEsQ0FBQUYsT0FBQSxZQUFBRyxHQUFBLFdBQUFDLGdDQUFBLENBQUFU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