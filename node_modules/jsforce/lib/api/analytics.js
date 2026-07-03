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
exports.default = exports.Analytics = exports.Dashboard = exports.Report = exports.ReportInstance = void 0;
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _jsforce = require("../jsforce");
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context; _forEachInstanceProperty(_context = ownKeys(Object(source), true)).call(_context, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source))).call(_context2, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * @file Manages Salesforce Analytics API
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  */
/*----------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------*/
/**
 * Report object class in Analytics API
 */
class ReportInstance {
  /**
   *
   */
  constructor(report, id) {
    (0, _defineProperty2.default)(this, "_report", void 0);
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    this._report = report;
    this._conn = report._conn;
    this.id = id;
  }

  /**
   * Retrieve report result asynchronously executed
   */
  retrieve() {
    const url = [this._conn._baseUrl(), 'analytics', 'reports', this._report.id, 'instances', this.id].join('/');
    return this._conn.request(url);
  }
}

/*----------------------------------------------------------------------------------*/
/**
 * Report object class in Analytics API
 */
exports.ReportInstance = ReportInstance;
class Report {
  /**
   *
   */
  constructor(conn, id) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    (0, _defineProperty2.default)(this, "run", this.execute);
    (0, _defineProperty2.default)(this, "exec", this.execute);
    this._conn = conn;
    this.id = id;
  }

  /**
   * Describe report metadata
   */
  describe() {
    var url = [this._conn._baseUrl(), 'analytics', 'reports', this.id, 'describe'].join('/');
    return this._conn.request(url);
  }

  /**
   * Destroy a report
   */
  destroy() {
    const url = [this._conn._baseUrl(), 'analytics', 'reports', this.id].join('/');
    return this._conn.request({
      method: 'DELETE',
      url
    });
  }

  /**
   * Synonym of Analytics~Report#destroy()
   */

  /**
   * Synonym of Analytics~Report#destroy()
   */

  /**
   * Clones a given report
   */
  clone(name) {
    const url = [this._conn._baseUrl(), 'analytics', 'reports'].join('/') + '?cloneId=' + this.id;
    const config = {
      reportMetadata: {
        name
      }
    };
    return this._conn.request({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      body: (0, _stringify.default)(config)
    });
  }

  /**
   * Explain plan for executing report
   */
  explain() {
    const url = '/query/?explain=' + this.id;
    return this._conn.request(url);
  }

  /**
   * Run report synchronously
   */
  execute(options = {}) {
    const url = [this._conn._baseUrl(), 'analytics', 'reports', this.id].join('/') + '?includeDetails=' + (options.details ? 'true' : 'false');
    return this._conn.request(_objectSpread({
      url
    }, options.metadata ? {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: (0, _stringify.default)(options.metadata)
    } : {
      method: 'GET'
    }));
  }

  /**
   * Synonym of Analytics~Report#execute()
   */

  /**
   * Synonym of Analytics~Report#execute()
   */

  /**
   * Run report asynchronously
   */
  executeAsync(options = {}) {
    const url = [this._conn._baseUrl(), 'analytics', 'reports', this.id, 'instances'].join('/') + (options.details ? '?includeDetails=true' : '');
    return this._conn.request(_objectSpread({
      method: 'POST',
      url
    }, options.metadata ? {
      headers: {
        'Content-Type': 'application/json'
      },
      body: (0, _stringify.default)(options.metadata)
    } : {
      body: ''
    }));
  }

  /**
   * Get report instance for specified instance ID
   */
  instance(id) {
    return new ReportInstance(this, id);
  }

  /**
   * List report instances which had been executed asynchronously
   */
  instances() {
    const url = [this._conn._baseUrl(), 'analytics', 'reports', this.id, 'instances'].join('/');
    return this._conn.request(url);
  }
}

/*----------------------------------------------------------------------------------*/
/**
 * Dashboard object class in the Analytics API
 */
exports.Report = Report;
class Dashboard {
  /**
   *
   */
  constructor(conn, id) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    this._conn = conn;
    this.id = id;
  }

  /**
   * Describe dashboard metadata
   *
   * @method Analytics~Dashboard#describe
   * @param {Callback.<Analytics-DashboardMetadata>} [callback] - Callback function
   * @returns {Promise.<Analytics-DashboardMetadata>}
   */
  describe() {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards', this.id, 'describe'].join('/');
    return this._conn.request(url);
  }

  /**
   * Get details about dashboard components
   */
  components(componentIds) {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards', this.id].join('/');
    const config = {
      componentIds: (0, _isArray.default)(componentIds) ? componentIds : typeof componentIds === 'string' ? [componentIds] : undefined
    };
    return this._conn.request({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      body: (0, _stringify.default)(config)
    });
  }

  /**
   * Get dashboard status
   */
  status() {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards', this.id, 'status'].join('/');
    return this._conn.request(url);
  }

  /**
   * Refresh a dashboard
   */
  refresh() {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards', this.id].join('/');
    return this._conn.request({
      method: 'PUT',
      url,
      body: ''
    });
  }

  /**
   * Clone a dashboard
   */
  clone(config, folderId) {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards'].join('/') + '?cloneId=' + this.id;
    if (typeof config === 'string') {
      config = {
        name: config,
        folderId
      };
    }
    return this._conn.request({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      body: (0, _stringify.default)(config)
    });
  }

  /**
   * Destroy a dashboard
   */
  destroy() {
    const url = [this._conn._baseUrl(), 'analytics', 'dashboards', this.id].join('/');
    return this._conn.request({
      method: 'DELETE',
      url
    });
  }

  /**
   * Synonym of Analytics~Dashboard#destroy()
   */

  /**
   * Synonym of Analytics~Dashboard#destroy()
   */
}

/*----------------------------------------------------------------------------------*/
/**
 * API class for Analytics API
 */
exports.Dashboard = Dashboard;
class Analytics {
  /**
   *
   */
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    this._conn = conn;
  }

  /**
   * Get report object of Analytics API
   */
  report(id) {
    return new Report(this._conn, id);
  }

  /**
   * Get recent report list
   */
  reports() {
    const url = [this._conn._baseUrl(), 'analytics', 'reports'].join('/');
    return this._conn.request(url);
  }

  /**
   * Get dashboard object of Analytics API
   */
  dashboard(id) {
    return new Dashboard(this._conn, id);
  }

  /**
   * Get recent dashboard list
   */
  dashboards() {
    var url = [this._conn._baseUrl(), 'analytics', 'dashboards'].join('/');
    return this._conn.request(url);
  }
}

/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
exports.Analytics = Analytics;
(0, _jsforce.registerModule)('analytics', conn => new Analytics(conn));
var _default = Analytics;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfanNmb3JjZSIsInJlcXVpcmUiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRrZXlzIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiX2ZpbHRlckluc3RhbmNlUHJvcGVydHkiLCJjYWxsIiwic3ltIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJfY29udGV4dCIsIl9mb3JFYWNoSW5zdGFuY2VQcm9wZXJ0eSIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQyIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsIlJlcG9ydEluc3RhbmNlIiwiY29uc3RydWN0b3IiLCJyZXBvcnQiLCJpZCIsIl9yZXBvcnQiLCJfY29ubiIsInJldHJpZXZlIiwidXJsIiwiX2Jhc2VVcmwiLCJqb2luIiwicmVxdWVzdCIsImV4cG9ydHMiLCJSZXBvcnQiLCJjb25uIiwiZGVzdHJveSIsImV4ZWN1dGUiLCJkZXNjcmliZSIsIm1ldGhvZCIsImNsb25lIiwibmFtZSIsImNvbmZpZyIsInJlcG9ydE1ldGFkYXRhIiwiaGVhZGVycyIsImJvZHkiLCJfc3RyaW5naWZ5IiwiZXhwbGFpbiIsIm9wdGlvbnMiLCJkZXRhaWxzIiwibWV0YWRhdGEiLCJleGVjdXRlQXN5bmMiLCJpbnN0YW5jZSIsImluc3RhbmNlcyIsIkRhc2hib2FyZCIsImNvbXBvbmVudHMiLCJjb21wb25lbnRJZHMiLCJfaXNBcnJheSIsInVuZGVmaW5lZCIsInN0YXR1cyIsInJlZnJlc2giLCJmb2xkZXJJZCIsIkFuYWx5dGljcyIsInJlcG9ydHMiLCJkYXNoYm9hcmQiLCJkYXNoYm9hcmRzIiwicmVnaXN0ZXJNb2R1bGUiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvYW5hbHl0aWNzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgTWFuYWdlcyBTYWxlc2ZvcmNlIEFuYWx5dGljcyBBUElcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyByZWdpc3Rlck1vZHVsZSB9IGZyb20gJy4uL2pzZm9yY2UnO1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi4vY29ubmVjdGlvbic7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQge1xuICBSZXBvcnRNZXRhZGF0YSxcbiAgUmVwb3J0RXhlY3V0ZVJlc3VsdCxcbiAgUmVwb3J0UmV0cmlldmVSZXN1bHQsXG4gIFJlcG9ydERlc2NyaWJlUmVzdWx0LFxuICBSZXBvcnRJbmZvLFxuICBSZXBvcnRJbnN0YW5jZUluZm8sXG4gIERhc2hib2FyZE1ldGFkYXRhLFxuICBEYXNoYm9hcmRSZXN1bHQsXG4gIERhc2hib2FyZFN0YXR1c1Jlc3VsdCxcbiAgRGFzaGJvYXJkUmVmcmVzaFJlc3VsdCxcbiAgRGFzaGJvYXJkSW5mbyxcbn0gZnJvbSAnLi9hbmFseXRpY3MvdHlwZXMnO1xuaW1wb3J0IHsgUXVlcnlFeHBsYWluUmVzdWx0IH0gZnJvbSAnLi4vcXVlcnknO1xuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuZXhwb3J0IHR5cGUge1xuICBSZXBvcnRNZXRhZGF0YSxcbiAgUmVwb3J0RXhlY3V0ZVJlc3VsdCxcbiAgUmVwb3J0UmV0cmlldmVSZXN1bHQsXG4gIFJlcG9ydERlc2NyaWJlUmVzdWx0LFxuICBSZXBvcnRJbmZvLFxuICBSZXBvcnRJbnN0YW5jZUluZm8sXG4gIERhc2hib2FyZE1ldGFkYXRhLFxuICBEYXNoYm9hcmRSZXN1bHQsXG4gIERhc2hib2FyZFN0YXR1c1Jlc3VsdCxcbiAgRGFzaGJvYXJkUmVmcmVzaFJlc3VsdCxcbiAgRGFzaGJvYXJkSW5mbyxcbn07XG5cbmV4cG9ydCB0eXBlIFJlcG9ydEV4ZWN1dGVPcHRpb25zID0ge1xuICBkZXRhaWxzPzogYm9vbGVhbjtcbiAgbWV0YWRhdGE/OiB7XG4gICAgcmVwb3J0TWV0YWRhdGE6IFBhcnRpYWw8UmVwb3J0TWV0YWRhdGE+O1xuICB9O1xufTtcblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogUmVwb3J0IG9iamVjdCBjbGFzcyBpbiBBbmFseXRpY3MgQVBJXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXBvcnRJbnN0YW5jZTxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIF9yZXBvcnQ6IFJlcG9ydDxTPjtcbiAgX2Nvbm46IENvbm5lY3Rpb248Uz47XG4gIGlkOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihyZXBvcnQ6IFJlcG9ydDxTPiwgaWQ6IHN0cmluZykge1xuICAgIHRoaXMuX3JlcG9ydCA9IHJlcG9ydDtcbiAgICB0aGlzLl9jb25uID0gcmVwb3J0Ll9jb25uO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSByZXBvcnQgcmVzdWx0IGFzeW5jaHJvbm91c2x5IGV4ZWN1dGVkXG4gICAqL1xuICByZXRyaWV2ZSgpOiBQcm9taXNlPFJlcG9ydFJldHJpZXZlUmVzdWx0PiB7XG4gICAgY29uc3QgdXJsID0gW1xuICAgICAgdGhpcy5fY29ubi5fYmFzZVVybCgpLFxuICAgICAgJ2FuYWx5dGljcycsXG4gICAgICAncmVwb3J0cycsXG4gICAgICB0aGlzLl9yZXBvcnQuaWQsXG4gICAgICAnaW5zdGFuY2VzJyxcbiAgICAgIHRoaXMuaWQsXG4gICAgXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxSZXBvcnRSZXRyaWV2ZVJlc3VsdD4odXJsKTtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKiBSZXBvcnQgb2JqZWN0IGNsYXNzIGluIEFuYWx5dGljcyBBUElcbiAqL1xuZXhwb3J0IGNsYXNzIFJlcG9ydDxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIF9jb25uOiBDb25uZWN0aW9uPFM+O1xuICBpZDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoY29ubjogQ29ubmVjdGlvbjxTPiwgaWQ6IHN0cmluZykge1xuICAgIHRoaXMuX2Nvbm4gPSBjb25uO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSByZXBvcnQgbWV0YWRhdGFcbiAgICovXG4gIGRlc2NyaWJlKCk6IFByb21pc2U8UmVwb3J0RGVzY3JpYmVSZXN1bHQ+IHtcbiAgICB2YXIgdXJsID0gW1xuICAgICAgdGhpcy5fY29ubi5fYmFzZVVybCgpLFxuICAgICAgJ2FuYWx5dGljcycsXG4gICAgICAncmVwb3J0cycsXG4gICAgICB0aGlzLmlkLFxuICAgICAgJ2Rlc2NyaWJlJyxcbiAgICBdLmpvaW4oJy8nKTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFJlcG9ydERlc2NyaWJlUmVzdWx0Pih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgYSByZXBvcnRcbiAgICovXG4gIGRlc3Ryb3koKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXJsID0gW3RoaXMuX2Nvbm4uX2Jhc2VVcmwoKSwgJ2FuYWx5dGljcycsICdyZXBvcnRzJywgdGhpcy5pZF0uam9pbihcbiAgICAgICcvJyxcbiAgICApO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8dm9pZD4oeyBtZXRob2Q6ICdERUxFVEUnLCB1cmwgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBBbmFseXRpY3N+UmVwb3J0I2Rlc3Ryb3koKVxuICAgKi9cbiAgZGVsZXRlID0gdGhpcy5kZXN0cm95O1xuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIEFuYWx5dGljc35SZXBvcnQjZGVzdHJveSgpXG4gICAqL1xuICBkZWwgPSB0aGlzLmRlc3Ryb3k7XG5cbiAgLyoqXG4gICAqIENsb25lcyBhIGdpdmVuIHJlcG9ydFxuICAgKi9cbiAgY2xvbmUobmFtZTogc3RyaW5nKTogUHJvbWlzZTxSZXBvcnREZXNjcmliZVJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICBbdGhpcy5fY29ubi5fYmFzZVVybCgpLCAnYW5hbHl0aWNzJywgJ3JlcG9ydHMnXS5qb2luKCcvJykgK1xuICAgICAgJz9jbG9uZUlkPScgK1xuICAgICAgdGhpcy5pZDtcbiAgICBjb25zdCBjb25maWcgPSB7IHJlcG9ydE1ldGFkYXRhOiB7IG5hbWUgfSB9O1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8UmVwb3J0RGVzY3JpYmVSZXN1bHQ+KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsLFxuICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShjb25maWcpLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cGxhaW4gcGxhbiBmb3IgZXhlY3V0aW5nIHJlcG9ydFxuICAgKi9cbiAgZXhwbGFpbigpOiBQcm9taXNlPFF1ZXJ5RXhwbGFpblJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9ICcvcXVlcnkvP2V4cGxhaW49JyArIHRoaXMuaWQ7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxRdWVyeUV4cGxhaW5SZXN1bHQ+KHVybCk7XG4gIH1cblxuICAvKipcbiAgICogUnVuIHJlcG9ydCBzeW5jaHJvbm91c2x5XG4gICAqL1xuICBleGVjdXRlKG9wdGlvbnM6IFJlcG9ydEV4ZWN1dGVPcHRpb25zID0ge30pOiBQcm9taXNlPFJlcG9ydEV4ZWN1dGVSZXN1bHQ+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgW3RoaXMuX2Nvbm4uX2Jhc2VVcmwoKSwgJ2FuYWx5dGljcycsICdyZXBvcnRzJywgdGhpcy5pZF0uam9pbignLycpICtcbiAgICAgICc/aW5jbHVkZURldGFpbHM9JyArXG4gICAgICAob3B0aW9ucy5kZXRhaWxzID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxSZXBvcnRFeGVjdXRlUmVzdWx0Pih7XG4gICAgICB1cmwsXG4gICAgICAuLi4ob3B0aW9ucy5tZXRhZGF0YVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcHRpb25zLm1ldGFkYXRhKSxcbiAgICAgICAgICB9XG4gICAgICAgIDogeyBtZXRob2Q6ICdHRVQnIH0pLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgQW5hbHl0aWNzflJlcG9ydCNleGVjdXRlKClcbiAgICovXG4gIHJ1biA9IHRoaXMuZXhlY3V0ZTtcblxuICAvKipcbiAgICogU3lub255bSBvZiBBbmFseXRpY3N+UmVwb3J0I2V4ZWN1dGUoKVxuICAgKi9cbiAgZXhlYyA9IHRoaXMuZXhlY3V0ZTtcblxuICAvKipcbiAgICogUnVuIHJlcG9ydCBhc3luY2hyb25vdXNseVxuICAgKi9cbiAgZXhlY3V0ZUFzeW5jKFxuICAgIG9wdGlvbnM6IFJlcG9ydEV4ZWN1dGVPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8UmVwb3J0SW5zdGFuY2VJbmZvPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIFtcbiAgICAgICAgdGhpcy5fY29ubi5fYmFzZVVybCgpLFxuICAgICAgICAnYW5hbHl0aWNzJyxcbiAgICAgICAgJ3JlcG9ydHMnLFxuICAgICAgICB0aGlzLmlkLFxuICAgICAgICAnaW5zdGFuY2VzJyxcbiAgICAgIF0uam9pbignLycpICsgKG9wdGlvbnMuZGV0YWlscyA/ICc/aW5jbHVkZURldGFpbHM9dHJ1ZScgOiAnJyk7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxSZXBvcnRJbnN0YW5jZUluZm8+KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsLFxuICAgICAgLi4uKG9wdGlvbnMubWV0YWRhdGFcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMubWV0YWRhdGEpLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB7IGJvZHk6ICcnIH0pLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCByZXBvcnQgaW5zdGFuY2UgZm9yIHNwZWNpZmllZCBpbnN0YW5jZSBJRFxuICAgKi9cbiAgaW5zdGFuY2UoaWQ6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVwb3J0SW5zdGFuY2UodGhpcywgaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3QgcmVwb3J0IGluc3RhbmNlcyB3aGljaCBoYWQgYmVlbiBleGVjdXRlZCBhc3luY2hyb25vdXNseVxuICAgKi9cbiAgaW5zdGFuY2VzKCk6IFByb21pc2U8UmVwb3J0SW5zdGFuY2VJbmZvW10+IHtcbiAgICBjb25zdCB1cmwgPSBbXG4gICAgICB0aGlzLl9jb25uLl9iYXNlVXJsKCksXG4gICAgICAnYW5hbHl0aWNzJyxcbiAgICAgICdyZXBvcnRzJyxcbiAgICAgIHRoaXMuaWQsXG4gICAgICAnaW5zdGFuY2VzJyxcbiAgICBdLmpvaW4oJy8nKTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PFJlcG9ydEluc3RhbmNlSW5mb1tdPih1cmwpO1xuICB9XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIERhc2hib2FyZCBvYmplY3QgY2xhc3MgaW4gdGhlIEFuYWx5dGljcyBBUElcbiAqL1xuZXhwb3J0IGNsYXNzIERhc2hib2FyZDxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIF9jb25uOiBDb25uZWN0aW9uPFM+O1xuICBpZDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoY29ubjogQ29ubmVjdGlvbjxTPiwgaWQ6IHN0cmluZykge1xuICAgIHRoaXMuX2Nvbm4gPSBjb25uO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBkYXNoYm9hcmQgbWV0YWRhdGFcbiAgICpcbiAgICogQG1ldGhvZCBBbmFseXRpY3N+RGFzaGJvYXJkI2Rlc2NyaWJlXG4gICAqIEBwYXJhbSB7Q2FsbGJhY2suPEFuYWx5dGljcy1EYXNoYm9hcmRNZXRhZGF0YT59IFtjYWxsYmFja10gLSBDYWxsYmFjayBmdW5jdGlvblxuICAgKiBAcmV0dXJucyB7UHJvbWlzZS48QW5hbHl0aWNzLURhc2hib2FyZE1ldGFkYXRhPn1cbiAgICovXG4gIGRlc2NyaWJlKCk6IFByb21pc2U8RGFzaGJvYXJkTWV0YWRhdGE+IHtcbiAgICBjb25zdCB1cmwgPSBbXG4gICAgICB0aGlzLl9jb25uLl9iYXNlVXJsKCksXG4gICAgICAnYW5hbHl0aWNzJyxcbiAgICAgICdkYXNoYm9hcmRzJyxcbiAgICAgIHRoaXMuaWQsXG4gICAgICAnZGVzY3JpYmUnLFxuICAgIF0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8RGFzaGJvYXJkTWV0YWRhdGE+KHVybCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGRldGFpbHMgYWJvdXQgZGFzaGJvYXJkIGNvbXBvbmVudHNcbiAgICovXG4gIGNvbXBvbmVudHMoY29tcG9uZW50SWRzPzogc3RyaW5nIHwgc3RyaW5nW10pOiBQcm9taXNlPERhc2hib2FyZFJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IFtcbiAgICAgIHRoaXMuX2Nvbm4uX2Jhc2VVcmwoKSxcbiAgICAgICdhbmFseXRpY3MnLFxuICAgICAgJ2Rhc2hib2FyZHMnLFxuICAgICAgdGhpcy5pZCxcbiAgICBdLmpvaW4oJy8nKTtcbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBjb21wb25lbnRJZHM6IEFycmF5LmlzQXJyYXkoY29tcG9uZW50SWRzKVxuICAgICAgICA/IGNvbXBvbmVudElkc1xuICAgICAgICA6IHR5cGVvZiBjb21wb25lbnRJZHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gW2NvbXBvbmVudElkc11cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fY29ubi5yZXF1ZXN0PERhc2hib2FyZFJlc3VsdD4oe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGNvbmZpZyksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGRhc2hib2FyZCBzdGF0dXNcbiAgICovXG4gIHN0YXR1cygpOiBQcm9taXNlPERhc2hib2FyZFN0YXR1c1Jlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IFtcbiAgICAgIHRoaXMuX2Nvbm4uX2Jhc2VVcmwoKSxcbiAgICAgICdhbmFseXRpY3MnLFxuICAgICAgJ2Rhc2hib2FyZHMnLFxuICAgICAgdGhpcy5pZCxcbiAgICAgICdzdGF0dXMnLFxuICAgIF0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8RGFzaGJvYXJkU3RhdHVzUmVzdWx0Pih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZnJlc2ggYSBkYXNoYm9hcmRcbiAgICovXG4gIHJlZnJlc2goKTogUHJvbWlzZTxEYXNoYm9hcmRSZWZyZXNoUmVzdWx0PiB7XG4gICAgY29uc3QgdXJsID0gW1xuICAgICAgdGhpcy5fY29ubi5fYmFzZVVybCgpLFxuICAgICAgJ2FuYWx5dGljcycsXG4gICAgICAnZGFzaGJvYXJkcycsXG4gICAgICB0aGlzLmlkLFxuICAgIF0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8RGFzaGJvYXJkUmVmcmVzaFJlc3VsdD4oe1xuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIHVybCxcbiAgICAgIGJvZHk6ICcnLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb25lIGEgZGFzaGJvYXJkXG4gICAqL1xuICBjbG9uZShcbiAgICBjb25maWc6IHsgbmFtZTogc3RyaW5nOyBmb2xkZXJJZD86IHN0cmluZyB9IHwgc3RyaW5nLFxuICAgIGZvbGRlcklkPzogc3RyaW5nLFxuICApOiBQcm9taXNlPERhc2hib2FyZE1ldGFkYXRhPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIFt0aGlzLl9jb25uLl9iYXNlVXJsKCksICdhbmFseXRpY3MnLCAnZGFzaGJvYXJkcyddLmpvaW4oJy8nKSArXG4gICAgICAnP2Nsb25lSWQ9JyArXG4gICAgICB0aGlzLmlkO1xuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgY29uZmlnID0geyBuYW1lOiBjb25maWcsIGZvbGRlcklkIH07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8RGFzaGJvYXJkTWV0YWRhdGE+KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsLFxuICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShjb25maWcpLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgYSBkYXNoYm9hcmRcbiAgICovXG4gIGRlc3Ryb3koKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXJsID0gW1xuICAgICAgdGhpcy5fY29ubi5fYmFzZVVybCgpLFxuICAgICAgJ2FuYWx5dGljcycsXG4gICAgICAnZGFzaGJvYXJkcycsXG4gICAgICB0aGlzLmlkLFxuICAgIF0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8dm9pZD4oeyBtZXRob2Q6ICdERUxFVEUnLCB1cmwgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3lub255bSBvZiBBbmFseXRpY3N+RGFzaGJvYXJkI2Rlc3Ryb3koKVxuICAgKi9cbiAgZGVsZXRlID0gdGhpcy5kZXN0cm95O1xuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIEFuYWx5dGljc35EYXNoYm9hcmQjZGVzdHJveSgpXG4gICAqL1xuICBkZWwgPSB0aGlzLmRlc3Ryb3k7XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIEFQSSBjbGFzcyBmb3IgQW5hbHl0aWNzIEFQSVxuICovXG5leHBvcnQgY2xhc3MgQW5hbHl0aWNzPFMgZXh0ZW5kcyBTY2hlbWE+IHtcbiAgX2Nvbm46IENvbm5lY3Rpb248Uz47XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+KSB7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gIH1cblxuICAvKipcbiAgICogR2V0IHJlcG9ydCBvYmplY3Qgb2YgQW5hbHl0aWNzIEFQSVxuICAgKi9cbiAgcmVwb3J0KGlkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlcG9ydCh0aGlzLl9jb25uLCBpZCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHJlY2VudCByZXBvcnQgbGlzdFxuICAgKi9cbiAgcmVwb3J0cygpIHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fY29ubi5fYmFzZVVybCgpLCAnYW5hbHl0aWNzJywgJ3JlcG9ydHMnXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm4ucmVxdWVzdDxSZXBvcnRJbmZvW10+KHVybCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGRhc2hib2FyZCBvYmplY3Qgb2YgQW5hbHl0aWNzIEFQSVxuICAgKi9cbiAgZGFzaGJvYXJkKGlkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IERhc2hib2FyZCh0aGlzLl9jb25uLCBpZCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHJlY2VudCBkYXNoYm9hcmQgbGlzdFxuICAgKi9cbiAgZGFzaGJvYXJkcygpIHtcbiAgICB2YXIgdXJsID0gW3RoaXMuX2Nvbm4uX2Jhc2VVcmwoKSwgJ2FuYWx5dGljcycsICdkYXNoYm9hcmRzJ10uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLl9jb25uLnJlcXVlc3Q8RGFzaGJvYXJkSW5mb1tdPih1cmwpO1xuICB9XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLypcbiAqIFJlZ2lzdGVyIGhvb2sgaW4gY29ubmVjdGlvbiBpbnN0YW50aWF0aW9uIGZvciBkeW5hbWljYWxseSBhZGRpbmcgdGhpcyBBUEkgbW9kdWxlIGZlYXR1cmVzXG4gKi9cbnJlZ2lzdGVyTW9kdWxlKCdhbmFseXRpY3MnLCAoY29ubikgPT4gbmV3IEFuYWx5dGljcyhjb25uKSk7XG5cbmV4cG9ydCBkZWZhdWx0IEFuYWx5dGljcztcbiJdLCJt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