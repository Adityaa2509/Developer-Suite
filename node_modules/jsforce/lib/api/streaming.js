"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
_Object$defineProperty(exports, "Client", {
  enumerable: true,
  get: function () {
    return _faye.Client;
  }
});
_Object$defineProperty(exports, "Subscription", {
  enumerable: true,
  get: function () {
    return _faye.Subscription;
  }
});
exports.StreamingExtension = exports.default = exports.Streaming = void 0;
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _events = require("events");
var _faye = require("faye");
var _jsforce = require("../jsforce");
var StreamingExtension = _interopRequireWildcard(require("./streaming/extension"));
exports.StreamingExtension = StreamingExtension;
/**
 * @file Manages Streaming APIs
 * @author Shinichi Tomita <shinichi.tomita@gmail.com>
 */

/**
 *
 */

/*--------------------------------------------*/
/**
 * Streaming API topic class
 */
class Topic {
  constructor(streaming, name) {
    (0, _defineProperty2.default)(this, "_streaming", void 0);
    (0, _defineProperty2.default)(this, "name", void 0);
    this._streaming = streaming;
    this.name = name;
  }

  /**
   * Subscribe listener to topic
   */
  subscribe(listener) {
    return this._streaming.subscribe(this.name, listener);
  }

  /**
   * Unsubscribe listener from topic
   */
  unsubscribe(subscr) {
    this._streaming.unsubscribe(this.name, subscr);
    return this;
  }
}

/*--------------------------------------------*/
/**
 * Streaming API Generic Streaming Channel
 */
class Channel {
  constructor(streaming, name) {
    (0, _defineProperty2.default)(this, "_streaming", void 0);
    (0, _defineProperty2.default)(this, "_id", void 0);
    (0, _defineProperty2.default)(this, "name", void 0);
    this._streaming = streaming;
    this.name = name;
  }

  /**
   * Subscribe to channel
   */
  subscribe(listener) {
    return this._streaming.subscribe(this.name, listener);
  }
  unsubscribe(subscr) {
    this._streaming.unsubscribe(this.name, subscr);
    return this;
  }
  async push(events) {
    const isArray = (0, _isArray.default)(events);
    const pushEvents = (0, _isArray.default)(events) ? events : [events];
    const conn = this._streaming._conn;
    if (!this._id) {
      this._id = conn.sobject('StreamingChannel').findOne({
        Name: this.name
      }, ['Id']).then(rec => rec === null || rec === void 0 ? void 0 : rec.Id);
    }
    const id = await this._id;
    if (!id) {
      throw new Error(`No streaming channel available for name: ${this.name}`);
    }
    const channelUrl = `/sobjects/StreamingChannel/${id}/push`;
    const rets = await conn.requestPost(channelUrl, {
      pushEvents
    });
    return isArray ? rets : rets[0];
  }
}

/*--------------------------------------------*/
/**
 * Streaming API class
 */
class Streaming extends _events.EventEmitter {
  /**
   *
   */
  constructor(conn) {
    super();
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_topics", {});
    (0, _defineProperty2.default)(this, "_fayeClients", {});
    this._conn = conn;
  }

  /* @private */
  _createClient(forChannelName, extensions) {
    var _context;
    // forChannelName is advisory, for an API workaround. It does not restrict or select the channel.
    const needsReplayFix = typeof forChannelName === 'string' && (0, _indexOf.default)(forChannelName).call(forChannelName, '/u/') === 0;
    const endpointUrl = [this._conn.instanceUrl,
    // special endpoint "/cometd/replay/xx.x" is only available in 36.0.
    // See https://releasenotes.docs.salesforce.com/en-us/summer16/release-notes/rn_api_streaming_classic_replay.htm
    'cometd' + (needsReplayFix === true && this._conn.version === '36.0' ? '/replay' : ''), this._conn.version].join('/');
    const fayeClient = new _faye.Client(endpointUrl, {});
    fayeClient.setHeader('Authorization', 'OAuth ' + this._conn.accessToken);
    if ((0, _isArray.default)(extensions)) {
      for (const extension of extensions) {
        fayeClient.addExtension(extension);
      }
    }
    // prevent streaming API server error
    const dispatcher = fayeClient._dispatcher;
    if ((0, _indexOf.default)(_context = dispatcher.getConnectionTypes()).call(_context, 'callback-polling') === -1) {
      dispatcher.selectTransport('long-polling');
      dispatcher._transport.batching = false;
    }
    return fayeClient;
  }

  /** @private **/
  _getFayeClient(channelName) {
    const isGeneric = (0, _indexOf.default)(channelName).call(channelName, '/u/') === 0;
    const clientType = isGeneric ? 'generic' : 'pushTopic';
    if (!this._fayeClients[clientType]) {
      this._fayeClients[clientType] = this._createClient(channelName);
    }
    return this._fayeClients[clientType];
  }

  /**
   * Get named topic
   */
  topic(name) {
    this._topics = this._topics || {};
    const topic = this._topics[name] = this._topics[name] || new Topic(this, name);
    return topic;
  }

  /**
   * Get channel for channel name
   */
  channel(name) {
    return new Channel(this, name);
  }

  /**
   * Subscribe topic/channel
   */
  subscribe(name, listener) {
    const channelName = (0, _indexOf.default)(name).call(name, '/') === 0 ? name : '/topic/' + name;
    const fayeClient = this._getFayeClient(channelName);
    return fayeClient.subscribe(channelName, listener);
  }

  /**
   * Unsubscribe topic
   */
  unsubscribe(name, subscription) {
    const channelName = (0, _indexOf.default)(name).call(name, '/') === 0 ? name : '/topic/' + name;
    const fayeClient = this._getFayeClient(channelName);
    fayeClient.unsubscribe(channelName, subscription);
    return this;
  }

  /**
   * Create a Streaming client, optionally with extensions
   *
   * See Faye docs for implementation details: https://faye.jcoglan.com/browser/extensions.html
   *
   * Example usage:
   *
   * ```javascript
   * const jsforce = require('jsforce');
   *
   * // Establish a Salesforce connection. (Details elided)
   * const conn = new jsforce.Connection({ … });
   *
   * const fayeClient = conn.streaming.createClient();
   *
   * const subscription = fayeClient.subscribe(channel, data => {
   *   console.log('topic received data', data);
   * });
   *
   * subscription.cancel();
   * ```
   *
   * Example with extensions, using Replay & Auth Failure extensions in a server-side Node.js app:
   *
   * ```javascript
   * const jsforce = require('jsforce');
   * const { StreamingExtension } = require('jsforce/api/streaming');
   *
   * // Establish a Salesforce connection. (Details elided)
   * const conn = new jsforce.Connection({ … });
   *
   * const channel = "/event/My_Event__e";
   * const replayId = -2; // -2 is all retained events
   *
   * const exitCallback = () => process.exit(1);
   * const authFailureExt = new StreamingExtension.AuthFailure(exitCallback);
   *
   * const replayExt = new StreamingExtension.Replay(channel, replayId);
   *
   * const fayeClient = conn.streaming.createClient([
   *   authFailureExt,
   *   replayExt
   * ]);
   *
   * const subscription = fayeClient.subscribe(channel, data => {
   *   console.log('topic received data', data);
   * });
   *
   * subscription.cancel();
   * ```
   */
  createClient(extensions) {
    return this._createClient(null, extensions);
  }
}
exports.Streaming = Streaming;
/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
(0, _jsforce.registerModule)('streaming', conn => new Streaming(conn));
var _default = Streaming;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9mYXllIiwiX2pzZm9yY2UiLCJTdHJlYW1pbmdFeHRlbnNpb24iLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsImV4cG9ydHMiLCJUb3BpYyIsImNvbnN0cnVjdG9yIiwic3RyZWFtaW5nIiwibmFtZSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX3N0cmVhbWluZyIsInN1YnNjcmliZSIsImxpc3RlbmVyIiwidW5zdWJzY3JpYmUiLCJzdWJzY3IiLCJDaGFubmVsIiwicHVzaCIsImV2ZW50cyIsImlzQXJyYXkiLCJfaXNBcnJheSIsInB1c2hFdmVudHMiLCJjb25uIiwiX2Nvbm4iLCJfaWQiLCJzb2JqZWN0IiwiZmluZE9uZSIsIk5hbWUiLCJ0aGVuIiwicmVjIiwiSWQiLCJpZCIsIkVycm9yIiwiY2hhbm5lbFVybCIsInJldHMiLCJyZXF1ZXN0UG9zdCIsIlN0cmVhbWluZyIsIkV2ZW50RW1pdHRlciIsIl9jcmVhdGVDbGllbnQiLCJmb3JDaGFubmVsTmFtZSIsImV4dGVuc2lvbnMiLCJfY29udGV4dCIsIm5lZWRzUmVwbGF5Rml4IiwiX2luZGV4T2YiLCJjYWxsIiwiZW5kcG9pbnRVcmwiLCJpbnN0YW5jZVVybCIsInZlcnNpb24iLCJqb2luIiwiZmF5ZUNsaWVudCIsIkNsaWVudCIsInNldEhlYWRlciIsImFjY2Vzc1Rva2VuIiwiZXh0ZW5zaW9uIiwiYWRkRXh0ZW5zaW9uIiwiZGlzcGF0Y2hlciIsIl9kaXNwYXRjaGVyIiwiZ2V0Q29ubmVjdGlvblR5cGVzIiwic2VsZWN0VHJhbnNwb3J0IiwiX3RyYW5zcG9ydCIsImJhdGNoaW5nIiwiX2dldEZheWVDbGllbnQiLCJjaGFubmVsTmFtZSIsImlzR2VuZXJpYyIsImNsaWVudFR5cGUiLCJfZmF5ZUNsaWVudHMiLCJ0b3BpYyIsIl90b3BpY3MiLCJjaGFubmVsIiwic3Vic2NyaXB0aW9uIiwiY3JlYXRlQ2xpZW50IiwicmVnaXN0ZXJNb2R1bGUiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvc3RyZWFtaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgTWFuYWdlcyBTdHJlYW1pbmcgQVBJc1xuICogQGF1dGhvciBTaGluaWNoaSBUb21pdGEgPHNoaW5pY2hpLnRvbWl0YUBnbWFpbC5jb20+XG4gKi9cbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBDbGllbnQsIFN1YnNjcmlwdGlvbiB9IGZyb20gJ2ZheWUnO1xuaW1wb3J0IHsgcmVnaXN0ZXJNb2R1bGUgfSBmcm9tICcuLi9qc2ZvcmNlJztcbmltcG9ydCBDb25uZWN0aW9uIGZyb20gJy4uL2Nvbm5lY3Rpb24nO1xuaW1wb3J0IHsgUmVjb3JkLCBTY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgKiBhcyBTdHJlYW1pbmdFeHRlbnNpb24gZnJvbSAnLi9zdHJlYW1pbmcvZXh0ZW5zaW9uJztcblxuLyoqXG4gKlxuICovXG5leHBvcnQgdHlwZSBTdHJlYW1pbmdNZXNzYWdlPFIgZXh0ZW5kcyBSZWNvcmQ+ID0ge1xuICBldmVudDoge1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBjcmVhdGVkRGF0ZTogc3RyaW5nO1xuICAgIHJlcGxheUlkOiBudW1iZXI7XG4gIH07XG4gIHNvYmplY3Q6IFI7XG59O1xuXG5leHBvcnQgdHlwZSBHZW5lcmljU3RyZWFtaW5nTWVzc2FnZSA9IHtcbiAgZXZlbnQ6IHtcbiAgICBjcmVhdGVkRGF0ZTogc3RyaW5nO1xuICAgIHJlcGxheUlkOiBudW1iZXI7XG4gIH07XG4gIHBheWxvYWQ6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFB1c2hFdmVudCA9IHtcbiAgcGF5bG9hZDogc3RyaW5nO1xuICB1c2VySWRzOiBzdHJpbmdbXTtcbn07XG5cbmV4cG9ydCB0eXBlIFB1c2hFdmVudFJlc3VsdCA9IHtcbiAgZmFub3V0Q291bnQ6IG51bWJlcjtcbiAgdXNlck9ubGluZVN0YXR1czoge1xuICAgIFt1c2VySWQ6IHN0cmluZ106IGJvb2xlYW47XG4gIH07XG59O1xuXG5leHBvcnQgeyBDbGllbnQsIFN1YnNjcmlwdGlvbiB9O1xuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogU3RyZWFtaW5nIEFQSSB0b3BpYyBjbGFzc1xuICovXG5jbGFzcyBUb3BpYzxTIGV4dGVuZHMgU2NoZW1hLCBSIGV4dGVuZHMgUmVjb3JkPiB7XG4gIF9zdHJlYW1pbmc6IFN0cmVhbWluZzxTPjtcbiAgbmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHN0cmVhbWluZzogU3RyZWFtaW5nPFM+LCBuYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9zdHJlYW1pbmcgPSBzdHJlYW1pbmc7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgbGlzdGVuZXIgdG8gdG9waWNcbiAgICovXG4gIHN1YnNjcmliZShsaXN0ZW5lcjogKG1lc3NhZ2U6IFN0cmVhbWluZ01lc3NhZ2U8Uj4pID0+IHZvaWQpOiBTdWJzY3JpcHRpb24ge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW1pbmcuc3Vic2NyaWJlKHRoaXMubmFtZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuc3Vic2NyaWJlIGxpc3RlbmVyIGZyb20gdG9waWNcbiAgICovXG4gIHVuc3Vic2NyaWJlKHN1YnNjcjogU3Vic2NyaXB0aW9uKSB7XG4gICAgdGhpcy5fc3RyZWFtaW5nLnVuc3Vic2NyaWJlKHRoaXMubmFtZSwgc3Vic2NyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogU3RyZWFtaW5nIEFQSSBHZW5lcmljIFN0cmVhbWluZyBDaGFubmVsXG4gKi9cbmNsYXNzIENoYW5uZWw8UyBleHRlbmRzIFNjaGVtYT4ge1xuICBfc3RyZWFtaW5nOiBTdHJlYW1pbmc8Uz47XG4gIF9pZDogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkO1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc3RyZWFtaW5nOiBTdHJlYW1pbmc8Uz4sIG5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuX3N0cmVhbWluZyA9IHN0cmVhbWluZztcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byBjaGFubmVsXG4gICAqL1xuICBzdWJzY3JpYmUobGlzdGVuZXI6IEZ1bmN0aW9uKTogU3Vic2NyaXB0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtaW5nLnN1YnNjcmliZSh0aGlzLm5hbWUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlKHN1YnNjcjogU3Vic2NyaXB0aW9uKSB7XG4gICAgdGhpcy5fc3RyZWFtaW5nLnVuc3Vic2NyaWJlKHRoaXMubmFtZSwgc3Vic2NyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1c2goZXZlbnRzOiBQdXNoRXZlbnQpOiBQcm9taXNlPFB1c2hFdmVudFJlc3VsdD47XG4gIHB1c2goZXZlbnRzOiBQdXNoRXZlbnQpOiBQcm9taXNlPFB1c2hFdmVudFJlc3VsdFtdPjtcbiAgYXN5bmMgcHVzaChldmVudHM6IFB1c2hFdmVudCB8IFB1c2hFdmVudFtdKSB7XG4gICAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoZXZlbnRzKTtcbiAgICBjb25zdCBwdXNoRXZlbnRzID0gQXJyYXkuaXNBcnJheShldmVudHMpID8gZXZlbnRzIDogW2V2ZW50c107XG4gICAgY29uc3QgY29ubjogQ29ubmVjdGlvbiA9ICh0aGlzLl9zdHJlYW1pbmcuX2Nvbm4gYXMgdW5rbm93bikgYXMgQ29ubmVjdGlvbjtcbiAgICBpZiAoIXRoaXMuX2lkKSB7XG4gICAgICB0aGlzLl9pZCA9IGNvbm5cbiAgICAgICAgLnNvYmplY3QoJ1N0cmVhbWluZ0NoYW5uZWwnKVxuICAgICAgICAuZmluZE9uZSh7IE5hbWU6IHRoaXMubmFtZSB9LCBbJ0lkJ10pXG4gICAgICAgIC50aGVuKChyZWMpID0+IHJlYz8uSWQpO1xuICAgIH1cbiAgICBjb25zdCBpZCA9IGF3YWl0IHRoaXMuX2lkO1xuICAgIGlmICghaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gc3RyZWFtaW5nIGNoYW5uZWwgYXZhaWxhYmxlIGZvciBuYW1lOiAke3RoaXMubmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgY2hhbm5lbFVybCA9IGAvc29iamVjdHMvU3RyZWFtaW5nQ2hhbm5lbC8ke2lkfS9wdXNoYDtcbiAgICBjb25zdCByZXRzID0gYXdhaXQgY29ubi5yZXF1ZXN0UG9zdDxQdXNoRXZlbnRSZXN1bHRbXT4oY2hhbm5lbFVybCwge1xuICAgICAgcHVzaEV2ZW50cyxcbiAgICB9KTtcbiAgICByZXR1cm4gaXNBcnJheSA/IHJldHMgOiByZXRzWzBdO1xuICB9XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKiBTdHJlYW1pbmcgQVBJIGNsYXNzXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJlYW1pbmc8UyBleHRlbmRzIFNjaGVtYT4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcbiAgX3RvcGljczogeyBbbmFtZTogc3RyaW5nXTogVG9waWM8UywgUmVjb3JkPiB9ID0ge307XG4gIF9mYXllQ2xpZW50czogeyBbY2xpZW50VHlwZTogc3RyaW5nXTogQ2xpZW50IH0gPSB7fTtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbm46IENvbm5lY3Rpb248Uz4pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX2Nvbm4gPSBjb25uO1xuICB9XG5cbiAgLyogQHByaXZhdGUgKi9cbiAgX2NyZWF0ZUNsaWVudChmb3JDaGFubmVsTmFtZT86IHN0cmluZyB8IG51bGwsIGV4dGVuc2lvbnM/OiBhbnlbXSkge1xuICAgIC8vIGZvckNoYW5uZWxOYW1lIGlzIGFkdmlzb3J5LCBmb3IgYW4gQVBJIHdvcmthcm91bmQuIEl0IGRvZXMgbm90IHJlc3RyaWN0IG9yIHNlbGVjdCB0aGUgY2hhbm5lbC5cbiAgICBjb25zdCBuZWVkc1JlcGxheUZpeCA9XG4gICAgICB0eXBlb2YgZm9yQ2hhbm5lbE5hbWUgPT09ICdzdHJpbmcnICYmIGZvckNoYW5uZWxOYW1lLmluZGV4T2YoJy91LycpID09PSAwO1xuICAgIGNvbnN0IGVuZHBvaW50VXJsID0gW1xuICAgICAgdGhpcy5fY29ubi5pbnN0YW5jZVVybCxcbiAgICAgIC8vIHNwZWNpYWwgZW5kcG9pbnQgXCIvY29tZXRkL3JlcGxheS94eC54XCIgaXMgb25seSBhdmFpbGFibGUgaW4gMzYuMC5cbiAgICAgIC8vIFNlZSBodHRwczovL3JlbGVhc2Vub3Rlcy5kb2NzLnNhbGVzZm9yY2UuY29tL2VuLXVzL3N1bW1lcjE2L3JlbGVhc2Utbm90ZXMvcm5fYXBpX3N0cmVhbWluZ19jbGFzc2ljX3JlcGxheS5odG1cbiAgICAgICdjb21ldGQnICtcbiAgICAgICAgKG5lZWRzUmVwbGF5Rml4ID09PSB0cnVlICYmIHRoaXMuX2Nvbm4udmVyc2lvbiA9PT0gJzM2LjAnXG4gICAgICAgICAgPyAnL3JlcGxheSdcbiAgICAgICAgICA6ICcnKSxcbiAgICAgIHRoaXMuX2Nvbm4udmVyc2lvbixcbiAgICBdLmpvaW4oJy8nKTtcbiAgICBjb25zdCBmYXllQ2xpZW50ID0gbmV3IENsaWVudChlbmRwb2ludFVybCwge30pO1xuICAgIGZheWVDbGllbnQuc2V0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgJ09BdXRoICcgKyB0aGlzLl9jb25uLmFjY2Vzc1Rva2VuKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShleHRlbnNpb25zKSkge1xuICAgICAgZm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuICAgICAgICBmYXllQ2xpZW50LmFkZEV4dGVuc2lvbihleHRlbnNpb24pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwcmV2ZW50IHN0cmVhbWluZyBBUEkgc2VydmVyIGVycm9yXG4gICAgY29uc3QgZGlzcGF0Y2hlciA9IChmYXllQ2xpZW50IGFzIGFueSkuX2Rpc3BhdGNoZXI7XG4gICAgaWYgKGRpc3BhdGNoZXIuZ2V0Q29ubmVjdGlvblR5cGVzKCkuaW5kZXhPZignY2FsbGJhY2stcG9sbGluZycpID09PSAtMSkge1xuICAgICAgZGlzcGF0Y2hlci5zZWxlY3RUcmFuc3BvcnQoJ2xvbmctcG9sbGluZycpO1xuICAgICAgZGlzcGF0Y2hlci5fdHJhbnNwb3J0LmJhdGNoaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBmYXllQ2xpZW50O1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICoqL1xuICBfZ2V0RmF5ZUNsaWVudChjaGFubmVsTmFtZTogc3RyaW5nKSB7XG4gICAgY29uc3QgaXNHZW5lcmljID0gY2hhbm5lbE5hbWUuaW5kZXhPZignL3UvJykgPT09IDA7XG4gICAgY29uc3QgY2xpZW50VHlwZSA9IGlzR2VuZXJpYyA/ICdnZW5lcmljJyA6ICdwdXNoVG9waWMnO1xuICAgIGlmICghdGhpcy5fZmF5ZUNsaWVudHNbY2xpZW50VHlwZV0pIHtcbiAgICAgIHRoaXMuX2ZheWVDbGllbnRzW2NsaWVudFR5cGVdID0gdGhpcy5fY3JlYXRlQ2xpZW50KGNoYW5uZWxOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2ZheWVDbGllbnRzW2NsaWVudFR5cGVdO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBuYW1lZCB0b3BpY1xuICAgKi9cbiAgdG9waWM8UiBleHRlbmRzIFJlY29yZCA9IFJlY29yZD4obmFtZTogc3RyaW5nKTogVG9waWM8UywgUj4ge1xuICAgIHRoaXMuX3RvcGljcyA9IHRoaXMuX3RvcGljcyB8fCB7fTtcbiAgICBjb25zdCB0b3BpYyA9ICh0aGlzLl90b3BpY3NbbmFtZV0gPVxuICAgICAgdGhpcy5fdG9waWNzW25hbWVdIHx8IG5ldyBUb3BpYzxTLCBSPih0aGlzLCBuYW1lKSk7XG4gICAgcmV0dXJuIHRvcGljIGFzIFRvcGljPFMsIFI+O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjaGFubmVsIGZvciBjaGFubmVsIG5hbWVcbiAgICovXG4gIGNoYW5uZWwobmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBDaGFubmVsKHRoaXMsIG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0b3BpYy9jaGFubmVsXG4gICAqL1xuICBzdWJzY3JpYmUobmFtZTogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiBTdWJzY3JpcHRpb24ge1xuICAgIGNvbnN0IGNoYW5uZWxOYW1lID0gbmFtZS5pbmRleE9mKCcvJykgPT09IDAgPyBuYW1lIDogJy90b3BpYy8nICsgbmFtZTtcbiAgICBjb25zdCBmYXllQ2xpZW50ID0gdGhpcy5fZ2V0RmF5ZUNsaWVudChjaGFubmVsTmFtZSk7XG4gICAgcmV0dXJuIGZheWVDbGllbnQuc3Vic2NyaWJlKGNoYW5uZWxOYW1lLCBsaXN0ZW5lcik7XG4gIH1cblxuICAvKipcbiAgICogVW5zdWJzY3JpYmUgdG9waWNcbiAgICovXG4gIHVuc3Vic2NyaWJlKG5hbWU6IHN0cmluZywgc3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb24pIHtcbiAgICBjb25zdCBjaGFubmVsTmFtZSA9IG5hbWUuaW5kZXhPZignLycpID09PSAwID8gbmFtZSA6ICcvdG9waWMvJyArIG5hbWU7XG4gICAgY29uc3QgZmF5ZUNsaWVudCA9IHRoaXMuX2dldEZheWVDbGllbnQoY2hhbm5lbE5hbWUpO1xuICAgIGZheWVDbGllbnQudW5zdWJzY3JpYmUoY2hhbm5lbE5hbWUsIHN1YnNjcmlwdGlvbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgU3RyZWFtaW5nIGNsaWVudCwgb3B0aW9uYWxseSB3aXRoIGV4dGVuc2lvbnNcbiAgICpcbiAgICogU2VlIEZheWUgZG9jcyBmb3IgaW1wbGVtZW50YXRpb24gZGV0YWlsczogaHR0cHM6Ly9mYXllLmpjb2dsYW4uY29tL2Jyb3dzZXIvZXh0ZW5zaW9ucy5odG1sXG4gICAqXG4gICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogY29uc3QganNmb3JjZSA9IHJlcXVpcmUoJ2pzZm9yY2UnKTtcbiAgICpcbiAgICogLy8gRXN0YWJsaXNoIGEgU2FsZXNmb3JjZSBjb25uZWN0aW9uLiAoRGV0YWlscyBlbGlkZWQpXG4gICAqIGNvbnN0IGNvbm4gPSBuZXcganNmb3JjZS5Db25uZWN0aW9uKHsg4oCmIH0pO1xuICAgKlxuICAgKiBjb25zdCBmYXllQ2xpZW50ID0gY29ubi5zdHJlYW1pbmcuY3JlYXRlQ2xpZW50KCk7XG4gICAqXG4gICAqIGNvbnN0IHN1YnNjcmlwdGlvbiA9IGZheWVDbGllbnQuc3Vic2NyaWJlKGNoYW5uZWwsIGRhdGEgPT4ge1xuICAgKiAgIGNvbnNvbGUubG9nKCd0b3BpYyByZWNlaXZlZCBkYXRhJywgZGF0YSk7XG4gICAqIH0pO1xuICAgKlxuICAgKiBzdWJzY3JpcHRpb24uY2FuY2VsKCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBFeGFtcGxlIHdpdGggZXh0ZW5zaW9ucywgdXNpbmcgUmVwbGF5ICYgQXV0aCBGYWlsdXJlIGV4dGVuc2lvbnMgaW4gYSBzZXJ2ZXItc2lkZSBOb2RlLmpzIGFwcDpcbiAgICpcbiAgICogYGBgamF2YXNjcmlwdFxuICAgKiBjb25zdCBqc2ZvcmNlID0gcmVxdWlyZSgnanNmb3JjZScpO1xuICAgKiBjb25zdCB7IFN0cmVhbWluZ0V4dGVuc2lvbiB9ID0gcmVxdWlyZSgnanNmb3JjZS9hcGkvc3RyZWFtaW5nJyk7XG4gICAqXG4gICAqIC8vIEVzdGFibGlzaCBhIFNhbGVzZm9yY2UgY29ubmVjdGlvbi4gKERldGFpbHMgZWxpZGVkKVxuICAgKiBjb25zdCBjb25uID0gbmV3IGpzZm9yY2UuQ29ubmVjdGlvbih7IOKApiB9KTtcbiAgICpcbiAgICogY29uc3QgY2hhbm5lbCA9IFwiL2V2ZW50L015X0V2ZW50X19lXCI7XG4gICAqIGNvbnN0IHJlcGxheUlkID0gLTI7IC8vIC0yIGlzIGFsbCByZXRhaW5lZCBldmVudHNcbiAgICpcbiAgICogY29uc3QgZXhpdENhbGxiYWNrID0gKCkgPT4gcHJvY2Vzcy5leGl0KDEpO1xuICAgKiBjb25zdCBhdXRoRmFpbHVyZUV4dCA9IG5ldyBTdHJlYW1pbmdFeHRlbnNpb24uQXV0aEZhaWx1cmUoZXhpdENhbGxiYWNrKTtcbiAgICpcbiAgICogY29uc3QgcmVwbGF5RXh0ID0gbmV3IFN0cmVhbWluZ0V4dGVuc2lvbi5SZXBsYXkoY2hhbm5lbCwgcmVwbGF5SWQpO1xuICAgKlxuICAgKiBjb25zdCBmYXllQ2xpZW50ID0gY29ubi5zdHJlYW1pbmcuY3JlYXRlQ2xpZW50KFtcbiAgICogICBhdXRoRmFpbHVyZUV4dCxcbiAgICogICByZXBsYXlFeHRcbiAgICogXSk7XG4gICAqXG4gICAqIGNvbnN0IHN1YnNjcmlwdGlvbiA9IGZheWVDbGllbnQuc3Vic2NyaWJlKGNoYW5uZWwsIGRhdGEgPT4ge1xuICAgKiAgIGNvbnNvbGUubG9nKCd0b3BpYyByZWNlaXZlZCBkYXRhJywgZGF0YSk7XG4gICAqIH0pO1xuICAgKlxuICAgKiBzdWJzY3JpcHRpb24uY2FuY2VsKCk7XG4gICAqIGBgYFxuICAgKi9cbiAgY3JlYXRlQ2xpZW50KGV4dGVuc2lvbnM6IGFueVtdKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NyZWF0ZUNsaWVudChudWxsLCBleHRlbnNpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgeyBTdHJlYW1pbmdFeHRlbnNpb24gfTtcblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKlxuICogUmVnaXN0ZXIgaG9vayBpbiBjb25uZWN0aW9uIGluc3RhbnRpYXRpb24gZm9yIGR5bmFtaWNhbGx5IGFkZGluZyB0aGlzIEFQSSBtb2R1bGUgZmVhdHVyZXNcbiAqL1xucmVnaXN0ZXJNb2R1bGUoJ3N0cmVhbWluZycsIChjb25uKSA9PiBuZXcgU3RyZWFtaW5nKGNvbm4pKTtcblxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtaW5nO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlBLElBQUFBLE9BQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLEtBQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLFFBQUEsR0FBQUYsT0FBQTtBQUdBLElBQUFHLGtCQUFBLEdBQUFDLHVCQUFBLENBQUFKLE9BQUE7QUFBNERLLE9BQUEsQ0FBQUYsa0JBQUEsR0FBQUEsa0JBQUE7QUFUNUQ7QUFDQTtBQUNBO0FBQ0E7O0FBUUE7QUFDQTtBQUNBOztBQWdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1HLEtBQUssQ0FBcUM7RUFJOUNDLFdBQVdBLENBQUNDLFNBQXVCLEVBQUVDLElBQVksRUFBRTtJQUFBLElBQUFDLGdCQUFBLENBQUFDLE9BQUE7SUFBQSxJQUFBRCxnQkFBQSxDQUFBQyxPQUFBO0lBQ2pELElBQUksQ0FBQ0MsVUFBVSxHQUFHSixTQUFTO0lBQzNCLElBQUksQ0FBQ0MsSUFBSSxHQUFHQSxJQUFJO0VBQ2xCOztFQUVBO0FBQ0Y7QUFDQTtFQUNFSSxTQUFTQSxDQUFDQyxRQUFnRCxFQUFnQjtJQUN4RSxPQUFPLElBQUksQ0FBQ0YsVUFBVSxDQUFDQyxTQUFTLENBQUMsSUFBSSxDQUFDSixJQUFJLEVBQUVLLFFBQVEsQ0FBQztFQUN2RDs7RUFFQTtBQUNGO0FBQ0E7RUFDRUMsV0FBV0EsQ0FBQ0MsTUFBb0IsRUFBRTtJQUNoQyxJQUFJLENBQUNKLFVBQVUsQ0FBQ0csV0FBVyxDQUFDLElBQUksQ0FBQ04sSUFBSSxFQUFFTyxNQUFNLENBQUM7SUFDOUMsT0FBTyxJQUFJO0VBQ2I7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLE9BQU8sQ0FBbUI7RUFLOUJWLFdBQVdB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