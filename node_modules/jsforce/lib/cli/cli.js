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
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Cli = void 0;
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _reduce = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/reduce"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _http = _interopRequireDefault(require("http"));
var _url = _interopRequireDefault(require("url"));
var _crypto = _interopRequireDefault(require("crypto"));
var _open = _interopRequireDefault(require("open"));
var _commander = require("commander");
var _inquirer = _interopRequireDefault(require("inquirer"));
var _request = _interopRequireDefault(require("../request"));
var _base64url = _interopRequireDefault(require("base64url"));
var _repl = _interopRequireDefault(require("./repl"));
var _ = _interopRequireWildcard(require(".."));
var _VERSION = _interopRequireDefault(require("../VERSION"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context2; _forEachInstanceProperty(_context2 = ownKeys(Object(source), true)).call(_context2, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source))).call(_context3, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @file Command line interface for JSforce
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
const registry = _.default.registry;
/**
 *
 */
class Cli {
  constructor() {
    (0, _defineProperty2.default)(this, "_repl", new _repl.default(this));
    (0, _defineProperty2.default)(this, "_conn", new _.Connection());
    (0, _defineProperty2.default)(this, "_connName", undefined);
    (0, _defineProperty2.default)(this, "_outputEnabled", true);
    (0, _defineProperty2.default)(this, "_defaultLoginUrl", undefined);
  }
  /**
   *
   */
  readCommand() {
    return new _commander.Command().option('-u, --username [username]', 'Salesforce username').option('-p, --password [password]', 'Salesforce password (and security token, if available)').option('-c, --connection [connection]', 'Connection name stored in connection registry').option('-l, --loginUrl [loginUrl]', 'Salesforce login url').option('--sandbox', 'Login to Salesforce sandbox').option('-e, --evalScript [evalScript]', 'Script to evaluate').version(_VERSION.default).parse(process.argv);
  }
  async start() {
    const program = this.readCommand();
    this._outputEnabled = !program.evalScript;
    try {
      await this.connect(program);
      if (program.evalScript) {
        this._repl.start({
          interactive: false,
          evalScript: program.evalScript
        });
      } else {
        this._repl.start();
      }
    } catch (err) {
      console.error(err);
      process.exit();
    }
  }
  getCurrentConnection() {
    return this._conn;
  }
  print(...args) {
    if (this._outputEnabled) {
      console.log(...args);
    }
  }
  saveCurrentConnection() {
    if (this._connName) {
      const conn = this._conn;
      const connName = this._connName;
      const connConfig = {
        oauth2: conn.oauth2 ? {
          clientId: conn.oauth2.clientId || undefined,
          clientSecret: conn.oauth2.clientSecret || undefined,
          redirectUri: conn.oauth2.redirectUri || undefined,
          loginUrl: conn.oauth2.loginUrl || undefined
        } : undefined,
        accessToken: conn.accessToken || undefined,
        instanceUrl: conn.instanceUrl || undefined,
        refreshToken: conn.refreshToken || undefined
      };
      registry.saveConnectionConfig(connName, connConfig);
    }
  }
  setLoginServer(loginServer) {
    if (!loginServer) {
      return;
    }
    if (loginServer === 'production') {
      this._defaultLoginUrl = 'https://login.salesforce.com';
    } else if (loginServer === 'sandbox') {
      this._defaultLoginUrl = 'https://test.salesforce.com';
    } else if ((0, _indexOf.default)(loginServer).call(loginServer, 'https://') !== 0) {
      this._defaultLoginUrl = 'https://' + loginServer;
    } else {
      this._defaultLoginUrl = loginServer;
    }
    this.print(`Using "${this._defaultLoginUrl}" as default login URL.`);
  }

  /**
   *
   */
  async connect(options) {
    const loginServer = options.loginUrl ? options.loginUrl : options.sandbox ? 'sandbox' : null;
    this.setLoginServer(loginServer);
    this._connName = options.connection;
    let connConfig = await registry.getConnectionConfig(options.connection);
    let username = options.username;
    if (!connConfig) {
      connConfig = {};
      if (this._defaultLoginUrl) {
        connConfig.loginUrl = this._defaultLoginUrl;
      }
      username = username || options.connection;
    }
    this._conn = new _.Connection(connConfig);
    const password = options.password;
    if (username) {
      await this.startPasswordAuth(username, password);
      this.saveCurrentConnection();
    } else {
      if (this._connName && this._conn.accessToken) {
        this._conn.on('refresh', () => {
          this.print('Refreshing access token ... ');
          this.saveCurrentConnection();
        });
        try {
          const identity = await this._conn.identity();
          this.print(`Logged in as : ${identity.username}`);
        } catch (err) {
          if (err instanceof Error) {
            this.print(err.message);
          }
          if (this._conn.oauth2) {
            throw new Error('Please re-authorize connection.');
          } else {
            await this.startPasswordAuth(this._connName);
          }
        }
      }
    }
  }

  /**
   *
   */
  async startPasswordAuth(username, password) {
    try {
      await this.loginByPassword(username, password, 2);
    } catch (err) {
      if (err instanceof Error && err.message === 'canceled') {
        console.error('Password authentication canceled: Not logged in');
      } else {
        throw err;
      }
    }
  }

  /**
   *
   */
  async loginByPassword(username, password, retryCount) {
    if (password === '') {
      throw new Error('canceled');
    }
    if (password == null) {
      const pass = await this.promptPassword('Password: ');
      return this.loginByPassword(username, pass, retryCount);
    }
    try {
      const result = await this._conn.login(username, password);
      this.print(`Logged in as : ${username}`);
      return result;
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }
      if (retryCount > 0) {
        return this.loginByPassword(username, undefined, retryCount - 1);
      } else {
        throw new Error('canceled');
      }
    }
  }

  /**
   *
   */
  disconnect(connName) {
    const name = connName || this._connName;
    if (name && registry.getConnectionConfig(name)) {
      registry.removeConnectionConfig(name);
      this.print(`Disconnect connection '${name}'`);
    }
    this._connName = undefined;
    this._conn = new _.Connection();
  }

  /**
   *
   */
  async authorize(clientName) {
    const name = clientName || 'default';
    var oauth2Config = await registry.getClientConfig(name);
    if (!oauth2Config || !oauth2Config.clientId) {
      if (name === 'default' || name === 'sandbox') {
        this.print('No client information registered. Downloading JSforce default client information...');
        return this.downloadDefaultClientInfo(name);
      }
      throw new Error(`No OAuth2 client information registered : '${name}'. Please register client info first.`);
    }
    const oauth2 = new _.OAuth2(oauth2Config);
    const verifier = _base64url.default.encode(_crypto.default.randomBytes(32));
    const challenge = _base64url.default.encode(_crypto.default.createHash('sha256').update(verifier).digest());
    const state = _base64url.default.encode(_crypto.default.randomBytes(32));
    const authzUrl = oauth2.getAuthorizationUrl({
      code_challenge: challenge,
      state
    });
    this.print('Opening authorization page in browser...');
    this.print(`URL: ${authzUrl}`);
    this.openUrl(authzUrl);
    const params = await this.waitCallback(oauth2Config.redirectUri, state);
    if (!params.code) {
      throw new Error('No authorization code returned.');
    }
    if (params.state !== state) {
      throw new Error('Invalid state parameter returned.');
    }
    this._conn = new _.Connection({
      oauth2
    });
    this.print('Received authorization code. Please close the opened browser window.');
    await this._conn.authorize(params.code, {
      code_verifier: verifier
    });
    this.print('Authorized. Fetching user info...');
    const identity = await this._conn.identity();
    this.print(`Logged in as : ${identity.username}`);
    this._connName = identity.username;
    this.saveCurrentConnection();
  }

  /**
   *
   */
  async downloadDefaultClientInfo(clientName) {
    const configUrl = 'https://jsforce.github.io/client-config/default.json';
    const res = await new _promise.default((resolve, reject) => {
      (0, _request.default)({
        method: 'GET',
        url: configUrl
      }).on('complete', resolve).on('error', reject);
    });
    const clientConfig = JSON.parse(res.body);
    if (clientName === 'sandbox') {
      clientConfig.loginUrl = 'https://test.salesforce.com';
    }
    await registry.registerClientConfig(clientName, clientConfig);
    this.print('Client information downloaded successfully.');
    return this.authorize(clientName);
  }
  async waitCallback(serverUrl, state) {
    if (serverUrl && (0, _indexOf.default)(serverUrl).call(serverUrl, 'http://localhost:') === 0) {
      return new _promise.default((resolve, reject) => {
        const server = _http.default.createServer((req, res) => {
          if (!req.url) {
            return;
          }
          const qparams = _url.default.parse(req.url, true).query;
          res.writeHead(200, {
            'Content-Type': 'text/html'
          });
          res.write('<html><script>location.href="about:blank";</script></html>');
          res.end();
          if (qparams.error) {
            reject(new Error(qparams.error));
          } else {
            resolve(qparams);
          }
          server.close();
          req.connection.end();
          req.connection.destroy();
        });
        const port = Number(_url.default.parse(serverUrl).port);
        server.listen(port, 'localhost');
      });
    } else {
      const code = await this.promptMessage('Copy & paste authz code passed in redirected URL: ');
      return {
        code: decodeURIComponent(code),
        state
      };
    }
  }

  /**
   *
   */
  async register(clientName, clientConfig) {
    var _context;
    const name = clientName || 'default';
    const prompts = {
      clientId: 'Input client ID : ',
      clientSecret: 'Input client secret (optional) : ',
      redirectUri: 'Input redirect URI : ',
      loginUrl: 'Input login URL (default is https://login.salesforce.com) : '
    };
    const registered = await registry.getClientConfig(name);
    if (registered) {
      const msg = `Client '${name}' is already registered. Are you sure you want to override ? [yN] : `;
      const ok = await this.promptConfirm(msg);
      if (!ok) {
        throw new Error('Registration canceled.');
      }
    }
    clientConfig = await (0, _reduce.default)(_context = (0, _keys.default)(prompts)).call(_context, async (promise, name) => {
      const cconfig = await promise;
      const promptName = name;
      const message = prompts[promptName];
      if (!cconfig[promptName]) {
        const value = await this.promptMessage(message);
        if (value) {
          return _objectSpread(_objectSpread({}, cconfig), {}, {
            [promptName]: value
          });
        }
      }
      return cconfig;
    }, _promise.default.resolve(clientConfig));
    await registry.registerClientConfig(name, clientConfig);
    this.print('Client registered successfully.');
  }

  /**
   *
   */
  async listConnections() {
    const names = await registry.getConnectionNames();
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      this.print((name === this._connName ? '* ' : '  ') + name);
    }
  }

  /**
   *
   */
  async getConnectionNames() {
    return registry.getConnectionNames();
  }

  /**
   *
   */
  async getClientNames() {
    return registry.getClientNames();
  }

  /**
   *
   */
  async prompt(type, message) {
    this._repl.pause();
    const answer = await _inquirer.default.prompt([{
      type,
      name: 'value',
      message
    }]);
    this._repl.resume();
    return answer.value;
  }

  /**
   *
   */
  async promptMessage(message) {
    return this.prompt('input', message);
  }
  async promptPassword(message) {
    return this.prompt('password', message);
  }

  /**
   *
   */
  async promptConfirm(message) {
    return this.prompt('confirm', message);
  }

  /**
   *
   */
  openUrl(url) {
    (0, _open.default)(url);
  }

  /**
   *
   */
  openUrlUsingSession(url) {
    let frontdoorUrl = `${this._conn.instanceUrl}/secur/frontdoor.jsp?sid=${this._conn.accessToken}`;
    if (url) {
      frontdoorUrl += '&retURL=' + encodeURIComponent(url);
    }
    this.openUrl(frontdoorUrl);
  }
}

/* ------------------------------------------------------------------------- */
exports.Cli = Cli;
const cli = new Cli();
var _default = cli;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfaHR0cCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJyZXF1aXJlIiwiX3VybCIsIl9jcnlwdG8iLCJfb3BlbiIsIl9jb21tYW5kZXIiLCJfaW5xdWlyZXIiLCJfcmVxdWVzdCIsIl9iYXNlNjR1cmwiLCJfcmVwbCIsIl8iLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9WRVJTSU9OIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIl9PYmplY3Qka2V5czIiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eSIsImNhbGwiLCJzeW0iLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsIl9jb250ZXh0MiIsIl9mb3JFYWNoSW5zdGFuY2VQcm9wZXJ0eSIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsInJlZ2lzdHJ5IiwianNmb3JjZSIsIkNsaSIsImNvbnN0cnVjdG9yIiwiUmVwbCIsIkNvbm5lY3Rpb24iLCJ1bmRlZmluZWQiLCJyZWFkQ29tbWFuZCIsIkNvbW1hbmQiLCJvcHRpb24iLCJ2ZXJzaW9uIiwicGFyc2UiLCJwcm9jZXNzIiwiYXJndiIsInN0YXJ0IiwicHJvZ3JhbSIsIl9vdXRwdXRFbmFibGVkIiwiZXZhbFNjcmlwdCIsImNvbm5lY3QiLCJpbnRlcmFjdGl2ZSIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsImV4aXQiLCJnZXRDdXJyZW50Q29ubmVjdGlvbiIsIl9jb25uIiwicHJpbnQiLCJhcmdzIiwibG9nIiwic2F2ZUN1cnJlbnRDb25uZWN0aW9uIiwiX2Nvbm5OYW1lIiwiY29ubiIsImNvbm5OYW1lIiwiY29ubkNvbmZpZyIsIm9hdXRoMiIsImNsaWVudElkIiwiY2xpZW50U2VjcmV0IiwicmVkaXJlY3RVcmkiLCJsb2dpblVybCIsImFjY2Vzc1Rva2VuIiwiaW5zdGFuY2VVcmwiLCJyZWZyZXNoVG9rZW4iLCJzYXZlQ29ubmVjdGlvbkNvbmZpZyIsInNldExvZ2luU2VydmVyIiwibG9naW5TZXJ2ZXIiLCJfZGVmYXVsdExvZ2luVXJsIiwiX2luZGV4T2YiLCJvcHRpb25zIiwic2FuZGJveCIsImNvbm5lY3Rpb24iLCJnZXRDb25uZWN0aW9uQ29uZmlnIiwidXNlcm5hbWUiLCJwYXNzd29yZCIsInN0YXJ0UGFzc3dvcmRBdXRoIiwib24iLCJpZGVudGl0eSIsIkVycm9yIiwibWVzc2FnZSIsImxvZ2luQnlQYXNzd29yZCIsInJldHJ5Q291bnQiLCJwYXNzIiwicHJvbXB0UGFzc3dvcmQiLCJyZXN1bHQiLCJsb2dpbiIsImRpc2Nvbm5lY3QiLCJuYW1lIiwicmVtb3ZlQ29ubmVjdGlvbkNvbmZpZyIsImF1dGhvcml6ZSIsImNsaWVudE5hbWUiLCJvYXV0aDJDb25maWciLCJnZXRDbGllbnRDb25maWciLCJkb3dubG9hZERlZmF1bHRDbGllbnRJbmZvIiwiT0F1dGgyIiwidmVyaWZpZXIiLCJiYXNlNjR1cmwiLCJlbmNvZGUiLCJjcnlwdG8iLCJyYW5kb21CeXRlcyIsImNoYWxsZW5nZSIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJzdGF0ZSIsImF1dGh6VXJsIiwiZ2V0QXV0aG9yaXphdGlvblVybCIsImNvZGVfY2hhbGxlbmdlIiwib3BlblVybCIsInBhcmFtcyIsIndhaXRDYWxsYmFjayIsImNvZGUiLCJjb2RlX3ZlcmlmaWVyIiwiY29uZmlnVXJsIiwicmVzIiwiX3Byb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVxdWVzdCIsIm1ldGhvZCIsInVybCIsImNsaWVudENvbmZpZyIsIkpTT04iLCJib2R5IiwicmVnaXN0ZXJDbGllbnRDb25maWciLCJzZXJ2ZXJVcmwiLCJzZXJ2ZXIiLCJodHRwIiwiY3JlYXRlU2VydmVyIiwicmVxIiwicXBhcmFtcyIsInF1ZXJ5Iiwid3JpdGVIZWFkIiwid3JpdGUiLCJlbmQiLCJjbG9zZSIsImRlc3Ryb3kiLCJwb3J0IiwiTnVtYmVyIiwibGlzdGVuIiwicHJvbXB0TWVzc2FnZSIsImRlY29kZVVSSUNvbXBvbmVudCIsInJlZ2lzdGVyIiwiX2NvbnRleHQiLCJwcm9tcHRzIiwicmVnaXN0ZXJlZCIsIm1zZyIsIm9rIiwicHJvbXB0Q29uZmlybSIsIl9yZWR1Y2UiLCJfa2V5cyIsInByb21pc2UiLCJjY29uZmlnIiwicHJvbXB0TmFtZSIsInZhbHVlIiwibGlzdENvbm5lY3Rpb25zIiwibmFtZXMiLCJnZXRDb25uZWN0aW9uTmFtZXMiLCJnZXRDbGllbnROYW1lcyIsInByb21wdCIsInR5cGUiLCJwYXVzZSIsImFuc3dlciIsImlucXVpcmVyIiwicmVzdW1lIiwib3BlblVybFVzaW5nU2Vzc2lvbiIsImZyb250ZG9vclVybCIsImVuY29kZVVSSUNvbXBvbmVudCIsImV4cG9ydHMiLCJjbGkiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGkvY2xpLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgQ29tbWFuZCBsaW5lIGludGVyZmFjZSBmb3IgSlNmb3JjZVxuICogQGF1dGhvciBTaGluaWNoaSBUb21pdGEgPHNoaW5pY2hpLnRvbWl0YUBnbWFpbC5jb20+XG4gKi9cbmltcG9ydCBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IG9wZW5VcmwgZnJvbSAnb3Blbic7XG5pbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY29tbWFuZGVyJztcbmltcG9ydCBpbnF1aXJlciBmcm9tICdpbnF1aXJlcic7XG5pbXBvcnQgcmVxdWVzdCBmcm9tICcuLi9yZXF1ZXN0JztcbmltcG9ydCBiYXNlNjR1cmwgZnJvbSAnYmFzZTY0dXJsJztcbmltcG9ydCBSZXBsIGZyb20gJy4vcmVwbCc7XG5pbXBvcnQganNmb3JjZSwgeyBDb25uZWN0aW9uLCBPQXV0aDIgfSBmcm9tICcuLic7XG5pbXBvcnQgdmVyc2lvbiBmcm9tICcuLi9WRVJTSU9OJztcbmltcG9ydCB7IE9wdGlvbmFsIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQ2xpZW50Q29uZmlnIH0gZnJvbSAnLi4vcmVnaXN0cnkvdHlwZXMnO1xuXG5jb25zdCByZWdpc3RyeSA9IGpzZm9yY2UucmVnaXN0cnk7XG5cbmludGVyZmFjZSBDbGlDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIGNvbm5lY3Rpb24/OiBzdHJpbmc7XG4gIHVzZXJuYW1lPzogc3RyaW5nO1xuICBwYXNzd29yZD86IHN0cmluZztcbiAgbG9naW5Vcmw/OiBzdHJpbmc7XG4gIHNhbmRib3g/OiBib29sZWFuO1xuICBldmFsU2NyaXB0Pzogc3RyaW5nO1xufVxuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBjbGFzcyBDbGkge1xuICBfcmVwbDogUmVwbCA9IG5ldyBSZXBsKHRoaXMpO1xuICBfY29ubjogQ29ubmVjdGlvbiA9IG5ldyBDb25uZWN0aW9uKCk7XG4gIF9jb25uTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBfb3V0cHV0RW5hYmxlZDogYm9vbGVhbiA9IHRydWU7XG4gIF9kZWZhdWx0TG9naW5Vcmw6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICpcbiAgICovXG4gIHJlYWRDb21tYW5kKCk6IENsaUNvbW1hbmQge1xuICAgIHJldHVybiBuZXcgQ29tbWFuZCgpXG4gICAgICAub3B0aW9uKCctdSwgLS11c2VybmFtZSBbdXNlcm5hbWVdJywgJ1NhbGVzZm9yY2UgdXNlcm5hbWUnKVxuICAgICAgLm9wdGlvbihcbiAgICAgICAgJy1wLCAtLXBhc3N3b3JkIFtwYXNzd29yZF0nLFxuICAgICAgICAnU2FsZXNmb3JjZSBwYXNzd29yZCAoYW5kIHNlY3VyaXR5IHRva2VuLCBpZiBhdmFpbGFibGUpJyxcbiAgICAgIClcbiAgICAgIC5vcHRpb24oXG4gICAgICAgICctYywgLS1jb25uZWN0aW9uIFtjb25uZWN0aW9uXScsXG4gICAgICAgICdDb25uZWN0aW9uIG5hbWUgc3RvcmVkIGluIGNvbm5lY3Rpb24gcmVnaXN0cnknLFxuICAgICAgKVxuICAgICAgLm9wdGlvbignLWwsIC0tbG9naW5VcmwgW2xvZ2luVXJsXScsICdTYWxlc2ZvcmNlIGxvZ2luIHVybCcpXG4gICAgICAub3B0aW9uKCctLXNhbmRib3gnLCAnTG9naW4gdG8gU2FsZXNmb3JjZSBzYW5kYm94JylcbiAgICAgIC5vcHRpb24oJy1lLCAtLWV2YWxTY3JpcHQgW2V2YWxTY3JpcHRdJywgJ1NjcmlwdCB0byBldmFsdWF0ZScpXG4gICAgICAudmVyc2lvbih2ZXJzaW9uKVxuICAgICAgLnBhcnNlKHByb2Nlc3MuYXJndik7XG4gIH1cblxuICBhc3luYyBzdGFydCgpIHtcbiAgICBjb25zdCBwcm9ncmFtID0gdGhpcy5yZWFkQ29tbWFuZCgpO1xuICAgIHRoaXMuX291dHB1dEVuYWJsZWQgPSAhcHJvZ3JhbS5ldmFsU2NyaXB0O1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmNvbm5lY3QocHJvZ3JhbSk7XG4gICAgICBpZiAocHJvZ3JhbS5ldmFsU2NyaXB0KSB7XG4gICAgICAgIHRoaXMuX3JlcGwuc3RhcnQoe1xuICAgICAgICAgIGludGVyYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgICBldmFsU2NyaXB0OiBwcm9ncmFtLmV2YWxTY3JpcHQsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVwbC5zdGFydCgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgcHJvY2Vzcy5leGl0KCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0Q3VycmVudENvbm5lY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Nvbm47XG4gIH1cblxuICBwcmludCguLi5hcmdzOiBhbnlbXSkge1xuICAgIGlmICh0aGlzLl9vdXRwdXRFbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBzYXZlQ3VycmVudENvbm5lY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX2Nvbm5OYW1lKSB7XG4gICAgICBjb25zdCBjb25uID0gdGhpcy5fY29ubjtcbiAgICAgIGNvbnN0IGNvbm5OYW1lID0gdGhpcy5fY29ubk5hbWU7XG4gICAgICBjb25zdCBjb25uQ29uZmlnID0ge1xuICAgICAgICBvYXV0aDI6IGNvbm4ub2F1dGgyXG4gICAgICAgICAgPyB7XG4gICAgICAgICAgICAgIGNsaWVudElkOiBjb25uLm9hdXRoMi5jbGllbnRJZCB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIGNsaWVudFNlY3JldDogY29ubi5vYXV0aDIuY2xpZW50U2VjcmV0IHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgcmVkaXJlY3RVcmk6IGNvbm4ub2F1dGgyLnJlZGlyZWN0VXJpIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgbG9naW5Vcmw6IGNvbm4ub2F1dGgyLmxvZ2luVXJsIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgYWNjZXNzVG9rZW46IGNvbm4uYWNjZXNzVG9rZW4gfHwgdW5kZWZpbmVkLFxuICAgICAgICBpbnN0YW5jZVVybDogY29ubi5pbnN0YW5jZVVybCB8fCB1bmRlZmluZWQsXG4gICAgICAgIHJlZnJlc2hUb2tlbjogY29ubi5yZWZyZXNoVG9rZW4gfHwgdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICAgIHJlZ2lzdHJ5LnNhdmVDb25uZWN0aW9uQ29uZmlnKGNvbm5OYW1lLCBjb25uQ29uZmlnKTtcbiAgICB9XG4gIH1cblxuICBzZXRMb2dpblNlcnZlcihsb2dpblNlcnZlcjogT3B0aW9uYWw8c3RyaW5nPikge1xuICAgIGlmICghbG9naW5TZXJ2ZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGxvZ2luU2VydmVyID09PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHRoaXMuX2RlZmF1bHRMb2dpblVybCA9ICdodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tJztcbiAgICB9IGVsc2UgaWYgKGxvZ2luU2VydmVyID09PSAnc2FuZGJveCcpIHtcbiAgICAgIHRoaXMuX2RlZmF1bHRMb2dpblVybCA9ICdodHRwczovL3Rlc3Quc2FsZXNmb3JjZS5jb20nO1xuICAgIH0gZWxzZSBpZiAobG9naW5TZXJ2ZXIuaW5kZXhPZignaHR0cHM6Ly8nKSAhPT0gMCkge1xuICAgICAgdGhpcy5fZGVmYXVsdExvZ2luVXJsID0gJ2h0dHBzOi8vJyArIGxvZ2luU2VydmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9kZWZhdWx0TG9naW5VcmwgPSBsb2dpblNlcnZlcjtcbiAgICB9XG4gICAgdGhpcy5wcmludChgVXNpbmcgXCIke3RoaXMuX2RlZmF1bHRMb2dpblVybH1cIiBhcyBkZWZhdWx0IGxvZ2luIFVSTC5gKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgY29ubmVjdChvcHRpb25zOiB7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XG4gICAgY29ubmVjdGlvbj86IHN0cmluZztcbiAgICBsb2dpblVybD86IHN0cmluZztcbiAgICBzYW5kYm94PzogYm9vbGVhbjtcbiAgfSkge1xuICAgIGNvbnN0IGxvZ2luU2VydmVyID0gb3B0aW9ucy5sb2dpblVybFxuICAgICAgPyBvcHRpb25zLmxvZ2luVXJsXG4gICAgICA6IG9wdGlvbnMuc2FuZGJveFxuICAgICAgPyAnc2FuZGJveCdcbiAgICAgIDogbnVsbDtcbiAgICB0aGlzLnNldExvZ2luU2VydmVyKGxvZ2luU2VydmVyKTtcbiAgICB0aGlzLl9jb25uTmFtZSA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICBsZXQgY29ubkNvbmZpZyA9IGF3YWl0IHJlZ2lzdHJ5LmdldENvbm5lY3Rpb25Db25maWcob3B0aW9ucy5jb25uZWN0aW9uKTtcbiAgICBsZXQgdXNlcm5hbWUgPSBvcHRpb25zLnVzZXJuYW1lO1xuICAgIGlmICghY29ubkNvbmZpZykge1xuICAgICAgY29ubkNvbmZpZyA9IHt9O1xuICAgICAgaWYgKHRoaXMuX2RlZmF1bHRMb2dpblVybCkge1xuICAgICAgICBjb25uQ29uZmlnLmxvZ2luVXJsID0gdGhpcy5fZGVmYXVsdExvZ2luVXJsO1xuICAgICAgfVxuICAgICAgdXNlcm5hbWUgPSB1c2VybmFtZSB8fCBvcHRpb25zLmNvbm5lY3Rpb247XG4gICAgfVxuICAgIHRoaXMuX2Nvbm4gPSBuZXcgQ29ubmVjdGlvbihjb25uQ29uZmlnKTtcbiAgICBjb25zdCBwYXNzd29yZCA9IG9wdGlvbnMucGFzc3dvcmQ7XG4gICAgaWYgKHVzZXJuYW1lKSB7XG4gICAgICBhd2FpdCB0aGlzLnN0YXJ0UGFzc3dvcmRBdXRoKHVzZXJuYW1lLCBwYXNzd29yZCk7XG4gICAgICB0aGlzLnNhdmVDdXJyZW50Q29ubmVjdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5fY29ubk5hbWUgJiYgdGhpcy5fY29ubi5hY2Nlc3NUb2tlbikge1xuICAgICAgICB0aGlzLl9jb25uLm9uKCdyZWZyZXNoJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucHJpbnQoJ1JlZnJlc2hpbmcgYWNjZXNzIHRva2VuIC4uLiAnKTtcbiAgICAgICAgICB0aGlzLnNhdmVDdXJyZW50Q29ubmVjdGlvbigpO1xuICAgICAgICB9KTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpZGVudGl0eSA9IGF3YWl0IHRoaXMuX2Nvbm4uaWRlbnRpdHkoKTtcbiAgICAgICAgICB0aGlzLnByaW50KGBMb2dnZWQgaW4gYXMgOiAke2lkZW50aXR5LnVzZXJuYW1lfWApO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJpbnQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5fY29ubi5vYXV0aDIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHJlLWF1dGhvcml6ZSBjb25uZWN0aW9uLicpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnN0YXJ0UGFzc3dvcmRBdXRoKHRoaXMuX2Nvbm5OYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIHN0YXJ0UGFzc3dvcmRBdXRoKHVzZXJuYW1lOiBzdHJpbmcsIHBhc3N3b3JkPzogc3RyaW5nKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMubG9naW5CeVBhc3N3b3JkKHVzZXJuYW1lLCBwYXNzd29yZCwgMik7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyLm1lc3NhZ2UgPT09ICdjYW5jZWxlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignUGFzc3dvcmQgYXV0aGVudGljYXRpb24gY2FuY2VsZWQ6IE5vdCBsb2dnZWQgaW4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIGxvZ2luQnlQYXNzd29yZChcbiAgICB1c2VybmFtZTogc3RyaW5nLFxuICAgIHBhc3N3b3JkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgcmV0cnlDb3VudDogbnVtYmVyLFxuICApOiBQcm9taXNlPHsgaWQ6IHN0cmluZyB9PiB7XG4gICAgaWYgKHBhc3N3b3JkID09PSAnJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5jZWxlZCcpO1xuICAgIH1cbiAgICBpZiAocGFzc3dvcmQgPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGFzcyA9IGF3YWl0IHRoaXMucHJvbXB0UGFzc3dvcmQoJ1Bhc3N3b3JkOiAnKTtcbiAgICAgIHJldHVybiB0aGlzLmxvZ2luQnlQYXNzd29yZCh1c2VybmFtZSwgcGFzcywgcmV0cnlDb3VudCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9jb25uLmxvZ2luKHVzZXJuYW1lLCBwYXNzd29yZCk7XG4gICAgICB0aGlzLnByaW50KGBMb2dnZWQgaW4gYXMgOiAke3VzZXJuYW1lfWApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXRyeUNvdW50ID4gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2dpbkJ5UGFzc3dvcmQodXNlcm5hbWUsIHVuZGVmaW5lZCwgcmV0cnlDb3VudCAtIDEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5jZWxlZCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgZGlzY29ubmVjdChjb25uTmFtZT86IHN0cmluZykge1xuICAgIGNvbnN0IG5hbWUgPSBjb25uTmFtZSB8fCB0aGlzLl9jb25uTmFtZTtcbiAgICBpZiAobmFtZSAmJiByZWdpc3RyeS5nZXRDb25uZWN0aW9uQ29uZmlnKG5hbWUpKSB7XG4gICAgICByZWdpc3RyeS5yZW1vdmVDb25uZWN0aW9uQ29uZmlnKG5hbWUpO1xuICAgICAgdGhpcy5wcmludChgRGlzY29ubmVjdCBjb25uZWN0aW9uICcke25hbWV9J2ApO1xuICAgIH1cbiAgICB0aGlzLl9jb25uTmFtZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9jb25uID0gbmV3IENvbm5lY3Rpb24oKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgYXV0aG9yaXplKGNsaWVudE5hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IG5hbWUgPSBjbGllbnROYW1lIHx8ICdkZWZhdWx0JztcbiAgICB2YXIgb2F1dGgyQ29uZmlnID0gYXdhaXQgcmVnaXN0cnkuZ2V0Q2xpZW50Q29uZmlnKG5hbWUpO1xuICAgIGlmICghb2F1dGgyQ29uZmlnIHx8ICFvYXV0aDJDb25maWcuY2xpZW50SWQpIHtcbiAgICAgIGlmIChuYW1lID09PSAnZGVmYXVsdCcgfHwgbmFtZSA9PT0gJ3NhbmRib3gnKSB7XG4gICAgICAgIHRoaXMucHJpbnQoXG4gICAgICAgICAgJ05vIGNsaWVudCBpbmZvcm1hdGlvbiByZWdpc3RlcmVkLiBEb3dubG9hZGluZyBKU2ZvcmNlIGRlZmF1bHQgY2xpZW50IGluZm9ybWF0aW9uLi4uJyxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZG93bmxvYWREZWZhdWx0Q2xpZW50SW5mbyhuYW1lKTtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYE5vIE9BdXRoMiBjbGllbnQgaW5mb3JtYXRpb24gcmVnaXN0ZXJlZCA6ICcke25hbWV9Jy4gUGxlYXNlIHJlZ2lzdGVyIGNsaWVudCBpbmZvIGZpcnN0LmAsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBvYXV0aDIgPSBuZXcgT0F1dGgyKG9hdXRoMkNvbmZpZyk7XG4gICAgY29uc3QgdmVyaWZpZXIgPSBiYXNlNjR1cmwuZW5jb2RlKGNyeXB0by5yYW5kb21CeXRlcygzMikpO1xuICAgIGNvbnN0IGNoYWxsZW5nZSA9IGJhc2U2NHVybC5lbmNvZGUoXG4gICAgICBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKHZlcmlmaWVyKS5kaWdlc3QoKSxcbiAgICApO1xuICAgIGNvbnN0IHN0YXRlID0gYmFzZTY0dXJsLmVuY29kZShjcnlwdG8ucmFuZG9tQnl0ZXMoMzIpKTtcbiAgICBjb25zdCBhdXRoelVybCA9IG9hdXRoMi5nZXRBdXRob3JpemF0aW9uVXJsKHtcbiAgICAgIGNvZGVfY2hhbGxlbmdlOiBjaGFsbGVuZ2UsXG4gICAgICBzdGF0ZSxcbiAgICB9KTtcbiAgICB0aGlzLnByaW50KCdPcGVuaW5nIGF1dGhvcml6YXRpb24gcGFnZSBpbiBicm93c2VyLi4uJyk7XG4gICAgdGhpcy5wcmludChgVVJMOiAke2F1dGh6VXJsfWApO1xuICAgIHRoaXMub3BlblVybChhdXRoelVybCk7XG4gICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy53YWl0Q2FsbGJhY2sob2F1dGgyQ29uZmlnLnJlZGlyZWN0VXJpLCBzdGF0ZSk7XG4gICAgaWYgKCFwYXJhbXMuY29kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBhdXRob3JpemF0aW9uIGNvZGUgcmV0dXJuZWQuJyk7XG4gICAgfVxuICAgIGlmIChwYXJhbXMuc3RhdGUgIT09IHN0YXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgcGFyYW1ldGVyIHJldHVybmVkLicpO1xuICAgIH1cbiAgICB0aGlzLl9jb25uID0gbmV3IENvbm5lY3Rpb24oeyBvYXV0aDIgfSk7XG4gICAgdGhpcy5wcmludChcbiAgICAgICdSZWNlaXZlZCBhdXRob3JpemF0aW9uIGNvZGUuIFBsZWFzZSBjbG9zZSB0aGUgb3BlbmVkIGJyb3dzZXIgd2luZG93LicsXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLl9jb25uLmF1dGhvcml6ZShwYXJhbXMuY29kZSwgeyBjb2RlX3ZlcmlmaWVyOiB2ZXJpZmllciB9KTtcbiAgICB0aGlzLnByaW50KCdBdXRob3JpemVkLiBGZXRjaGluZyB1c2VyIGluZm8uLi4nKTtcbiAgICBjb25zdCBpZGVudGl0eSA9IGF3YWl0IHRoaXMuX2Nvbm4uaWRlbnRpdHkoKTtcbiAgICB0aGlzLnByaW50KGBMb2dnZWQgaW4gYXMgOiAke2lkZW50aXR5LnVzZXJuYW1lfWApO1xuICAgIHRoaXMuX2Nvbm5OYW1lID0gaWRlbnRpdHkudXNlcm5hbWU7XG4gICAgdGhpcy5zYXZlQ3VycmVudENvbm5lY3Rpb24oKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREZWZhdWx0Q2xpZW50SW5mbyhjbGllbnROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb25maWdVcmwgPSAnaHR0cHM6Ly9qc2ZvcmNlLmdpdGh1Yi5pby9jbGllbnQtY29uZmlnL2RlZmF1bHQuanNvbic7XG4gICAgY29uc3QgcmVzOiB7IGJvZHk6IHN0cmluZyB9ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgcmVxdWVzdCh7IG1ldGhvZDogJ0dFVCcsIHVybDogY29uZmlnVXJsIH0pXG4gICAgICAgIC5vbignY29tcGxldGUnLCByZXNvbHZlKVxuICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgICBjb25zdCBjbGllbnRDb25maWcgPSBKU09OLnBhcnNlKHJlcy5ib2R5KTtcbiAgICBpZiAoY2xpZW50TmFtZSA9PT0gJ3NhbmRib3gnKSB7XG4gICAgICBjbGllbnRDb25maWcubG9naW5VcmwgPSAnaHR0cHM6Ly90ZXN0LnNhbGVzZm9yY2UuY29tJztcbiAgICB9XG4gICAgYXdhaXQgcmVnaXN0cnkucmVnaXN0ZXJDbGllbnRDb25maWcoY2xpZW50TmFtZSwgY2xpZW50Q29uZmlnKTtcbiAgICB0aGlzLnByaW50KCdDbGllbnQgaW5mb3JtYXRpb24gZG93bmxvYWRlZCBzdWNjZXNzZnVsbHkuJyk7XG4gICAgcmV0dXJuIHRoaXMuYXV0aG9yaXplKGNsaWVudE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgd2FpdENhbGxiYWNrKFxuICAgIHNlcnZlclVybDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIHN0YXRlOiBzdHJpbmcsXG4gICk6IFByb21pc2U8eyBjb2RlOiBzdHJpbmc7IHN0YXRlOiBzdHJpbmcgfT4ge1xuICAgIGlmIChzZXJ2ZXJVcmwgJiYgc2VydmVyVXJsLmluZGV4T2YoJ2h0dHA6Ly9sb2NhbGhvc3Q6JykgPT09IDApIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4ge1xuICAgICAgICAgIGlmICghcmVxLnVybCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBxcGFyYW1zID0gdXJsLnBhcnNlKHJlcS51cmwsIHRydWUpLnF1ZXJ5O1xuICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9KTtcbiAgICAgICAgICByZXMud3JpdGUoXG4gICAgICAgICAgICAnPGh0bWw+PHNjcmlwdD5sb2NhdGlvbi5ocmVmPVwiYWJvdXQ6YmxhbmtcIjs8L3NjcmlwdD48L2h0bWw+JyxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgICBpZiAocXBhcmFtcy5lcnJvcikge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihxcGFyYW1zLmVycm9yIGFzIHN0cmluZykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXNvbHZlKHFwYXJhbXMgYXMgeyBjb2RlOiBzdHJpbmc7IHN0YXRlOiBzdHJpbmcgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgIHJlcS5jb25uZWN0aW9uLmVuZCgpO1xuICAgICAgICAgIHJlcS5jb25uZWN0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHBvcnQgPSBOdW1iZXIodXJsLnBhcnNlKHNlcnZlclVybCkucG9ydCk7XG4gICAgICAgIHNlcnZlci5saXN0ZW4ocG9ydCwgJ2xvY2FsaG9zdCcpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBhd2FpdCB0aGlzLnByb21wdE1lc3NhZ2UoXG4gICAgICAgICdDb3B5ICYgcGFzdGUgYXV0aHogY29kZSBwYXNzZWQgaW4gcmVkaXJlY3RlZCBVUkw6ICcsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHsgY29kZTogZGVjb2RlVVJJQ29tcG9uZW50KGNvZGUpLCBzdGF0ZSB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgcmVnaXN0ZXIoY2xpZW50TmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBjbGllbnRDb25maWc6IENsaWVudENvbmZpZykge1xuICAgIGNvbnN0IG5hbWUgPSBjbGllbnROYW1lIHx8ICdkZWZhdWx0JztcbiAgICBjb25zdCBwcm9tcHRzID0ge1xuICAgICAgY2xpZW50SWQ6ICdJbnB1dCBjbGllbnQgSUQgOiAnLFxuICAgICAgY2xpZW50U2VjcmV0OiAnSW5wdXQgY2xpZW50IHNlY3JldCAob3B0aW9uYWwpIDogJyxcbiAgICAgIHJlZGlyZWN0VXJpOiAnSW5wdXQgcmVkaXJlY3QgVVJJIDogJyxcbiAgICAgIGxvZ2luVXJsOiAnSW5wdXQgbG9naW4gVVJMIChkZWZhdWx0IGlzIGh0dHBzOi8vbG9naW4uc2FsZXNmb3JjZS5jb20pIDogJyxcbiAgICB9O1xuICAgIGNvbnN0IHJlZ2lzdGVyZWQgPSBhd2FpdCByZWdpc3RyeS5nZXRDbGllbnRDb25maWcobmFtZSk7XG4gICAgaWYgKHJlZ2lzdGVyZWQpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGBDbGllbnQgJyR7bmFtZX0nIGlzIGFscmVhZHkgcmVnaXN0ZXJlZC4gQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIG92ZXJyaWRlID8gW3lOXSA6IGA7XG4gICAgICBjb25zdCBvayA9IGF3YWl0IHRoaXMucHJvbXB0Q29uZmlybShtc2cpO1xuICAgICAgaWYgKCFvaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZ2lzdHJhdGlvbiBjYW5jZWxlZC4nKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY2xpZW50Q29uZmlnID0gYXdhaXQgT2JqZWN0LmtleXMocHJvbXB0cykucmVkdWNlKGFzeW5jIChwcm9taXNlLCBuYW1lKSA9PiB7XG4gICAgICBjb25zdCBjY29uZmlnID0gYXdhaXQgcHJvbWlzZTtcbiAgICAgIGNvbnN0IHByb21wdE5hbWUgPSBuYW1lIGFzIGtleW9mIHR5cGVvZiBwcm9tcHRzO1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHByb21wdHNbcHJvbXB0TmFtZV07XG4gICAgICBpZiAoIWNjb25maWdbcHJvbXB0TmFtZV0pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLnByb21wdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5jY29uZmlnLFxuICAgICAgICAgICAgW3Byb21wdE5hbWVdOiB2YWx1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY2NvbmZpZztcbiAgICB9LCBQcm9taXNlLnJlc29sdmUoY2xpZW50Q29uZmlnKSk7XG4gICAgYXdhaXQgcmVnaXN0cnkucmVnaXN0ZXJDbGllbnRDb25maWcobmFtZSwgY2xpZW50Q29uZmlnKTtcbiAgICB0aGlzLnByaW50KCdDbGllbnQgcmVnaXN0ZXJlZCBzdWNjZXNzZnVsbHkuJyk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIGxpc3RDb25uZWN0aW9ucygpIHtcbiAgICBjb25zdCBuYW1lcyA9IGF3YWl0IHJlZ2lzdHJ5LmdldENvbm5lY3Rpb25OYW1lcygpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBuYW1lID0gbmFtZXNbaV07XG4gICAgICB0aGlzLnByaW50KChuYW1lID09PSB0aGlzLl9jb25uTmFtZSA/ICcqICcgOiAnICAnKSArIG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZ2V0Q29ubmVjdGlvbk5hbWVzKCkge1xuICAgIHJldHVybiByZWdpc3RyeS5nZXRDb25uZWN0aW9uTmFtZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZ2V0Q2xpZW50TmFtZXMoKSB7XG4gICAgcmV0dXJuIHJlZ2lzdHJ5LmdldENsaWVudE5hbWVzKCk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIHByb21wdCh0eXBlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHRoaXMuX3JlcGwucGF1c2UoKTtcbiAgICBjb25zdCBhbnN3ZXI6IHsgdmFsdWU6IHN0cmluZyB9ID0gYXdhaXQgaW5xdWlyZXIucHJvbXB0KFtcbiAgICAgIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgbmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgdGhpcy5fcmVwbC5yZXN1bWUoKTtcbiAgICByZXR1cm4gYW5zd2VyLnZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBhc3luYyBwcm9tcHRNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLnByb21wdCgnaW5wdXQnLCBtZXNzYWdlKTtcbiAgfVxuXG4gIGFzeW5jIHByb21wdFBhc3N3b3JkKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLnByb21wdCgncGFzc3dvcmQnLCBtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgcHJvbXB0Q29uZmlybShtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9tcHQoJ2NvbmZpcm0nLCBtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgb3BlblVybCh1cmw6IHN0cmluZykge1xuICAgIG9wZW5VcmwodXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgb3BlblVybFVzaW5nU2Vzc2lvbih1cmw/OiBzdHJpbmcpIHtcbiAgICBsZXQgZnJvbnRkb29yVXJsID0gYCR7dGhpcy5fY29ubi5pbnN0YW5jZVVybH0vc2VjdXIvZnJvbnRkb29yLmpzcD9zaWQ9JHt0aGlzLl9jb25uLmFjY2Vzc1Rva2VufWA7XG4gICAgaWYgKHVybCkge1xuICAgICAgZnJvbnRkb29yVXJsICs9ICcmcmV0VVJMPScgKyBlbmNvZGVVUklDb21wb25lbnQodXJsKTtcbiAgICB9XG4gICAgdGhpcy5vcGVuVXJsKGZyb250ZG9vclVybCk7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG5jb25zdCBjbGkgPSBuZXcgQ2xpKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsaTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQSxJQUFBQSxLQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBQyxJQUFBLEdBQUFGLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRSxPQUFBLEdBQUFILHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRyxLQUFBLEdBQUFKLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBSSxVQUFBLEdBQUFKLE9BQUE7QUFDQSxJQUFBSyxTQUFBLEdBQUFOLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBTSxRQUFBLEdBQUFQLHNCQUFBLENBQUFDLE9BQUE7QUFD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