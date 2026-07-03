"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty2 = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.array.iterator");
_Object$defineProperty2(exports, "__esModule", {
  value: true
});
exports.registerModule = registerModule;
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/define-property"));
var _defineProperty3 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _events = require("events");
var _VERSION = _interopRequireDefault(require("./VERSION"));
var _connection = _interopRequireDefault(require("./connection"));
var _oauth = _interopRequireDefault(require("./oauth2"));
var _date = _interopRequireDefault(require("./date"));
var _registry = _interopRequireDefault(require("./registry"));
var _client = _interopRequireWildcard(require("./browser/client"));
var _jwtOAuth = require("./jwtOAuth2");
/**
 *
 */
class JSforce extends _events.EventEmitter {
  constructor(...args) {
    super(...args);
    (0, _defineProperty3.default)(this, "VERSION", _VERSION.default);
    (0, _defineProperty3.default)(this, "Connection", _connection.default);
    (0, _defineProperty3.default)(this, "OAuth2", _oauth.default);
    (0, _defineProperty3.default)(this, "JwtOAuth2", _jwtOAuth.JwtOAuth2);
    (0, _defineProperty3.default)(this, "SfDate", _date.default);
    (0, _defineProperty3.default)(this, "Date", _date.default);
    (0, _defineProperty3.default)(this, "BrowserClient", _client.BrowserClient);
    (0, _defineProperty3.default)(this, "registry", _registry.default);
    (0, _defineProperty3.default)(this, "browser", _client.default);
  }
}
function registerModule(name, factory) {
  jsforce.on('connection:new', conn => {
    let obj = undefined;
    (0, _defineProperty2.default)(conn, name, {
      get() {
        var _obj;
        obj = (_obj = obj) !== null && _obj !== void 0 ? _obj : factory(conn);
        return obj;
      },
      enumerable: true,
      configurable: true
    });
  });
}
const jsforce = new JSforce();
var _default = jsforce;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9WRVJTSU9OIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9jb25uZWN0aW9uIiwiX29hdXRoIiwiX2RhdGUiLCJfcmVnaXN0cnkiLCJfY2xpZW50IiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfand0T0F1dGgiLCJKU2ZvcmNlIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJhcmdzIiwiX2RlZmluZVByb3BlcnR5MyIsImRlZmF1bHQiLCJWRVJTSU9OIiwiQ29ubmVjdGlvbiIsIk9BdXRoMiIsIkp3dE9BdXRoMiIsIlNmRGF0ZSIsIkJyb3dzZXJDbGllbnQiLCJyZWdpc3RyeSIsImNsaWVudCIsInJlZ2lzdGVyTW9kdWxlIiwibmFtZSIsImZhY3RvcnkiLCJqc2ZvcmNlIiwib24iLCJjb25uIiwib2JqIiwidW5kZWZpbmVkIiwiX2RlZmluZVByb3BlcnR5MiIsImdldCIsIl9vYmoiLCJlbnVtZXJhYmxlIiwiY29uZmlndXJhYmxlIiwiX2RlZmF1bHQiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vc3JjL2pzZm9yY2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBWRVJTSU9OIGZyb20gJy4vVkVSU0lPTic7XG5pbXBvcnQgQ29ubmVjdGlvbiBmcm9tICcuL2Nvbm5lY3Rpb24nO1xuaW1wb3J0IE9BdXRoMiBmcm9tICcuL29hdXRoMic7XG5pbXBvcnQgU2ZEYXRlIGZyb20gJy4vZGF0ZSc7XG5pbXBvcnQgcmVnaXN0cnksIHsgUmVnaXN0cnkgfSBmcm9tICcuL3JlZ2lzdHJ5JztcbmltcG9ydCBjbGllbnQsIHsgQnJvd3NlckNsaWVudCB9IGZyb20gJy4vYnJvd3Nlci9jbGllbnQnO1xuaW1wb3J0IHsgSnd0T0F1dGgyIH0gZnJvbSAnLi9qd3RPQXV0aDInO1xuXG4vKipcbiAqXG4gKi9cbmNsYXNzIEpTZm9yY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBWRVJTSU9OOiB0eXBlb2YgVkVSU0lPTiA9IFZFUlNJT047XG4gIENvbm5lY3Rpb246IHR5cGVvZiBDb25uZWN0aW9uID0gQ29ubmVjdGlvbjtcbiAgT0F1dGgyOiB0eXBlb2YgT0F1dGgyID0gT0F1dGgyO1xuICBKd3RPQXV0aDI6IHR5cGVvZiBKd3RPQXV0aDIgPSBKd3RPQXV0aDI7XG4gIFNmRGF0ZTogdHlwZW9mIFNmRGF0ZSA9IFNmRGF0ZTtcbiAgRGF0ZTogdHlwZW9mIFNmRGF0ZSA9IFNmRGF0ZTtcbiAgQnJvd3NlckNsaWVudDogdHlwZW9mIEJyb3dzZXJDbGllbnQgPSBCcm93c2VyQ2xpZW50O1xuICByZWdpc3RyeTogUmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgYnJvd3NlcjogQnJvd3NlckNsaWVudCA9IGNsaWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyTW9kdWxlKFxuICBuYW1lOiBzdHJpbmcsXG4gIGZhY3Rvcnk6IChjb25uOiBDb25uZWN0aW9uKSA9PiBhbnksXG4pIHtcbiAganNmb3JjZS5vbignY29ubmVjdGlvbjpuZXcnLCAoY29ubjogQ29ubmVjdGlvbikgPT4ge1xuICAgIGxldCBvYmo6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29ubiwgbmFtZSwge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBvYmogPSBvYmogPz8gZmFjdG9yeShjb25uKTtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIH0pO1xuICB9KTtcbn1cblxuY29uc3QganNmb3JjZSA9IG5ldyBKU2ZvcmNlKCk7XG5leHBvcnQgZGVmYXVsdCBqc2ZvcmNlO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsUUFBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsV0FBQSxHQUFBRCxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUksTUFBQSxHQUFBRixzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUssS0FBQSxHQUFBSCxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQU0sU0FBQSxHQUFBSixzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQU8sT0FBQSxHQUFBQyx1QkFBQSxDQUFBUixPQUFBO0FBQ0EsSUFBQVMsU0FBQSxHQUFBVCxPQUFBO0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTVUsT0FBTyxTQUFTQyxvQkFBWSxDQUFDO0VBQUFDLFlBQUEsR0FBQUMsSUFBQTtJQUFBLFNBQUFBLElBQUE7SUFBQSxJQUFBQyxnQkFBQSxDQUFBQyxPQUFBLG1CQUNQQyxnQkFBTztJQUFBLElBQUFGLGdCQUFBLENBQUFDLE9BQUEsc0JBQ0RFLG1CQUFVO0lBQUEsSUFBQUgsZ0JBQUEsQ0FBQUMsT0FBQSxrQkFDbEJHLGNBQU07SUFBQSxJQUFBSixnQkFBQSxDQUFBQyxPQUFBLHFCQUNBSSxtQkFBUztJQUFBLElBQUFMLGdCQUFBLENBQUFDLE9BQUEsa0JBQ2ZLLGFBQU07SUFBQSxJQUFBTixnQkFBQSxDQUFBQyxPQUFBLGdCQUNSSyxhQUFNO0lBQUEsSUFBQU4sZ0JBQUEsQ0FBQUMsT0FBQSx5QkFDVU0scUJBQWE7SUFBQSxJQUFBUCxnQkFBQSxDQUFBQyxPQUFBLG9CQUM5Qk8saUJBQVE7SUFBQSxJQUFBUixnQkFBQSxDQUFBQyxPQUFBLG1CQUNKUSxlQUFNO0VBQUE7QUFDakM7QUFFTyxTQUFTQyxjQUFjQSxDQUM1QkMsSUFBWSxFQUNaQyxPQUFrQyxFQUNsQztFQUNBQyxPQUFPLENBQUNDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBR0MsSUFBZ0IsSUFBSztJQUNqRCxJQUFJQyxHQUFRLEdBQUdDLFNBQVM7SUFDeEIsSUFBQUMsZ0JBQUEsQ0FBQWpCLE9BQUEsRUFBc0JjLElBQUksRUFBRUosSUFBSSxFQUFFO01BQ2hDUSxHQUFHQSxDQUFBLEVBQUc7UUFBQSxJQUFBQyxJQUFBO1FBQ0pKLEdBQUcsSUFBQUksSUFBQSxHQUFHSixHQUFHLGNBQUFJLElBQUEsY0FBQUEsSUFBQSxHQUFJUixPQUFPLENBQUNHLElBQUksQ0FBQztRQUMxQixPQUFPQyxHQUFHO01BQ1osQ0FBQztNQUNESyxVQUFVLEVBQUUsSUFBSTtNQUNoQkMsWUFBWSxFQUFFO0lBQ2hCLENBQUMsQ0FBQztFQUNKLENBQUMsQ0FBQztBQUNKO0FBRUEsTUFBTVQsT0FBTyxHQUFHLElBQUlqQixPQUFPLENBQUMsQ0FBQztBQUFDLElBQUEyQixRQUFBLEdBQ2ZWLE9BQU87QUFBQVcsT0FBQSxDQUFBdkIsT0FBQSxHQUFBc0IsUUFBQSJ9