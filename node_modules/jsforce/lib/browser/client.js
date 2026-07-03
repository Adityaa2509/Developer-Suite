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
require("core-js/modules/es.array.iterator");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.BrowserClient = void 0;
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _reverse = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/reverse"));
var _now = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/date/now"));
var _setInterval2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set-interval"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _setTimeout2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set-timeout"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _events = require("events");
var _querystring = _interopRequireDefault(require("querystring"));
var _connection = _interopRequireDefault(require("../connection"));
var _oauth = _interopRequireDefault(require("../oauth2"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source), true)).call(_context2, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source))).call(_context3, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @file Browser client connection management class
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
/**
 * @private
 */
function popupWin(url, w, h) {
  const left = screen.width / 2 - w / 2;
  const top = screen.height / 2 - h / 2;
  return window.open(url, undefined, `location=yes,toolbar=no,status=no,menubar=no,width=${w},height=${h},top=${top},left=${left}`);
}

/**
 * @private
 */
function handleCallbackResponse() {
  const res = checkCallbackResponse();
  const state = localStorage.getItem('jsforce_state');
  if (res && state && res.body.state === state) {
    localStorage.removeItem('jsforce_state');
    const [prefix, promptType] = state.split('.');
    const cli = new BrowserClient(prefix);
    if (res.success) {
      cli._storeTokens(res.body);
      location.hash = '';
    } else {
      cli._storeError(res.body);
    }
    if (promptType === 'popup') {
      window.close();
    }
    return true;
  }
}

/**
 * @private
 */
function checkCallbackResponse() {
  let params;
  if (window.location.hash) {
    params = _querystring.default.parse(window.location.hash.substring(1));
    if (params.access_token) {
      return {
        success: true,
        body: params
      };
    }
  } else if (window.location.search) {
    params = _querystring.default.parse(window.location.search.substring(1));
    if (params.error) {
      return {
        success: false,
        body: params
      };
    }
  }
}

/**
 *
 */

/**
 *
 */
const DEFAULT_POPUP_WIN_WIDTH = 912;
const DEFAULT_POPUP_WIN_HEIGHT = 513;

/** @private **/
let clientIdx = 0;

/**
 *
 */
class BrowserClient extends _events.EventEmitter {
  /**
   *
   */
  constructor(prefix) {
    super();
    (0, _defineProperty2.default)(this, "_prefix", void 0);
    (0, _defineProperty2.default)(this, "_config", void 0);
    (0, _defineProperty2.default)(this, "_connection", void 0);
    this._prefix = prefix || 'jsforce' + clientIdx++;
  }
  get connection() {
    if (!this._connection) {
      this._connection = new _connection.default(this._config);
    }
    return this._connection;
  }

  /**
   *
   */
  init(config) {
    if (handleCallbackResponse()) {
      return;
    }
    this._config = config;
    const tokens = this._getTokens();
    if (tokens) {
      this.connection._establish(tokens);
      (0, _setTimeout2.default)(() => {
        this.emit('connect', this.connection);
      }, 10);
    }
  }

  /**
   *
   */
  login(options = {}) {
    var _this$_config, _size$width, _size$height;
    const {
      scope,
      size
    } = options;
    const oauth2 = new _oauth.default((_this$_config = this._config) !== null && _this$_config !== void 0 ? _this$_config : {});
    const rand = Math.random().toString(36).substring(2);
    const state = [this._prefix, 'popup', rand].join('.');
    localStorage.setItem('jsforce_state', state);
    const authzUrl = oauth2.getAuthorizationUrl(_objectSpread({
      response_type: 'token',
      state
    }, scope ? {
      scope
    } : {}));
    const pw = popupWin(authzUrl, (_size$width = size === null || size === void 0 ? void 0 : size.width) !== null && _size$width !== void 0 ? _size$width : DEFAULT_POPUP_WIN_WIDTH, (_size$height = size === null || size === void 0 ? void 0 : size.height) !== null && _size$height !== void 0 ? _size$height : DEFAULT_POPUP_WIN_HEIGHT);
    return new _promise.default((resolve, reject) => {
      if (!pw) {
        const state = [this._prefix, 'redirect', rand].join('.');
        localStorage.setItem('jsforce_state', state);
        const authzUrl = oauth2.getAuthorizationUrl(_objectSpread({
          response_type: 'token',
          state
        }, scope ? {
          scope
        } : {}));
        location.href = authzUrl;
        return;
      }
      this._removeTokens();
      const pid = (0, _setInterval2.default)(() => {
        try {
          if (!pw || pw.closed) {
            clearInterval(pid);
            const tokens = this._getTokens();
            if (tokens) {
              this.connection._establish(tokens);
              this.emit('connect', this.connection);
              resolve({
                status: 'connect'
              });
            } else {
              const err = this._getError();
              if (err) {
                reject(new Error(err.error + ': ' + err.error_description));
              } else {
                resolve({
                  status: 'cancel'
                });
              }
            }
          }
        } catch (e) {
          //
        }
      }, 1000);
    });
  }

  /**
   *
   */
  isLoggedIn() {
    return !!this.connection.accessToken;
  }

  /**
   *
   */
  logout() {
    this.connection.logout();
    this._removeTokens();
    this.emit('disconnect');
  }

  /**
   * @private
   */
  _getTokens() {
    const regexp = new RegExp('(^|;\\s*)' + this._prefix + '_loggedin=true(;|$)');
    if (document.cookie.match(regexp)) {
      const issuedAt = Number(localStorage.getItem(this._prefix + '_issued_at'));
      // 2 hours
      if ((0, _now.default)() < issuedAt + 2 * 60 * 60 * 1000) {
        let userInfo;
        const idUrl = localStorage.getItem(this._prefix + '_id');
        if (idUrl) {
          var _context;
          const [id, organizationId] = (0, _reverse.default)(_context = idUrl.split('/')).call(_context);
          userInfo = {
            id,
            organizationId,
            url: idUrl
          };
        }
        return {
          accessToken: localStorage.getItem(this._prefix + '_access_token'),
          instanceUrl: localStorage.getItem(this._prefix + '_instance_url'),
          userInfo
        };
      }
    }
    return null;
  }

  /**
   * @private
   */
  _storeTokens(params) {
    localStorage.setItem(this._prefix + '_access_token', params.access_token);
    localStorage.setItem(this._prefix + '_instance_url', params.instance_url);
    localStorage.setItem(this._prefix + '_issued_at', params.issued_at);
    localStorage.setItem(this._prefix + '_id', params.id);
    document.cookie = this._prefix + '_loggedin=true;';
  }

  /**
   * @private
   */
  _removeTokens() {
    localStorage.removeItem(this._prefix + '_access_token');
    localStorage.removeItem(this._prefix + '_instance_url');
    localStorage.removeItem(this._prefix + '_issued_at');
    localStorage.removeItem(this._prefix + '_id');
    document.cookie = this._prefix + '_loggedin=';
  }

  /**
   * @private
   */
  _getError() {
    try {
      var _localStorage$getItem;
      const err = JSON.parse((_localStorage$getItem = localStorage.getItem(this._prefix + '_error')) !== null && _localStorage$getItem !== void 0 ? _localStorage$getItem : '');
      localStorage.removeItem(this._prefix + '_error');
      return err;
    } catch (e) {
      //
    }
  }

  /**
   * @private
   */
  _storeError(err) {
    localStorage.setItem(this._prefix + '_error', (0, _stringify.default)(err));
  }
}

/**
 *
 */
exports.BrowserClient = BrowserClient;
const client = new BrowserClient();
var _default = client;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9xdWVyeXN0cmluZyIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfY29ubmVjdGlvbiIsIl9vYXV0aCIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJfT2JqZWN0JGtleXMiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eSIsImNhbGwiLCJzeW0iLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsIl9jb250ZXh0MiIsIl9mb3JFYWNoSW5zdGFuY2VQcm9wZXJ0eSIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsInBvcHVwV2luIiwidXJsIiwidyIsImgiLCJsZWZ0Iiwic2NyZWVuIiwid2lkdGgiLCJ0b3AiLCJoZWlnaHQiLCJ3aW5kb3ciLCJvcGVuIiwidW5kZWZpbmVkIiwiaGFuZGxlQ2FsbGJhY2tSZXNwb25zZSIsInJlcyIsImNoZWNrQ2FsbGJhY2tSZXNwb25zZSIsInN0YXRlIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsImJvZHkiLCJyZW1vdmVJdGVtIiwicHJlZml4IiwicHJvbXB0VHlwZSIsInNwbGl0IiwiY2xpIiwiQnJvd3NlckNsaWVudCIsInN1Y2Nlc3MiLCJfc3RvcmVUb2tlbnMiLCJsb2NhdGlvbiIsImhhc2giLCJfc3RvcmVFcnJvciIsImNsb3NlIiwicGFyYW1zIiwicXMiLCJwYXJzZSIsInN1YnN0cmluZyIsImFjY2Vzc190b2tlbiIsInNlYXJjaCIsImVycm9yIiwiREVGQVVMVF9QT1BVUF9XSU5fV0lEVEgiLCJERUZBVUxUX1BPUFVQX1dJTl9IRUlHSFQiLCJjbGllbnRJZHgiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsIl9wcmVmaXgiLCJjb25uZWN0aW9uIiwiQ29ubmVjdGlvbiIsIl9jb25maWciLCJpbml0IiwiY29uZmlnIiwidG9rZW5zIiwiX2dldFRva2VucyIsIl9lc3RhYmxpc2giLCJfc2V0VGltZW91dDIiLCJlbWl0IiwibG9naW4iLCJvcHRpb25zIiwiX3RoaXMkX2NvbmZpZyIsIl9zaXplJHdpZHRoIiwiX3NpemUkaGVpZ2h0Iiwic2NvcGUiLCJzaXplIiwib2F1dGgyIiwiT0F1dGgyIiwicmFuZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsImpvaW4iLCJzZXRJdGVtIiwiYXV0aHpVcmwiLCJnZXRBdXRob3JpemF0aW9uVXJsIiwicmVzcG9uc2VfdHlwZSIsInB3IiwiX3Byb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiaHJlZiIsIl9yZW1vdmVUb2tlbnMiLCJwaWQiLCJfc2V0SW50ZXJ2YWwyIiwiY2xvc2VkIiwiY2xlYXJJbnRlcnZhbCIsInN0YXR1cyIsImVyciIsIl9nZXRFcnJvciIsIkVycm9yIiwiZXJyb3JfZGVzY3JpcHRpb24iLCJlIiwiaXNMb2dnZWRJbiIsImFjY2Vzc1Rva2VuIiwibG9nb3V0IiwicmVnZXhwIiwiUmVnRXhwIiwiZG9jdW1lbnQiLCJjb29raWUiLCJtYXRjaCIsImlzc3VlZEF0IiwiTnVtYmVyIiwiX25vdyIsInVzZXJJbmZvIiwiaWRVcmwiLCJfY29udGV4dCIsImlkIiwib3JnYW5pemF0aW9uSWQiLCJfcmV2ZXJzZSIsImluc3RhbmNlVXJsIiwiaW5zdGFuY2VfdXJsIiwiaXNzdWVkX2F0IiwiX2xvY2FsU3RvcmFnZSRnZXRJdGVtIiwiSlNPTiIsIl9zdHJpbmdpZnkiLCJleHBvcnRzIiwiY2xpZW50IiwiX2RlZmF1bHQiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvYnJvd3Nlci9jbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZSBCcm93c2VyIGNsaWVudCBjb25uZWN0aW9uIG1hbmFnZW1lbnQgY2xhc3NcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHFzIGZyb20gJ3F1ZXJ5c3RyaW5nJztcbmltcG9ydCBDb25uZWN0aW9uLCB7IENvbm5lY3Rpb25Db25maWcgfSBmcm9tICcuLi9jb25uZWN0aW9uJztcbmltcG9ydCBPQXV0aDIsIHsgVG9rZW5SZXNwb25zZSB9IGZyb20gJy4uL29hdXRoMic7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gcG9wdXBXaW4odXJsOiBzdHJpbmcsIHc6IG51bWJlciwgaDogbnVtYmVyKSB7XG4gIGNvbnN0IGxlZnQgPSBzY3JlZW4ud2lkdGggLyAyIC0gdyAvIDI7XG4gIGNvbnN0IHRvcCA9IHNjcmVlbi5oZWlnaHQgLyAyIC0gaCAvIDI7XG4gIHJldHVybiB3aW5kb3cub3BlbihcbiAgICB1cmwsXG4gICAgdW5kZWZpbmVkLFxuICAgIGBsb2NhdGlvbj15ZXMsdG9vbGJhcj1ubyxzdGF0dXM9bm8sbWVudWJhcj1ubyx3aWR0aD0ke3d9LGhlaWdodD0ke2h9LHRvcD0ke3RvcH0sbGVmdD0ke2xlZnR9YCxcbiAgKTtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBoYW5kbGVDYWxsYmFja1Jlc3BvbnNlKCkge1xuICBjb25zdCByZXMgPSBjaGVja0NhbGxiYWNrUmVzcG9uc2UoKTtcbiAgY29uc3Qgc3RhdGUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnanNmb3JjZV9zdGF0ZScpO1xuICBpZiAocmVzICYmIHN0YXRlICYmIHJlcy5ib2R5LnN0YXRlID09PSBzdGF0ZSkge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdqc2ZvcmNlX3N0YXRlJyk7XG4gICAgY29uc3QgW3ByZWZpeCwgcHJvbXB0VHlwZV0gPSBzdGF0ZS5zcGxpdCgnLicpO1xuICAgIGNvbnN0IGNsaSA9IG5ldyBCcm93c2VyQ2xpZW50KHByZWZpeCk7XG4gICAgaWYgKHJlcy5zdWNjZXNzKSB7XG4gICAgICBjbGkuX3N0b3JlVG9rZW5zKHJlcy5ib2R5IGFzIFRva2VuUmVzcG9uc2UpO1xuICAgICAgbG9jYXRpb24uaGFzaCA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICBjbGkuX3N0b3JlRXJyb3IocmVzLmJvZHkpO1xuICAgIH1cbiAgICBpZiAocHJvbXB0VHlwZSA9PT0gJ3BvcHVwJykge1xuICAgICAgd2luZG93LmNsb3NlKCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gY2hlY2tDYWxsYmFja1Jlc3BvbnNlKCkge1xuICBsZXQgcGFyYW1zO1xuICBpZiAod2luZG93LmxvY2F0aW9uLmhhc2gpIHtcbiAgICBwYXJhbXMgPSBxcy5wYXJzZSh3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHJpbmcoMSkpO1xuICAgIGlmIChwYXJhbXMuYWNjZXNzX3Rva2VuKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBib2R5OiBwYXJhbXMgfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAod2luZG93LmxvY2F0aW9uLnNlYXJjaCkge1xuICAgIHBhcmFtcyA9IHFzLnBhcnNlKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3Vic3RyaW5nKDEpKTtcbiAgICBpZiAocGFyYW1zLmVycm9yKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgYm9keTogcGFyYW1zIH07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICpcbiAqL1xuZXhwb3J0IHR5cGUgTG9naW5PcHRpb25zID0ge1xuICBzY29wZT86IHN0cmluZztcbiAgc2l6ZT86IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfTtcbn07XG5cbi8qKlxuICpcbiAqL1xuY29uc3QgREVGQVVMVF9QT1BVUF9XSU5fV0lEVEggPSA5MTI7XG5jb25zdCBERUZBVUxUX1BPUFVQX1dJTl9IRUlHSFQgPSA1MTM7XG5cbi8qKiBAcHJpdmF0ZSAqKi9cbmxldCBjbGllbnRJZHggPSAwO1xuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBjbGFzcyBCcm93c2VyQ2xpZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgX3ByZWZpeDogc3RyaW5nO1xuICBfY29uZmlnOiBDb25uZWN0aW9uQ29uZmlnIHwgdW5kZWZpbmVkO1xuICBfY29ubmVjdGlvbjogQ29ubmVjdGlvbiB8IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKHByZWZpeD86IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fcHJlZml4ID0gcHJlZml4IHx8ICdqc2ZvcmNlJyArIGNsaWVudElkeCsrO1xuICB9XG5cbiAgZ2V0IGNvbm5lY3Rpb24oKTogQ29ubmVjdGlvbiB7XG4gICAgaWYgKCF0aGlzLl9jb25uZWN0aW9uKSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uID0gbmV3IENvbm5lY3Rpb24odGhpcy5fY29uZmlnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3Rpb247XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGluaXQoY29uZmlnOiBDb25uZWN0aW9uQ29uZmlnKSB7XG4gICAgaWYgKGhhbmRsZUNhbGxiYWNrUmVzcG9uc2UoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9jb25maWcgPSBjb25maWc7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fZ2V0VG9rZW5zKCk7XG4gICAgaWYgKHRva2Vucykge1xuICAgICAgdGhpcy5jb25uZWN0aW9uLl9lc3RhYmxpc2godG9rZW5zKTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCB0aGlzLmNvbm5lY3Rpb24pO1xuICAgICAgfSwgMTApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgbG9naW4ob3B0aW9uczogTG9naW5PcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHNjb3BlLCBzaXplIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IG9hdXRoMiA9IG5ldyBPQXV0aDIodGhpcy5fY29uZmlnID8/IHt9KTtcbiAgICBjb25zdCByYW5kID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIpO1xuICAgIGNvbnN0IHN0YXRlID0gW3RoaXMuX3ByZWZpeCwgJ3BvcHVwJywgcmFuZF0uam9pbignLicpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdqc2ZvcmNlX3N0YXRlJywgc3RhdGUpO1xuICAgIGNvbnN0IGF1dGh6VXJsID0gb2F1dGgyLmdldEF1dGhvcml6YXRpb25Vcmwoe1xuICAgICAgcmVzcG9uc2VfdHlwZTogJ3Rva2VuJyxcbiAgICAgIHN0YXRlLFxuICAgICAgLi4uKHNjb3BlID8geyBzY29wZSB9IDoge30pLFxuICAgIH0pO1xuICAgIGNvbnN0IHB3ID0gcG9wdXBXaW4oXG4gICAgICBhdXRoelVybCxcbiAgICAgIHNpemU/LndpZHRoID8/IERFRkFVTFRfUE9QVVBfV0lOX1dJRFRILFxuICAgICAgc2l6ZT8uaGVpZ2h0ID8/IERFRkFVTFRfUE9QVVBfV0lOX0hFSUdIVCxcbiAgICApO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN0YXR1czogc3RyaW5nIH0+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghcHcpIHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBbdGhpcy5fcHJlZml4LCAncmVkaXJlY3QnLCByYW5kXS5qb2luKCcuJyk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdqc2ZvcmNlX3N0YXRlJywgc3RhdGUpO1xuICAgICAgICBjb25zdCBhdXRoelVybCA9IG9hdXRoMi5nZXRBdXRob3JpemF0aW9uVXJsKHtcbiAgICAgICAgICByZXNwb25zZV90eXBlOiAndG9rZW4nLFxuICAgICAgICAgIHN0YXRlLFxuICAgICAgICAgIC4uLihzY29wZSA/IHsgc2NvcGUgfSA6IHt9KSxcbiAgICAgICAgfSk7XG4gICAgICAgIGxvY2F0aW9uLmhyZWYgPSBhdXRoelVybDtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVtb3ZlVG9rZW5zKCk7XG4gICAgICBjb25zdCBwaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKCFwdyB8fCBwdy5jbG9zZWQpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocGlkKTtcbiAgICAgICAgICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2dldFRva2VucygpO1xuICAgICAgICAgICAgaWYgKHRva2Vucykge1xuICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb24uX2VzdGFibGlzaCh0b2tlbnMpO1xuICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCB0aGlzLmNvbm5lY3Rpb24pO1xuICAgICAgICAgICAgICByZXNvbHZlKHsgc3RhdHVzOiAnY29ubmVjdCcgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBlcnIgPSB0aGlzLl9nZXRFcnJvcigpO1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihlcnIuZXJyb3IgKyAnOiAnICsgZXJyLmVycm9yX2Rlc2NyaXB0aW9uKSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN0YXR1czogJ2NhbmNlbCcgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvL1xuICAgICAgICB9XG4gICAgICB9LCAxMDAwKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgaXNMb2dnZWRJbigpIHtcbiAgICByZXR1cm4gISF0aGlzLmNvbm5lY3Rpb24uYWNjZXNzVG9rZW47XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGxvZ291dCgpIHtcbiAgICB0aGlzLmNvbm5lY3Rpb24ubG9nb3V0KCk7XG4gICAgdGhpcy5fcmVtb3ZlVG9rZW5zKCk7XG4gICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0Jyk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRUb2tlbnMoKSB7XG4gICAgY29uc3QgcmVnZXhwID0gbmV3IFJlZ0V4cChcbiAgICAgICcoXnw7XFxcXHMqKScgKyB0aGlzLl9wcmVmaXggKyAnX2xvZ2dlZGluPXRydWUoO3wkKScsXG4gICAgKTtcbiAgICBpZiAoZG9jdW1lbnQuY29va2llLm1hdGNoKHJlZ2V4cCkpIHtcbiAgICAgIGNvbnN0IGlzc3VlZEF0ID0gTnVtYmVyKFxuICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLl9wcmVmaXggKyAnX2lzc3VlZF9hdCcpLFxuICAgICAgKTtcbiAgICAgIC8vIDIgaG91cnNcbiAgICAgIGlmIChEYXRlLm5vdygpIDwgaXNzdWVkQXQgKyAyICogNjAgKiA2MCAqIDEwMDApIHtcbiAgICAgICAgbGV0IHVzZXJJbmZvO1xuICAgICAgICBjb25zdCBpZFVybCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuX3ByZWZpeCArICdfaWQnKTtcbiAgICAgICAgaWYgKGlkVXJsKSB7XG4gICAgICAgICAgY29uc3QgW2lkLCBvcmdhbml6YXRpb25JZF0gPSBpZFVybC5zcGxpdCgnLycpLnJldmVyc2UoKTtcbiAgICAgICAgICB1c2VySW5mbyA9IHsgaWQsIG9yZ2FuaXphdGlvbklkLCB1cmw6IGlkVXJsIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBhY2Nlc3NUb2tlbjogbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy5fcHJlZml4ICsgJ19hY2Nlc3NfdG9rZW4nKSxcbiAgICAgICAgICBpbnN0YW5jZVVybDogbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy5fcHJlZml4ICsgJ19pbnN0YW5jZV91cmwnKSxcbiAgICAgICAgICB1c2VySW5mbyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zdG9yZVRva2VucyhwYXJhbXM6IFRva2VuUmVzcG9uc2UpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLl9wcmVmaXggKyAnX2FjY2Vzc190b2tlbicsIHBhcmFtcy5hY2Nlc3NfdG9rZW4pO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuX3ByZWZpeCArICdfaW5zdGFuY2VfdXJsJywgcGFyYW1zLmluc3RhbmNlX3VybCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5fcHJlZml4ICsgJ19pc3N1ZWRfYXQnLCBwYXJhbXMuaXNzdWVkX2F0KTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLl9wcmVmaXggKyAnX2lkJywgcGFyYW1zLmlkKTtcbiAgICBkb2N1bWVudC5jb29raWUgPSB0aGlzLl9wcmVmaXggKyAnX2xvZ2dlZGluPXRydWU7JztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3JlbW92ZVRva2VucygpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLl9wcmVmaXggKyAnX2FjY2Vzc190b2tlbicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRoaXMuX3ByZWZpeCArICdfaW5zdGFuY2VfdXJsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0odGhpcy5fcHJlZml4ICsgJ19pc3N1ZWRfYXQnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLl9wcmVmaXggKyAnX2lkJyk7XG4gICAgZG9jdW1lbnQuY29va2llID0gdGhpcy5fcHJlZml4ICsgJ19sb2dnZWRpbj0nO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0RXJyb3IoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVyciA9IEpTT04ucGFyc2UoXG4gICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuX3ByZWZpeCArICdfZXJyb3InKSA/PyAnJyxcbiAgICAgICk7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLl9wcmVmaXggKyAnX2Vycm9yJyk7XG4gICAgICByZXR1cm4gZXJyO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc3RvcmVFcnJvcihlcnI6IGFueSkge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuX3ByZWZpeCArICdfZXJyb3InLCBKU09OLnN0cmluZ2lmeShlcnIpKTtcbiAgfVxufVxuXG4vKipcbiAqXG4gKi9cbmNvbnN0IGNsaWVudCA9IG5ldyBCcm93c2VyQ2xpZW50KCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsaWVudDtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxZQUFBLEdBQUFDLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBRyxXQUFBLEdBQUFELHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBSSxNQUFBLEdBQUFGLHNCQUFBLENBQUFGLE9BQUE7QUFBa0QsU0FBQUssUUFBQUMsTUFBQSxFQUFBQyxjQUFBLFFBQUFDLElBQUEsR0FBQUMsWUFBQSxDQUFBSCxNQUFBLE9BQUFJLDZCQUFBLFFBQUFDLE9BQUEsR0FBQUQsNkJBQUEsQ0FB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