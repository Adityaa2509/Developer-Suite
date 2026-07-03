"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Apex = void 0;
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _jsforce = require("../jsforce");
/**
 * @file Manages Salesforce Apex REST endpoint calls
 * @author Shinichi Tomita <shinichi.tomita@gmail.com>
 */

/**
 * API class for Apex REST endpoint call
 */
class Apex {
  /**
   *
   */
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "del", this.delete);
    this._conn = conn;
  }

  /* @private */
  _baseUrl() {
    return `${this._conn.instanceUrl}/services/apexrest`;
  }

  /**
   * @private
   */
  _createRequestParams(method, path, body, options = {}) {
    const headers = typeof options.headers === 'object' ? options.headers : {};
    if (!/^(GET|DELETE)$/i.test(method)) {
      headers['content-type'] = 'application/json';
    }
    const params = {
      method,
      url: this._baseUrl() + path,
      headers
    };
    if (body) {
      params.body = (0, _stringify.default)(body);
    }
    return params;
  }

  /**
   * Call Apex REST service in GET request
   */
  get(path, options) {
    return this._conn.request(this._createRequestParams('GET', path, undefined, options));
  }

  /**
   * Call Apex REST service in POST request
   */
  post(path, body, options) {
    const params = this._createRequestParams('POST', path, body, options);
    return this._conn.request(params);
  }

  /**
   * Call Apex REST service in PUT request
   */
  put(path, body, options) {
    const params = this._createRequestParams('PUT', path, body, options);
    return this._conn.request(params);
  }

  /**
   * Call Apex REST service in PATCH request
   */
  patch(path, body, options) {
    const params = this._createRequestParams('PATCH', path, body, options);
    return this._conn.request(params);
  }

  /**
   * Call Apex REST service in DELETE request
   */
  delete(path, options) {
    return this._conn.request(this._createRequestParams('DELETE', path, undefined, options));
  }

  /**
   * Synonym of Apex#delete()
   */
}

/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
exports.Apex = Apex;
(0, _jsforce.registerModule)('apex', conn => new Apex(conn));
var _default = Apex;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfanNmb3JjZSIsInJlcXVpcmUiLCJBcGV4IiwiY29uc3RydWN0b3IiLCJjb25uIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJkZWxldGUiLCJfY29ubiIsIl9iYXNlVXJsIiwiaW5zdGFuY2VVcmwiLCJfY3JlYXRlUmVxdWVzdFBhcmFtcyIsIm1ldGhvZCIsInBhdGgiLCJib2R5Iiwib3B0aW9ucyIsImhlYWRlcnMiLCJ0ZXN0IiwicGFyYW1zIiwidXJsIiwiX3N0cmluZ2lmeSIsImdldCIsInJlcXVlc3QiLCJ1bmRlZmluZWQiLCJwb3N0IiwicHV0IiwicGF0Y2giLCJleHBvcnRzIiwicmVnaXN0ZXJNb2R1bGUiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvYXBleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIE1hbmFnZXMgU2FsZXNmb3JjZSBBcGV4IFJFU1QgZW5kcG9pbnQgY2FsbHNcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyByZWdpc3Rlck1vZHVsZSB9IGZyb20gJy4uL2pzZm9yY2UnO1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi4vY29ubmVjdGlvbic7XG5pbXBvcnQgeyBIdHRwUmVxdWVzdCwgSHR0cE1ldGhvZHMsIFNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcblxuLyoqXG4gKiBBUEkgY2xhc3MgZm9yIEFwZXggUkVTVCBlbmRwb2ludCBjYWxsXG4gKi9cbmV4cG9ydCBjbGFzcyBBcGV4PFMgZXh0ZW5kcyBTY2hlbWE+IHtcbiAgX2Nvbm46IENvbm5lY3Rpb248Uz47XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+KSB7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gIH1cblxuICAvKiBAcHJpdmF0ZSAqL1xuICBfYmFzZVVybCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5fY29ubi5pbnN0YW5jZVVybH0vc2VydmljZXMvYXBleHJlc3RgO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY3JlYXRlUmVxdWVzdFBhcmFtcyhcbiAgICBtZXRob2Q6IEh0dHBNZXRob2RzLFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBib2R5PzogT2JqZWN0LFxuICAgIG9wdGlvbnM6IHsgaGVhZGVycz86IEh0dHBSZXF1ZXN0WydoZWFkZXJzJ10gfSA9IHt9LFxuICApOiBIdHRwUmVxdWVzdCB7XG4gICAgY29uc3QgaGVhZGVyczogSHR0cFJlcXVlc3RbJ2hlYWRlcnMnXSA9XG4gICAgICB0eXBlb2Ygb3B0aW9ucy5oZWFkZXJzID09PSAnb2JqZWN0JyA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuICAgIGlmICghL14oR0VUfERFTEVURSkkL2kudGVzdChtZXRob2QpKSB7XG4gICAgICBoZWFkZXJzWydjb250ZW50LXR5cGUnXSA9ICdhcHBsaWNhdGlvbi9qc29uJztcbiAgICB9XG4gICAgY29uc3QgcGFyYW1zOiBIdHRwUmVxdWVzdCA9IHtcbiAgICAgIG1ldGhvZCxcbiAgICAgIHVybDogdGhpcy5fYmFzZVVybCgpICsgcGF0aCxcbiAgICAgIGhlYWRlcnMsXG4gICAgfTtcbiAgICBpZiAoYm9keSkge1xuICAgICAgcGFyYW1zLmJvZHkgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsIEFwZXggUkVTVCBzZXJ2aWNlIGluIEdFVCByZXF1ZXN0XG4gICAqL1xuICBnZXQ8UiA9IHVua25vd24+KHBhdGg6IHN0cmluZywgb3B0aW9ucz86IE9iamVjdCkge1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8Uj4oXG4gICAgICB0aGlzLl9jcmVhdGVSZXF1ZXN0UGFyYW1zKCdHRVQnLCBwYXRoLCB1bmRlZmluZWQsIG9wdGlvbnMpLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBBcGV4IFJFU1Qgc2VydmljZSBpbiBQT1NUIHJlcXVlc3RcbiAgICovXG4gIHBvc3Q8UiA9IHVua25vd24+KHBhdGg6IHN0cmluZywgYm9keT86IE9iamVjdCwgb3B0aW9ucz86IE9iamVjdCkge1xuICAgIGNvbnN0IHBhcmFtcyA9IHRoaXMuX2NyZWF0ZVJlcXVlc3RQYXJhbXMoJ1BPU1QnLCBwYXRoLCBib2R5LCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFI+KHBhcmFtcyk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBBcGV4IFJFU1Qgc2VydmljZSBpbiBQVVQgcmVxdWVzdFxuICAgKi9cbiAgcHV0PFIgPSB1bmtub3duPihwYXRoOiBzdHJpbmcsIGJvZHk/OiBPYmplY3QsIG9wdGlvbnM/OiBPYmplY3QpIHtcbiAgICBjb25zdCBwYXJhbXMgPSB0aGlzLl9jcmVhdGVSZXF1ZXN0UGFyYW1zKCdQVVQnLCBwYXRoLCBib2R5LCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFI+KHBhcmFtcyk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBBcGV4IFJFU1Qgc2VydmljZSBpbiBQQVRDSCByZXF1ZXN0XG4gICAqL1xuICBwYXRjaDxSID0gdW5rbm93bj4ocGF0aDogc3RyaW5nLCBib2R5PzogT2JqZWN0LCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcGFyYW1zID0gdGhpcy5fY3JlYXRlUmVxdWVzdFBhcmFtcygnUEFUQ0gnLCBwYXRoLCBib2R5LCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFI+KHBhcmFtcyk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBBcGV4IFJFU1Qgc2VydmljZSBpbiBERUxFVEUgcmVxdWVzdFxuICAgKi9cbiAgZGVsZXRlPFIgPSB1bmtub3duPihwYXRoOiBzdHJpbmcsIG9wdGlvbnM/OiBPYmplY3QpIHtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFI+KFxuICAgICAgdGhpcy5fY3JlYXRlUmVxdWVzdFBhcmFtcygnREVMRVRFJywgcGF0aCwgdW5kZWZpbmVkLCBvcHRpb25zKSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgQXBleCNkZWxldGUoKVxuICAgKi9cbiAgZGVsID0gdGhpcy5kZWxldGU7XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLypcbiAqIFJlZ2lzdGVyIGhvb2sgaW4gY29ubmVjdGlvbiBpbnN0YW50aWF0aW9uIGZvciBkeW5hbWljYWxseSBhZGRpbmcgdGhpcyBBUEkgbW9kdWxlIGZlYXR1cmVzXG4gKi9cbnJlZ2lzdGVyTW9kdWxlKCdhcGV4JywgKGNvbm4pID0+IG5ldyBBcGV4KGNvbm4pKTtcblxuZXhwb3J0IGRlZmF1bHQgQXBleDtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUlBLElBQUFBLFFBQUEsR0FBQUMsT0FBQTtBQUpBO0FBQ0E7QUFDQTtBQUNBOztBQUtBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLElBQUksQ0FBbUI7RUFHbEM7QUFDRjtBQUNBO0VBQ0VDLFdBQVdBLENBQUNDLElBQW1CLEVBQUU7SUFBQSxJQUFBQyxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQSxlQStFM0IsSUFBSSxDQUFDQyxNQUFNO0lBOUVmLElBQUksQ0FBQ0MsS0FBSyxHQUFHSixJQUFJO0VBQ25COztFQUVBO0VBQ0FLLFFBQVFBLENBQUEsRUFBRztJQUNULE9BQVEsR0FBRSxJQUFJLENBQUNELEtBQUssQ0FBQ0UsV0FBWSxvQkFBbUI7RUFDdEQ7O0VBRUE7QUFDRjtBQUNBO0VBQ0VDLG9CQUFvQkEsQ0FDbEJDLE1BQW1CLEVBQ25CQyxJQUFZLEVBQ1pDLElBQWEsRUFDYkMsT0FBNkMsR0FBRyxDQUFDLENBQUMsRUFDckM7SUFDYixNQUFNQyxPQUErQixHQUNuQyxPQUFPRCxPQUFP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