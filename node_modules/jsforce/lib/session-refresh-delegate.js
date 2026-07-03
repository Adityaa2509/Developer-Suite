"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SessionRefreshDelegate = void 0;
var _now = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/date/now"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _logger = require("./util/logger");
/**
 *
 */

/**
 *
 */

/**
 *
 */
class SessionRefreshDelegate {
  constructor(conn, refreshFn) {
    (0, _defineProperty2.default)(this, "_refreshFn", void 0);
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "_lastRefreshedAt", undefined);
    (0, _defineProperty2.default)(this, "_refreshPromise", undefined);
    this._conn = conn;
    this._logger = conn._logLevel ? SessionRefreshDelegate._logger.createInstance(conn._logLevel) : SessionRefreshDelegate._logger;
    this._refreshFn = refreshFn;
  }

  /**
   * Refresh access token
   * @private
   */
  async refresh(since) {
    // Callback immediately When refreshed after designated time
    if (this._lastRefreshedAt && this._lastRefreshedAt > since) {
      return;
    }
    if (this._refreshPromise) {
      await this._refreshPromise;
      return;
    }
    try {
      this._logger.info('<refresh token>');
      this._refreshPromise = new _promise.default((resolve, reject) => {
        this._refreshFn(this._conn, (err, accessToken, res) => {
          if (!err) {
            this._logger.debug('Connection refresh completed.');
            this._conn.accessToken = accessToken;
            this._conn.emit('refresh', accessToken, res);
            resolve();
          } else {
            reject(err);
          }
        });
      });
      await this._refreshPromise;
      this._logger.info('<refresh complete>');
    } finally {
      this._refreshPromise = undefined;
      this._lastRefreshedAt = (0, _now.default)();
    }
  }
  isRefreshing() {
    return !!this._refreshPromise;
  }
  async waitRefresh() {
    return this._refreshPromise;
  }
}
exports.SessionRefreshDelegate = SessionRefreshDelegate;
(0, _defineProperty2.default)(SessionRefreshDelegate, "_logger", (0, _logger.getLogger)('session-refresh-delegate'));
var _default = SessionRefreshDelegate;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIlNlc3Npb25SZWZyZXNoRGVsZWdhdGUiLCJjb25zdHJ1Y3RvciIsImNvbm4iLCJyZWZyZXNoRm4iLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsInVuZGVmaW5lZCIsIl9jb25uIiwiX2xvZ0xldmVsIiwiY3JlYXRlSW5zdGFuY2UiLCJfcmVmcmVzaEZuIiwicmVmcmVzaCIsInNpbmNlIiwiX2xhc3RSZWZyZXNoZWRBdCIsIl9yZWZyZXNoUHJvbWlzZSIsImluZm8iLCJfcHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJlcnIiLCJhY2Nlc3NUb2tlbiIsInJlcyIsImRlYnVnIiwiZW1pdCIsIl9ub3ciLCJpc1JlZnJlc2hpbmciLCJ3YWl0UmVmcmVzaCIsImV4cG9ydHMiLCJnZXRMb2dnZXIiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXNzaW9uLXJlZnJlc2gtZGVsZWdhdGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICovXG5pbXBvcnQgeyBnZXRMb2dnZXIsIExvZ2dlciB9IGZyb20gJy4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHsgQ2FsbGJhY2ssIFNjaGVtYSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi9jb25uZWN0aW9uJztcbmltcG9ydCB7IFRva2VuUmVzcG9uc2UgfSBmcm9tICcuL29hdXRoMic7XG5cbi8qKlxuICpcbiAqL1xuZXhwb3J0IHR5cGUgU2Vzc2lvblJlZnJlc2hGdW5jPFMgZXh0ZW5kcyBTY2hlbWE+ID0gKFxuICBjb25uOiBDb25uZWN0aW9uPFM+LFxuICBjYWxsYmFjazogQ2FsbGJhY2s8c3RyaW5nLCBUb2tlblJlc3BvbnNlPixcbikgPT4gdm9pZDtcblxuLyoqXG4gKlxuICovXG5leHBvcnQgY2xhc3MgU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZTxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gIHN0YXRpYyBfbG9nZ2VyOiBMb2dnZXIgPSBnZXRMb2dnZXIoJ3Nlc3Npb24tcmVmcmVzaC1kZWxlZ2F0ZScpO1xuXG4gIHByaXZhdGUgX3JlZnJlc2hGbjogU2Vzc2lvblJlZnJlc2hGdW5jPFM+O1xuICBwcml2YXRlIF9jb25uOiBDb25uZWN0aW9uPFM+O1xuICBwcml2YXRlIF9sb2dnZXI6IExvZ2dlcjtcbiAgcHJpdmF0ZSBfbGFzdFJlZnJlc2hlZEF0OiBudW1iZXIgfCB2b2lkID0gdW5kZWZpbmVkO1xuICBwcml2YXRlIF9yZWZyZXNoUHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IHZvaWQgPSB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IoY29ubjogQ29ubmVjdGlvbjxTPiwgcmVmcmVzaEZuOiBTZXNzaW9uUmVmcmVzaEZ1bmM8Uz4pIHtcbiAgICB0aGlzLl9jb25uID0gY29ubjtcbiAgICB0aGlzLl9sb2dnZXIgPSBjb25uLl9sb2dMZXZlbFxuICAgICAgPyBTZXNzaW9uUmVmcmVzaERlbGVnYXRlLl9sb2dnZXIuY3JlYXRlSW5zdGFuY2UoY29ubi5fbG9nTGV2ZWwpXG4gICAgICA6IFNlc3Npb25SZWZyZXNoRGVsZWdhdGUuX2xvZ2dlcjtcbiAgICB0aGlzLl9yZWZyZXNoRm4gPSByZWZyZXNoRm47XG4gIH1cblxuICAvKipcbiAgICogUmVmcmVzaCBhY2Nlc3MgdG9rZW5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGFzeW5jIHJlZnJlc2goc2luY2U6IG51bWJlcikge1xuICAgIC8vIENhbGxiYWNrIGltbWVkaWF0ZWx5IFdoZW4gcmVmcmVzaGVkIGFmdGVyIGRlc2lnbmF0ZWQgdGltZVxuICAgIGlmICh0aGlzLl9sYXN0UmVmcmVzaGVkQXQgJiYgdGhpcy5fbGFzdFJlZnJlc2hlZEF0ID4gc2luY2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3JlZnJlc2hQcm9taXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLl9yZWZyZXNoUHJvbWlzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2xvZ2dlci5pbmZvKCc8cmVmcmVzaCB0b2tlbj4nKTtcbiAgICAgIHRoaXMuX3JlZnJlc2hQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9yZWZyZXNoRm4odGhpcy5fY29ubiwgKGVyciwgYWNjZXNzVG9rZW4sIHJlcykgPT4ge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2dnZXIuZGVidWcoJ0Nvbm5lY3Rpb24gcmVmcmVzaCBjb21wbGV0ZWQuJyk7XG4gICAgICAgICAgICB0aGlzLl9jb25uLmFjY2Vzc1Rva2VuID0gYWNjZXNzVG9rZW47XG4gICAgICAgICAgICB0aGlzLl9jb25uLmVtaXQoJ3JlZnJlc2gnLCBhY2Nlc3NUb2tlbiwgcmVzKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgdGhpcy5fcmVmcmVzaFByb21pc2U7XG4gICAgICB0aGlzLl9sb2dnZXIuaW5mbygnPHJlZnJlc2ggY29tcGxldGU+Jyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX3JlZnJlc2hQcm9taXNlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fbGFzdFJlZnJlc2hlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICB9XG4gIH1cblxuICBpc1JlZnJlc2hpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEhdGhpcy5fcmVmcmVzaFByb21pc2U7XG4gIH1cblxuICBhc3luYyB3YWl0UmVmcmVzaCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVmcmVzaFByb21pc2U7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBR0Es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