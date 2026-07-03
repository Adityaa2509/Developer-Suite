"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty2 = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
require("core-js/modules/es.string.replace");
_Object$defineProperty2(exports, "__esModule", {
  value: true
});
exports.default = exports.Repl = void 0;
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _getPrototypeOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/get-prototype-of"));
var _getOwnPropertyNames = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-names"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _filter = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/filter"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _defineProperty3 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/define-property"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _concat = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/concat"));
var _events = require("events");
var _repl = require("repl");
var _stream = require("stream");
var _ = _interopRequireDefault(require(".."));
var _function = require("../util/function");
/**
 * @file Creates REPL interface with built in Salesforce API objects and automatically resolves promise object
 * @author Shinichi Tomita <shinichi.tomita@gmail.com>
 * @private
 */

/**
 * Intercept the evaled value returned from repl evaluator, convert and send back to output.
 * @private
 */
function injectBefore(replServer, method, beforeFn) {
  const _orig = replServer[method];
  replServer[method] = (...args) => {
    const callback = args.pop();
    beforeFn.apply(null, (0, _concat.default)(args).call(args, (err, res) => {
      if (err || res) {
        callback(err, res);
      } else {
        _orig.apply(replServer, (0, _concat.default)(args).call(args, callback));
      }
    }));
  };
  return replServer;
}

/**
 * @private
 */
function injectAfter(replServer, method, afterFn) {
  const _orig = replServer[method];
  replServer[method] = (...args) => {
    const callback = args.pop();
    _orig.apply(replServer, (0, _concat.default)(args).call(args, (...args) => {
      try {
        afterFn.apply(null, (0, _concat.default)(args).call(args, callback));
      } catch (e) {
        callback(e);
      }
    }));
  };
  return replServer;
}

/**
 * When the result was "promise", resolve its value
 * @private
 */
function promisify(err, value, callback) {
  // callback immediately if no value passed
  if (!callback && (0, _function.isFunction)(value)) {
    callback = value;
    return callback();
  }
  if (err) {
    throw err;
  }
  if ((0, _function.isPromiseLike)(value)) {
    value.then(v => {
      callback(null, v);
    }, err => {
      callback(err);
    });
  } else {
    callback(null, value);
  }
}

/**
 * Output object to stdout in JSON representation
 * @private
 */
function outputToStdout(prettyPrint) {
  if (prettyPrint && !(0, _function.isNumber)(prettyPrint)) {
    prettyPrint = 4;
  }
  return (err, value, callback) => {
    if (err) {
      console.error(err);
    } else {
      const str = (0, _stringify.default)(value, null, prettyPrint);
      console.log(str);
    }
    callback(err, value);
  };
}

/**
 * define get accessor using Object.defineProperty
 * @private
 */
function defineProp(obj, prop, getter) {
  if (_defineProperty3.default) {
    (0, _defineProperty3.default)(obj, prop, {
      get: getter
    });
  }
}

/**
 *
 */
class Repl {
  constructor(cli) {
    (0, _defineProperty2.default)(this, "_cli", void 0);
    (0, _defineProperty2.default)(this, "_in", void 0);
    (0, _defineProperty2.default)(this, "_out", void 0);
    (0, _defineProperty2.default)(this, "_interactive", true);
    (0, _defineProperty2.default)(this, "_paused", false);
    (0, _defineProperty2.default)(this, "_replServer", undefined);
    this._cli = cli;
    this._in = new _stream.Transform();
    this._out = new _stream.Transform();
    this._in._transform = (chunk, encoding, callback) => {
      if (!this._paused) {
        this._in.push(chunk);
      }
      callback();
    };
    this._out._transform = (chunk, encoding, callback) => {
      if (!this._paused && this._interactive !== false) {
        this._out.push(chunk);
      }
      callback();
    };
  }

  /**
   *
   */
  start(options = {}) {
    this._interactive = options.interactive !== false;
    process.stdin.resume();
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.pipe(this._in);
    this._out.pipe(process.stdout);
    defineProp(this._out, 'columns', () => process.stdout.columns);
    this._replServer = (0, _repl.start)({
      input: this._in,
      output: this._out,
      terminal: true
    });
    this._defineAdditionalCommands();
    this._replServer = injectBefore(this._replServer, 'completer', (line, callback) => {
      this.complete(line).then(rets => {
        callback(null, rets);
      }).catch(err => {
        callback(err);
      });
    });
    this._replServer = injectAfter(this._replServer, 'eval', promisify);
    if (options.interactive === false) {
      this._replServer = injectAfter(this._replServer, 'eval', outputToStdout(options.prettyPrint));
      this._replServer = injectAfter(this._replServer, 'eval', function () {
        process.exit();
      });
    }
    this._replServer.on('exit', () => process.exit());
    this._defineBuiltinVars(this._replServer.context);
    if (options.evalScript) {
      this._in.write(options.evalScript + '\n', 'utf-8');
    }
    return this;
  }

  /**
   *
   */
  _defineAdditionalCommands() {
    const cli = this._cli;
    const replServer = this._replServer;
    if (!replServer) {
      return;
    }
    replServer.defineCommand('connections', {
      help: 'List currenty registered Salesforce connections',
      action: async () => {
        await cli.listConnections();
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('connect', {
      help: 'Connect to Salesforce instance',
      action: async (...args) => {
        const [name, password] = args;
        const params = password ? {
          connection: name,
          username: name,
          password: password
        } : {
          connection: name,
          username: name
        };
        try {
          await cli.connect(params);
        } catch (err) {
          if (err instanceof Error) {
            console.error(err.message);
          }
        }
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('disconnect', {
      help: 'Disconnect connection and erase it from registry',
      action: name => {
        cli.disconnect(name);
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('use', {
      help: 'Specify login server to establish connection',
      action: loginServer => {
        cli.setLoginServer(loginServer);
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('authorize', {
      help: 'Connect to Salesforce using OAuth2 authorization flow',
      action: async clientName => {
        try {
          await cli.authorize(clientName);
        } catch (err) {
          if (err instanceof Error) {
            console.error(err.message);
          }
        }
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('register', {
      help: 'Register OAuth2 client information',
      action: async (...args) => {
        const [clientName, clientId, clientSecret, redirectUri, loginUrl] = args;
        const config = {
          clientId,
          clientSecret,
          redirectUri,
          loginUrl
        };
        try {
          await cli.register(clientName, config);
        } catch (err) {
          if (err instanceof Error) {
            console.error(err.message);
          }
        }
        replServer.displayPrompt();
      }
    });
    replServer.defineCommand('open', {
      help: 'Open Salesforce web page using established connection',
      action: url => {
        cli.openUrlUsingSession(url);
        replServer.displayPrompt();
      }
    });
  }

  /**
   *
   */
  pause() {
    this._paused = true;
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
  }

  /**
   *
   */
  resume() {
    this._paused = false;
    process.stdin.resume();
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
  }

  /**
   *
   */
  async complete(line) {
    const tokens = line.replace(/^\s+/, '').split(/\s+/);
    const [command, keyword = ''] = tokens;
    if (command[0] === '.' && tokens.length === 2) {
      let candidates = [];
      if (command === '.connect' || command === '.disconnect') {
        candidates = await this._cli.getConnectionNames();
      } else if (command === '.authorize') {
        candidates = await this._cli.getClientNames();
      } else if (command === '.use') {
        candidates = ['production', 'sandbox'];
      }
      candidates = (0, _filter.default)(candidates).call(candidates, name => (0, _indexOf.default)(name).call(name, keyword) === 0);
      return [candidates, keyword];
    }
  }

  /**
   * Map all jsforce object to REPL context
   * @private
   */
  _defineBuiltinVars(context) {
    const cli = this._cli;

    // define salesforce package root objects
    for (const key in _.default) {
      if (Object.prototype.hasOwnProperty.call(_.default, key) && !global[key]) {
        context[key] = _.default[key];
      }
    }
    // expose jsforce package root object in context.
    context.jsforce = _.default;
    function createProxyFunc(prop) {
      return (...args) => {
        const conn = cli.getCurrentConnection();
        return conn[prop](...args);
      };
    }
    function createProxyAccessor(prop) {
      return () => {
        const conn = cli.getCurrentConnection();
        return conn[prop];
      };
    }
    const conn = cli.getCurrentConnection();
    // list all props in connection instance, other than EventEmitter or object built-in methods
    const props = {};
    let o = conn;
    while (o && o !== _events.EventEmitter.prototype && o !== Object.prototype) {
      for (const p of (0, _getOwnPropertyNames.default)(o)) {
        if (p !== 'constructor') {
          props[p] = true;
        }
      }
      o = (0, _getPrototypeOf.default)(o);
    }
    for (const prop of (0, _keys.default)(props)) {
      if (typeof global[prop] !== 'undefined') {
        // avoid global override
        continue;
      }
      if ((0, _indexOf.default)(prop).call(prop, '_') === 0) {
        // ignore private
        continue;
      }
      if ((0, _function.isFunction)(conn[prop])) {
        context[prop] = createProxyFunc(prop);
      } else if ((0, _function.isObject)(conn[prop])) {
        defineProp(context, prop, createProxyAccessor(prop));
      }
    }

    // expose default connection as "$conn"
    defineProp(context, '$conn', () => {
      return cli.getCurrentConnection();
    });
  }
}
exports.Repl = Repl;
var _default = Repl;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9yZXBsIiwiX3N0cmVhbSIsIl8iLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX2Z1bmN0aW9uIiwiaW5qZWN0QmVmb3JlIiwicmVwbFNlcnZlciIsIm1ldGhvZCIsImJlZm9yZUZuIiwiX29yaWciLCJhcmdzIiwiY2FsbGJhY2siLCJwb3AiLCJhcHBseSIsIl9jb25jYXQiLCJkZWZhdWx0IiwiY2FsbCIsImVyciIsInJlcyIsImluamVjdEFmdGVyIiwiYWZ0ZXJGbiIsImUiLCJwcm9taXNpZnkiLCJ2YWx1ZSIsImlzRnVuY3Rpb24iLCJpc1Byb21pc2VMaWtlIiwidGhlbiIsInYiLCJvdXRwdXRUb1N0ZG91dCIsInByZXR0eVByaW50IiwiaXNOdW1iZXIiLCJjb25zb2xlIiwiZXJyb3IiLCJzdHIiLCJfc3RyaW5naWZ5IiwibG9nIiwiZGVmaW5lUHJvcCIsIm9iaiIsInByb3AiLCJnZXR0ZXIiLCJfZGVmaW5lUHJvcGVydHkzIiwiZ2V0IiwiUmVwbCIsImNvbnN0cnVjdG9yIiwiY2xpIiwiX2RlZmluZVByb3BlcnR5MiIsInVuZGVmaW5lZCIsIl9jbGkiLCJfaW4iLCJUcmFuc2Zvcm0iLCJfb3V0IiwiX3RyYW5zZm9ybSIsImNodW5rIiwiZW5jb2RpbmciLCJfcGF1c2VkIiwicHVzaCIsIl9pbnRlcmFjdGl2ZSIsInN0YXJ0Iiwib3B0aW9ucyIsImludGVyYWN0aXZlIiwicHJvY2VzcyIsInN0ZGluIiwicmVzdW1lIiwic2V0UmF3TW9kZSIsInBpcGUiLCJzdGRvdXQiLCJjb2x1bW5zIiwiX3JlcGxTZXJ2ZXIiLCJzdGFydFJlcGwiLCJpbnB1dCIsIm91dHB1dCIsInRlcm1pbmFsIiwiX2RlZmluZUFkZGl0aW9uYWxDb21tYW5kcyIsImxpbmUiLCJjb21wbGV0ZSIsInJldHMiLCJjYXRjaCIsImV4aXQiLCJvbiIsIl9kZWZpbmVCdWlsdGluVmFycyIsImNvbnRleHQiLCJldmFsU2NyaXB0Iiwid3JpdGUiLCJkZWZpbmVDb21tYW5kIiwiaGVscCIsImFjdGlvbiIsImxpc3RDb25uZWN0aW9ucyIsImRpc3BsYXlQcm9tcHQiLCJuYW1lIiwicGFzc3dvcmQiLCJwYXJhbXMiLCJjb25uZWN0aW9uIiwidXNlcm5hbWUiLCJjb25uZWN0IiwiRXJyb3IiLCJtZXNzYWdlIiwiZGlzY29ubmVjdCIsImxvZ2luU2VydmVyIiwic2V0TG9naW5TZXJ2ZXIiLCJjbGllbnROYW1lIiwiYXV0aG9yaXplIiwiY2xpZW50SWQiLCJjbGllbnRTZWNyZXQiLCJyZWRpcmVjdFVyaSIsImxvZ2luVXJsIiwiY29uZmlnIiwicmVnaXN0ZXIiLCJ1cmwiLCJvcGVuVXJsVXNpbmdTZXNzaW9uIiwicGF1c2UiLCJ0b2tlbnMiLCJyZXBsYWNlIiwic3BsaXQiLCJjb21tYW5kIiwia2V5d29yZCIsImxlbmd0aCIsImNhbmRpZGF0ZXMiLCJnZXRDb25uZWN0aW9uTmFtZXMiLCJnZXRDbGllbnROYW1lcyIsIl9maWx0ZXIiLCJfaW5kZXhPZiIsImtleSIsImpzZm9yY2UiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImdsb2JhbCIsImNyZWF0ZVByb3h5RnVuYyIsImNvbm4iLCJnZXRDdXJyZW50Q29ubmVjdGlvbiIsImNyZWF0ZVByb3h5QWNjZXNzb3IiLCJwcm9wcyIsIm8iLCJFdmVudEVtaXR0ZXIiLCJwIiwiX2dldE93blByb3BlcnR5TmFtZXMiLCJfZ2V0UHJvdG90eXBlT2YiLCJfa2V5cyIsImlzT2JqZWN0IiwiZXhwb3J0cyIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NsaS9yZXBsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgQ3JlYXRlcyBSRVBMIGludGVyZmFjZSB3aXRoIGJ1aWx0IGluIFNhbGVzZm9yY2UgQVBJIG9iamVjdHMgYW5kIGF1dG9tYXRpY2FsbHkgcmVzb2x2ZXMgcHJvbWlzZSBvYmplY3RcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICogQHByaXZhdGVcbiAqL1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IFJFUExTZXJ2ZXIsIHN0YXJ0IGFzIHN0YXJ0UmVwbCB9IGZyb20gJ3JlcGwnO1xuaW1wb3J0IHsgVHJhbnNmb3JtIH0gZnJvbSAnc3RyZWFtJztcbmltcG9ydCBqc2ZvcmNlIGZyb20gJy4uJztcbmltcG9ydCB7XG4gIGlzUHJvbWlzZUxpa2UsXG4gIGlzTnVtYmVyLFxuICBpc0Z1bmN0aW9uLFxuICBpc09iamVjdCxcbn0gZnJvbSAnLi4vdXRpbC9mdW5jdGlvbic7XG5pbXBvcnQgeyBDbGkgfSBmcm9tICcuL2NsaSc7XG5cbi8qKlxuICogSW50ZXJjZXB0IHRoZSBldmFsZWQgdmFsdWUgcmV0dXJuZWQgZnJvbSByZXBsIGV2YWx1YXRvciwgY29udmVydCBhbmQgc2VuZCBiYWNrIHRvIG91dHB1dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGluamVjdEJlZm9yZShcbiAgcmVwbFNlcnZlcjogUkVQTFNlcnZlcixcbiAgbWV0aG9kOiBzdHJpbmcsXG4gIGJlZm9yZUZuOiBGdW5jdGlvbixcbikge1xuICBjb25zdCBfb3JpZzogRnVuY3Rpb24gPSAocmVwbFNlcnZlciBhcyBhbnkpW21ldGhvZF07XG4gIChyZXBsU2VydmVyIGFzIGFueSlbbWV0aG9kXSA9ICguLi5hcmdzOiBhbnlbXSkgPT4ge1xuICAgIGNvbnN0IGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICBiZWZvcmVGbi5hcHBseShcbiAgICAgIG51bGwsXG4gICAgICBhcmdzLmNvbmNhdCgoZXJyOiBhbnksIHJlczogYW55KSA9PiB7XG4gICAgICAgIGlmIChlcnIgfHwgcmVzKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyLCByZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9vcmlnLmFwcGx5KHJlcGxTZXJ2ZXIsIGFyZ3MuY29uY2F0KGNhbGxiYWNrKSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH07XG4gIHJldHVybiByZXBsU2VydmVyO1xufVxuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGluamVjdEFmdGVyKFxuICByZXBsU2VydmVyOiBSRVBMU2VydmVyLFxuICBtZXRob2Q6IHN0cmluZyxcbiAgYWZ0ZXJGbjogRnVuY3Rpb24sXG4pIHtcbiAgY29uc3QgX29yaWc6IEZ1bmN0aW9uID0gKHJlcGxTZXJ2ZXIgYXMgYW55KVttZXRob2RdO1xuICAocmVwbFNlcnZlciBhcyBhbnkpW21ldGhvZF0gPSAoLi4uYXJnczogYW55W10pID0+IHtcbiAgICBjb25zdCBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgX29yaWcuYXBwbHkoXG4gICAgICByZXBsU2VydmVyLFxuICAgICAgYXJncy5jb25jYXQoKC4uLmFyZ3M6IGFueVtdKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYWZ0ZXJGbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChjYWxsYmFjaykpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH07XG4gIHJldHVybiByZXBsU2VydmVyO1xufVxuXG4vKipcbiAqIFdoZW4gdGhlIHJlc3VsdCB3YXMgXCJwcm9taXNlXCIsIHJlc29sdmUgaXRzIHZhbHVlXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBwcm9taXNpZnkoXG4gIGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLFxuICB2YWx1ZTogYW55LFxuICBjYWxsYmFjazogRnVuY3Rpb24sXG4pIHtcbiAgLy8gY2FsbGJhY2sgaW1tZWRpYXRlbHkgaWYgbm8gdmFsdWUgcGFzc2VkXG4gIGlmICghY2FsbGJhY2sgJiYgaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICBjYWxsYmFjayA9IHZhbHVlO1xuICAgIHJldHVybiBjYWxsYmFjaygpO1xuICB9XG4gIGlmIChlcnIpIHtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbiAgaWYgKGlzUHJvbWlzZUxpa2UodmFsdWUpKSB7XG4gICAgdmFsdWUudGhlbihcbiAgICAgICh2OiBhbnkpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdik7XG4gICAgICB9LFxuICAgICAgKGVycjogYW55KSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9LFxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgY2FsbGJhY2sobnVsbCwgdmFsdWUpO1xuICB9XG59XG5cbi8qKlxuICogT3V0cHV0IG9iamVjdCB0byBzdGRvdXQgaW4gSlNPTiByZXByZXNlbnRhdGlvblxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gb3V0cHV0VG9TdGRvdXQocHJldHR5UHJpbnQ/OiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgaWYgKHByZXR0eVByaW50ICYmICFpc051bWJlcihwcmV0dHlQcmludCkpIHtcbiAgICBwcmV0dHlQcmludCA9IDQ7XG4gIH1cbiAgcmV0dXJuIChlcnI6IGFueSwgdmFsdWU6IGFueSwgY2FsbGJhY2s6IEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzdHIgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgcHJldHR5UHJpbnQpO1xuICAgICAgY29uc29sZS5sb2coc3RyKTtcbiAgICB9XG4gICAgY2FsbGJhY2soZXJyLCB2YWx1ZSk7XG4gIH07XG59XG5cbi8qKlxuICogZGVmaW5lIGdldCBhY2Nlc3NvciB1c2luZyBPYmplY3QuZGVmaW5lUHJvcGVydHlcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGRlZmluZVByb3Aob2JqOiBPYmplY3QsIHByb3A6IHN0cmluZywgZ2V0dGVyOiAoKSA9PiBhbnkpIHtcbiAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIHsgZ2V0OiBnZXR0ZXIgfSk7XG4gIH1cbn1cblxuLyoqXG4gKlxuICovXG5leHBvcnQgY2xhc3MgUmVwbCB7XG4gIF9jbGk6IENsaTtcbiAgX2luOiBUcmFuc2Zvcm07XG4gIF9vdXQ6IFRyYW5zZm9ybTtcbiAgX2ludGVyYWN0aXZlOiBib29sZWFuID0gdHJ1ZTtcbiAgX3BhdXNlZDogYm9vbGVhbiA9IGZhbHNlO1xuICBfcmVwbFNlcnZlcjogUkVQTFNlcnZlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihjbGk6IENsaSkge1xuICAgIHRoaXMuX2NsaSA9IGNsaTtcbiAgICB0aGlzLl9pbiA9IG5ldyBUcmFuc2Zvcm0oKTtcbiAgICB0aGlzLl9vdXQgPSBuZXcgVHJhbnNmb3JtKCk7XG4gICAgdGhpcy5faW4uX3RyYW5zZm9ybSA9IChjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuX3BhdXNlZCkge1xuICAgICAgICB0aGlzLl9pbi5wdXNoKGNodW5rKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfTtcbiAgICB0aGlzLl9vdXQuX3RyYW5zZm9ybSA9IChjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuX3BhdXNlZCAmJiB0aGlzLl9pbnRlcmFjdGl2ZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5fb3V0LnB1c2goY2h1bmspO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2soKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBzdGFydChcbiAgICBvcHRpb25zOiB7XG4gICAgICBpbnRlcmFjdGl2ZT86IGJvb2xlYW47XG4gICAgICBwcmV0dHlQcmludD86IHN0cmluZyB8IG51bWJlcjtcbiAgICAgIGV2YWxTY3JpcHQ/OiBzdHJpbmc7XG4gICAgfSA9IHt9LFxuICApIHtcbiAgICB0aGlzLl9pbnRlcmFjdGl2ZSA9IG9wdGlvbnMuaW50ZXJhY3RpdmUgIT09IGZhbHNlO1xuXG4gICAgcHJvY2Vzcy5zdGRpbi5yZXN1bWUoKTtcbiAgICBpZiAocHJvY2Vzcy5zdGRpbi5zZXRSYXdNb2RlKSB7XG4gICAgICBwcm9jZXNzLnN0ZGluLnNldFJhd01vZGUodHJ1ZSk7XG4gICAgfVxuICAgIHByb2Nlc3Muc3RkaW4ucGlwZSh0aGlzLl9pbik7XG5cbiAgICB0aGlzLl9vdXQucGlwZShwcm9jZXNzLnN0ZG91dCk7XG5cbiAgICBkZWZpbmVQcm9wKHRoaXMuX291dCwgJ2NvbHVtbnMnLCAoKSA9PiBwcm9jZXNzLnN0ZG91dC5jb2x1bW5zKTtcblxuICAgIHRoaXMuX3JlcGxTZXJ2ZXIgPSBzdGFydFJlcGwoe1xuICAgICAgaW5wdXQ6IHRoaXMuX2luLFxuICAgICAgb3V0cHV0OiB0aGlzLl9vdXQsXG4gICAgICB0ZXJtaW5hbDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHRoaXMuX2RlZmluZUFkZGl0aW9uYWxDb21tYW5kcygpO1xuXG4gICAgdGhpcy5fcmVwbFNlcnZlciA9IGluamVjdEJlZm9yZShcbiAgICAgIHRoaXMuX3JlcGxTZXJ2ZXIsXG4gICAgICAnY29tcGxldGVyJyxcbiAgICAgIChsaW5lOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICB0aGlzLmNvbXBsZXRlKGxpbmUpXG4gICAgICAgICAgLnRoZW4oKHJldHMpID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldHMpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICk7XG4gICAgdGhpcy5fcmVwbFNlcnZlciA9IGluamVjdEFmdGVyKHRoaXMuX3JlcGxTZXJ2ZXIsICdldmFsJywgcHJvbWlzaWZ5KTtcblxuICAgIGlmIChvcHRpb25zLmludGVyYWN0aXZlID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5fcmVwbFNlcnZlciA9IGluamVjdEFmdGVyKFxuICAgICAgICB0aGlzLl9yZXBsU2VydmVyLFxuICAgICAgICAnZXZhbCcsXG4gICAgICAgIG91dHB1dFRvU3Rkb3V0KG9wdGlvbnMucHJldHR5UHJpbnQpLFxuICAgICAgKTtcbiAgICAgIHRoaXMuX3JlcGxTZXJ2ZXIgPSBpbmplY3RBZnRlcih0aGlzLl9yZXBsU2VydmVyLCAnZXZhbCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5fcmVwbFNlcnZlci5vbignZXhpdCcsICgpID0+IHByb2Nlc3MuZXhpdCgpKTtcblxuICAgIHRoaXMuX2RlZmluZUJ1aWx0aW5WYXJzKHRoaXMuX3JlcGxTZXJ2ZXIuY29udGV4dCk7XG5cbiAgICBpZiAob3B0aW9ucy5ldmFsU2NyaXB0KSB7XG4gICAgICB0aGlzLl9pbi53cml0ZShvcHRpb25zLmV2YWxTY3JpcHQgKyAnXFxuJywgJ3V0Zi04Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIF9kZWZpbmVBZGRpdGlvbmFsQ29tbWFuZHMoKSB7XG4gICAgY29uc3QgY2xpID0gdGhpcy5fY2xpO1xuICAgIGNvbnN0IHJlcGxTZXJ2ZXIgPSB0aGlzLl9yZXBsU2VydmVyO1xuICAgIGlmICghcmVwbFNlcnZlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXBsU2VydmVyLmRlZmluZUNvbW1hbmQoJ2Nvbm5lY3Rpb25zJywge1xuICAgICAgaGVscDogJ0xpc3QgY3VycmVudHkgcmVnaXN0ZXJlZCBTYWxlc2ZvcmNlIGNvbm5lY3Rpb25zJyxcbiAgICAgIGFjdGlvbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBjbGkubGlzdENvbm5lY3Rpb25zKCk7XG4gICAgICAgIHJlcGxTZXJ2ZXIuZGlzcGxheVByb21wdCgpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgICByZXBsU2VydmVyLmRlZmluZUNvbW1hbmQoJ2Nvbm5lY3QnLCB7XG4gICAgICBoZWxwOiAnQ29ubmVjdCB0byBTYWxlc2ZvcmNlIGluc3RhbmNlJyxcbiAgICAgIGFjdGlvbjogYXN5bmMgKC4uLmFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgIGNvbnN0IFtuYW1lLCBwYXNzd29yZF0gPSBhcmdzO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBwYXNzd29yZFxuICAgICAgICAgID8geyBjb25uZWN0aW9uOiBuYW1lLCB1c2VybmFtZTogbmFtZSwgcGFzc3dvcmQ6IHBhc3N3b3JkIH1cbiAgICAgICAgICA6IHsgY29ubmVjdGlvbjogbmFtZSwgdXNlcm5hbWU6IG5hbWUgfTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBjbGkuY29ubmVjdChwYXJhbXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXBsU2VydmVyLmRpc3BsYXlQcm9tcHQoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgcmVwbFNlcnZlci5kZWZpbmVDb21tYW5kKCdkaXNjb25uZWN0Jywge1xuICAgICAgaGVscDogJ0Rpc2Nvbm5lY3QgY29ubmVjdGlvbiBhbmQgZXJhc2UgaXQgZnJvbSByZWdpc3RyeScsXG4gICAgICBhY3Rpb246IChuYW1lKSA9PiB7XG4gICAgICAgIGNsaS5kaXNjb25uZWN0KG5hbWUpO1xuICAgICAgICByZXBsU2VydmVyLmRpc3BsYXlQcm9tcHQoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgcmVwbFNlcnZlci5kZWZpbmVDb21tYW5kKCd1c2UnLCB7XG4gICAgICBoZWxwOiAnU3BlY2lmeSBsb2dpbiBzZXJ2ZXIgdG8gZXN0YWJsaXNoIGNvbm5lY3Rpb24nLFxuICAgICAgYWN0aW9uOiAobG9naW5TZXJ2ZXIpID0+IHtcbiAgICAgICAgY2xpLnNldExvZ2luU2VydmVyKGxvZ2luU2VydmVyKTtcbiAgICAgICAgcmVwbFNlcnZlci5kaXNwbGF5UHJvbXB0KCk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHJlcGxTZXJ2ZXIuZGVmaW5lQ29tbWFuZCgnYXV0aG9yaXplJywge1xuICAgICAgaGVscDogJ0Nvbm5lY3QgdG8gU2FsZXNmb3JjZSB1c2luZyBPQXV0aDIgYXV0aG9yaXphdGlvbiBmbG93JyxcbiAgICAgIGFjdGlvbjogYXN5bmMgKGNsaWVudE5hbWUpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBjbGkuYXV0aG9yaXplKGNsaWVudE5hbWUpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXBsU2VydmVyLmRpc3BsYXlQcm9tcHQoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgcmVwbFNlcnZlci5kZWZpbmVDb21tYW5kKCdyZWdpc3RlcicsIHtcbiAgICAgIGhlbHA6ICdSZWdpc3RlciBPQXV0aDIgY2xpZW50IGluZm9ybWF0aW9uJyxcbiAgICAgIGFjdGlvbjogYXN5bmMgKC4uLmFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgIGNvbnN0IFtcbiAgICAgICAgICBjbGllbnROYW1lLFxuICAgICAgICAgIGNsaWVudElkLFxuICAgICAgICAgIGNsaWVudFNlY3JldCxcbiAgICAgICAgICByZWRpcmVjdFVyaSxcbiAgICAgICAgICBsb2dpblVybCxcbiAgICAgICAgXSA9IGFyZ3M7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHsgY2xpZW50SWQsIGNsaWVudFNlY3JldCwgcmVkaXJlY3RVcmksIGxvZ2luVXJsIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgY2xpLnJlZ2lzdGVyKGNsaWVudE5hbWUsIGNvbmZpZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcGxTZXJ2ZXIuZGlzcGxheVByb21wdCgpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgICByZXBsU2VydmVyLmRlZmluZUNvbW1hbmQoJ29wZW4nLCB7XG4gICAgICBoZWxwOiAnT3BlbiBTYWxlc2ZvcmNlIHdlYiBwYWdlIHVzaW5nIGVzdGFibGlzaGVkIGNvbm5lY3Rpb24nLFxuICAgICAgYWN0aW9uOiAodXJsKSA9PiB7XG4gICAgICAgIGNsaS5vcGVuVXJsVXNpbmdTZXNzaW9uKHVybCk7XG4gICAgICAgIHJlcGxTZXJ2ZXIuZGlzcGxheVByb21wdCgpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcGF1c2UoKSB7XG4gICAgdGhpcy5fcGF1c2VkID0gdHJ1ZTtcbiAgICBpZiAocHJvY2Vzcy5zdGRpbi5zZXRSYXdNb2RlKSB7XG4gICAgICBwcm9jZXNzLnN0ZGluLnNldFJhd01vZGUoZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcmVzdW1lKCkge1xuICAgIHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xuICAgIHByb2Nlc3Muc3RkaW4ucmVzdW1lKCk7XG4gICAgaWYgKHByb2Nlc3Muc3RkaW4uc2V0UmF3TW9kZSkge1xuICAgICAgcHJvY2Vzcy5zdGRpbi5zZXRSYXdNb2RlKHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgY29tcGxldGUobGluZTogc3RyaW5nKSB7XG4gICAgY29uc3QgdG9rZW5zID0gbGluZS5yZXBsYWNlKC9eXFxzKy8sICcnKS5zcGxpdCgvXFxzKy8pO1xuICAgIGNvbnN0IFtjb21tYW5kLCBrZXl3b3JkID0gJyddID0gdG9rZW5zO1xuICAgIGlmIChjb21tYW5kWzBdID09PSAnLicgJiYgdG9rZW5zLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGV0IGNhbmRpZGF0ZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBpZiAoY29tbWFuZCA9PT0gJy5jb25uZWN0JyB8fCBjb21tYW5kID09PSAnLmRpc2Nvbm5lY3QnKSB7XG4gICAgICAgIGNhbmRpZGF0ZXMgPSBhd2FpdCB0aGlzLl9jbGkuZ2V0Q29ubmVjdGlvbk5hbWVzKCk7XG4gICAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICcuYXV0aG9yaXplJykge1xuICAgICAgICBjYW5kaWRhdGVzID0gYXdhaXQgdGhpcy5fY2xpLmdldENsaWVudE5hbWVzKCk7XG4gICAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICcudXNlJykge1xuICAgICAgICBjYW5kaWRhdGVzID0gWydwcm9kdWN0aW9uJywgJ3NhbmRib3gnXTtcbiAgICAgIH1cbiAgICAgIGNhbmRpZGF0ZXMgPSBjYW5kaWRhdGVzLmZpbHRlcigobmFtZSkgPT4gbmFtZS5pbmRleE9mKGtleXdvcmQpID09PSAwKTtcbiAgICAgIHJldHVybiBbY2FuZGlkYXRlcywga2V5d29yZF07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1hcCBhbGwganNmb3JjZSBvYmplY3QgdG8gUkVQTCBjb250ZXh0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZGVmaW5lQnVpbHRpblZhcnMoY29udGV4dDogeyBbdmFyTmFtZTogc3RyaW5nXTogYW55IH0pIHtcbiAgICBjb25zdCBjbGkgPSB0aGlzLl9jbGk7XG5cbiAgICAvLyBkZWZpbmUgc2FsZXNmb3JjZSBwYWNrYWdlIHJvb3Qgb2JqZWN0c1xuICAgIGZvciAoY29uc3Qga2V5IGluIGpzZm9yY2UpIHtcbiAgICAgIGlmIChcbiAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGpzZm9yY2UsIGtleSkgJiZcbiAgICAgICAgIShnbG9iYWwgYXMgYW55KVtrZXldXG4gICAgICApIHtcbiAgICAgICAgY29udGV4dFtrZXldID0gKGpzZm9yY2UgYXMgYW55KVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHBvc2UganNmb3JjZSBwYWNrYWdlIHJvb3Qgb2JqZWN0IGluIGNvbnRleHQuXG4gICAgY29udGV4dC5qc2ZvcmNlID0ganNmb3JjZTtcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVByb3h5RnVuYyhwcm9wOiBzdHJpbmcpIHtcbiAgICAgIHJldHVybiAoLi4uYXJnczogYW55W10pID0+IHtcbiAgICAgICAgY29uc3QgY29ubiA9IGNsaS5nZXRDdXJyZW50Q29ubmVjdGlvbigpO1xuICAgICAgICByZXR1cm4gKGNvbm4gYXMgYW55KVtwcm9wXSguLi5hcmdzKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlUHJveHlBY2Nlc3Nvcihwcm9wOiBzdHJpbmcpIHtcbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbm4gPSBjbGkuZ2V0Q3VycmVudENvbm5lY3Rpb24oKTtcbiAgICAgICAgcmV0dXJuIChjb25uIGFzIGFueSlbcHJvcF07XG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IGNvbm4gPSBjbGkuZ2V0Q3VycmVudENvbm5lY3Rpb24oKTtcbiAgICAvLyBsaXN0IGFsbCBwcm9wcyBpbiBjb25uZWN0aW9uIGluc3RhbmNlLCBvdGhlciB0aGFuIEV2ZW50RW1pdHRlciBvciBvYmplY3QgYnVpbHQtaW4gbWV0aG9kc1xuICAgIGNvbnN0IHByb3BzOiB7IFtwcm9wOiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcbiAgICBsZXQgbzogb2JqZWN0ID0gY29ubjtcbiAgICB3aGlsZSAobyAmJiBvICE9PSBFdmVudEVtaXR0ZXIucHJvdG90eXBlICYmIG8gIT09IE9iamVjdC5wcm90b3R5cGUpIHtcbiAgICAgIGZvciAoY29uc3QgcCBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvKSkge1xuICAgICAgICBpZiAocCAhPT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICAgIHByb3BzW3BdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbyA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihvKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwcm9wIG9mIE9iamVjdC5rZXlzKHByb3BzKSkge1xuICAgICAgaWYgKHR5cGVvZiAoZ2xvYmFsIGFzIGFueSlbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIC8vIGF2b2lkIGdsb2JhbCBvdmVycmlkZVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChwcm9wLmluZGV4T2YoJ18nKSA9PT0gMCkge1xuICAgICAgICAvLyBpZ25vcmUgcHJpdmF0ZVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChpc0Z1bmN0aW9uKChjb25uIGFzIGFueSlbcHJvcF0pKSB7XG4gICAgICAgIGNvbnRleHRbcHJvcF0gPSBjcmVhdGVQcm94eUZ1bmMocHJvcCk7XG4gICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KChjb25uIGFzIGFueSlbcHJvcF0pKSB7XG4gICAgICAgIGRlZmluZVByb3AoY29udGV4dCwgcHJvcCwgY3JlYXRlUHJveHlBY2Nlc3Nvcihwcm9wKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXhwb3NlIGRlZmF1bHQgY29ubmVjdGlvbiBhcyBcIiRjb25uXCJcbiAgICBkZWZpbmVQcm9wKGNvbnRleHQsICckY29ubicsICgpID0+IHtcbiAgICAgIHJldHVybiBjbGkuZ2V0Q3VycmVudENvbm5lY3Rpb24oKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBSZXBsO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtBLElBQUFBLE9B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