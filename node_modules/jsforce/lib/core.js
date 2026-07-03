"use strict";

var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _context, _context2, _context3, _context4, _context5, _context6, _context7;
var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  Date: true,
  SfDate: true,
  registry: true,
  browser: true,
  BrowserClient: true,
  VERSION: true,
  RecordReference: true,
  RecordStream: true
};
_Object$defineProperty(exports, "Date", {
  enumerable: true,
  get: function () {
    return _date.default;
  }
});
_Object$defineProperty(exports, "SfDate", {
  enumerable: true,
  get: function () {
    return _date.default;
  }
});
_Object$defineProperty(exports, "registry", {
  enumerable: true,
  get: function () {
    return _registry.default;
  }
});
_Object$defineProperty(exports, "browser", {
  enumerable: true,
  get: function () {
    return _client.default;
  }
});
_Object$defineProperty(exports, "BrowserClient", {
  enumerable: true,
  get: function () {
    return _client.BrowserClient;
  }
});
_Object$defineProperty(exports, "VERSION", {
  enumerable: true,
  get: function () {
    return _VERSION.default;
  }
});
_Object$defineProperty(exports, "RecordReference", {
  enumerable: true,
  get: function () {
    return _recordReference.default;
  }
});
_Object$defineProperty(exports, "RecordStream", {
  enumerable: true,
  get: function () {
    return _recordStream.default;
  }
});
exports.default = void 0;
var _jsforce = _interopRequireDefault(require("./jsforce"));
var _date = _interopRequireDefault(require("./date"));
var _registry = _interopRequireDefault(require("./registry"));
var _client = _interopRequireWildcard(require("./browser/client"));
var _VERSION = _interopRequireDefault(require("./VERSION"));
var _recordReference = _interopRequireDefault(require("./record-reference"));
var _recordStream = _interopRequireDefault(require("./record-stream"));
var _oauth = require("./oauth2");
_forEachInstanceProperty(_context = _Object$keys(_oauth)).call(_context, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _oauth[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _oauth[key];
    }
  });
});
var _jwtOAuth = require("./jwtOAuth2");
_forEachInstanceProperty(_context2 = _Object$keys(_jwtOAuth)).call(_context2, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _jwtOAuth[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _jwtOAuth[key];
    }
  });
});
var _connection = require("./connection");
_forEachInstanceProperty(_context3 = _Object$keys(_connection)).call(_context3, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _connection[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _connection[key];
    }
  });
});
var _query = require("./query");
_forEachInstanceProperty(_context4 = _Object$keys(_query)).call(_context4, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _query[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _query[key];
    }
  });
});
var _quickAction = require("./quick-action");
_forEachInstanceProperty(_context5 = _Object$keys(_quickAction)).call(_context5, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _quickAction[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _quickAction[key];
    }
  });
});
var _sobject = require("./sobject");
_forEachInstanceProperty(_context6 = _Object$keys(_sobject)).call(_context6, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _sobject[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _sobject[key];
    }
  });
});
var _types = require("./types");
_forEachInstanceProperty(_context7 = _Object$keys(_types)).call(_context7, function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _types[key]) return;
  _Object$defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _types[key];
    }
  });
});
var _default = _jsforce.default;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfanNmb3JjZSIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJyZXF1aXJlIiwiX2RhdGUiLCJfcmVnaXN0cnkiLCJfY2xpZW50IiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfVkVSU0lPTiIsIl9yZWNvcmRSZWZlcmVuY2UiLCJfcmVjb3JkU3RyZWFtIiwiX29hdXRoIiwiX2ZvckVhY2hJbnN0YW5jZVByb3BlcnR5IiwiX2NvbnRleHQiLCJfT2JqZWN0JGtleXMiLCJjYWxsIiwia2V5IiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJfZXhwb3J0TmFtZXMiLCJleHBvcnRzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiLCJnZXQiLCJfand0T0F1dGgiLCJfY29udGV4dDIiLCJfY29ubmVjdGlvbiIsIl9jb250ZXh0MyIsIl9xdWVyeSIsIl9jb250ZXh0NCIsIl9xdWlja0FjdGlvbiIsIl9jb250ZXh0NSIsIl9zb2JqZWN0IiwiX2NvbnRleHQ2IiwiX3R5cGVzIiwiX2NvbnRleHQ3IiwiX2RlZmF1bHQiLCJqc2ZvcmNlIiwiZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9jb3JlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBqc2ZvcmNlIGZyb20gJy4vanNmb3JjZSc7XG5pbXBvcnQgU2ZEYXRlIGZyb20gJy4vZGF0ZSc7XG5pbXBvcnQgcmVnaXN0cnksIHsgUmVnaXN0cnkgfSBmcm9tICcuL3JlZ2lzdHJ5JztcbmltcG9ydCBicm93c2VyLCB7IEJyb3dzZXJDbGllbnQgfSBmcm9tICcuL2Jyb3dzZXIvY2xpZW50JztcbmltcG9ydCBWRVJTSU9OIGZyb20gJy4vVkVSU0lPTic7XG5cbmltcG9ydCBSZWNvcmRSZWZlcmVuY2UgZnJvbSAnLi9yZWNvcmQtcmVmZXJlbmNlJztcbmltcG9ydCBSZWNvcmRTdHJlYW0gZnJvbSAnLi9yZWNvcmQtc3RyZWFtJztcblxuZXhwb3J0ICogZnJvbSAnLi9vYXV0aDInO1xuZXhwb3J0ICogZnJvbSAnLi9qd3RPQXV0aDInO1xuZXhwb3J0ICogZnJvbSAnLi9jb25uZWN0aW9uJztcbmV4cG9ydCAqIGZyb20gJy4vcXVlcnknO1xuZXhwb3J0ICogZnJvbSAnLi9xdWljay1hY3Rpb24nO1xuZXhwb3J0ICogZnJvbSAnLi9zb2JqZWN0JztcblxuZXhwb3J0ICogZnJvbSAnLi90eXBlcyc7XG5leHBvcnQge1xuICBWRVJTSU9OLFxuICBTZkRhdGUgYXMgRGF0ZSxcbiAgU2ZEYXRlLFxuICBCcm93c2VyQ2xpZW50LFxuICBSZWNvcmRSZWZlcmVuY2UsXG4gIFJlY29yZFN0cmVhbSxcbiAgcmVnaXN0cnksXG4gIGJyb3dzZXIsXG59O1xuZXhwb3J0IHR5cGUgeyBSZWdpc3RyeSB9O1xuZXhwb3J0IGRlZmF1bHQganNmb3JjZTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUFBLFFBQUEsR0FBQUMsc0JBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFDLEtBQUEsR0FBQUYsc0JBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFFLFNBQUEsR0FBQUgsc0JBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFHLE9BQUEsR0FBQUMsdUJBQUEsQ0FBQUosT0FBQTtBQUNBLElBQUFLLFFBQUEsR0FBQU4sc0JBQUEsQ0FBQUMsT0FBQTtBQUVBLElBQUFNLGdCQUFBLEdBQUFQLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBTyxhQUFBLEdBQUFSLHNCQUFBLENBQUFDLE9BQUE7QUFFQSxJQUFBUSxNQUFBLEdBQUFSLE9BQUE7QUFBQVMsd0JBQUEsQ0FBQUMsUUFBQSxHQUFBQyxZQUFBLENBQUFILE1BQUEsR0FBQUksSUFBQSxDQUFBRixRQUFBLFlBQUFHLEdBQUE7RUFBQSxJQUFBQSxHQUFBLGtCQUFBQSxHQUFBO0VBQUEsSUFBQUMsTUFBQSxDQUFBQyxTQUFBLENBQUFDLGNB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