"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.Replay = exports.AuthFailure = void 0;
var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/parse-int"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
/**
 * Faye Client extensions: https://faye.jcoglan.com/browser/extensions.html
 *
 * For use with Streaming.prototype.createClient()
 **/

/*-------------------------------------------*/
/**
 * Constructor for an auth failure detector extension
 *
 * Based on new feature released with Salesforce Spring '18:
 * https://releasenotes.docs.salesforce.com/en-us/spring18/release-notes/rn_messaging_cometd_auth_validation.htm?edition=&impact=
 *
 * Example triggering error message:
 *
 * ```
 * {
 *   "ext":{
 *     "sfdc":{"failureReason":"401::Authentication invalid"},
 *     "replay":true},
 *   "advice":{"reconnect":"none"},
 *   "channel":"/meta/handshake",
 *   "error":"403::Handshake denied",
 *   "successful":false
 * }
 * ```
 *
 * Example usage:
 *
 * ```javascript
 * const jsforce = require('jsforce');
 * const { StreamingExtension } = require('jsforce/api/streaming');
 *
 * const conn = new jsforce.Connection({ … });
 *
 * const channel = "/event/My_Event__e";
 *
 * // Exit the Node process when auth fails
 * const exitCallback = () => process.exit(1);
 * const authFailureExt = new StreamingExtension.AuthFailure(exitCallback);
 *
 * const fayeClient = conn.streaming.createClient([ authFailureExt ]);
 *
 * const subscription = fayeClient.subscribe(channel, data => {
 *   console.log('topic received data', data);
 * });
 *
 * subscription.cancel();
 * ```
 *
 * @param {Function} failureCallback - Invoked when authentication becomes invalid
 */
class AuthFailure {
  constructor(failureCallback) {
    (0, _defineProperty2.default)(this, "_failureCallback", void 0);
    this._failureCallback = failureCallback;
  }
  incoming(message, callback) {
    if ((message.channel === '/meta/connect' || message.channel === '/meta/handshake') && message.advice && message.advice.reconnect == 'none') {
      this._failureCallback(message);
    } else {
      callback(message);
    }
  }
}

/*-------------------------------------------*/
exports.AuthFailure = AuthFailure;
const REPLAY_FROM_KEY = 'replay';

/**
 * Constructor for a durable streaming replay extension
 *
 * Modified from original Salesforce demo source code:
 * https://github.com/developerforce/SalesforceDurableStreamingDemo/blob/3d4a56eac956f744ad6c22e6a8141b6feb57abb9/staticresources/cometdReplayExtension.resource
 *
 * Example usage:
 *
 * ```javascript
 * const jsforce = require('jsforce');
 * const { StreamingExtension } = require('jsforce/api/streaming');
 
 * const conn = new jsforce.Connection({ … });
 *
 * const channel = "/event/My_Event__e";
 * const replayId = -2; // -2 is all retained events
 *
 * const replayExt = new StreamingExtension.Replay(channel, replayId);
 *
 * const fayeClient = conn.streaming.createClient([ replayExt ]);
 *
 * const subscription = fayeClient.subscribe(channel, data => {
 *   console.log('topic received data', data);
 * });
 *
 * subscription.cancel();
 * ```
 */
class Replay {
  constructor(channel, replayId) {
    (0, _defineProperty2.default)(this, "_extensionEnabled", void 0);
    (0, _defineProperty2.default)(this, "_replay", void 0);
    (0, _defineProperty2.default)(this, "_channel", void 0);
    this._extensionEnabled = replayId != null;
    this._channel = channel;
    this._replay = replayId;
  }
  setExtensionEnabled(extensionEnabled) {
    this._extensionEnabled = extensionEnabled;
  }
  setReplay(replay) {
    this._replay = (0, _parseInt2.default)(replay, 10);
  }
  setChannel(channel) {
    this._channel = channel;
  }
  incoming(message, callback) {
    if (message.channel === '/meta/handshake') {
      if (message.ext && message.ext[REPLAY_FROM_KEY] == true) {
        this._extensionEnabled = true;
      }
    } else if (message.channel === this._channel && message.data && message.data.event && message.data.event.replayId) {
      this._replay = message.data.event.replayId;
    }
    callback(message);
  }
  outgoing(message, callback) {
    if (message.channel === '/meta/subscribe') {
      if (this._extensionEnabled) {
        if (!message.ext) {
          message.ext = {};
        }
        const replayFromMap = {
          [this._channel]: this._replay
        };
        // add "ext : { "replay" : { CHANNEL : REPLAY_VALUE }}" to subscribe message
        message.ext[REPLAY_FROM_KEY] = replayFromMap;
      }
    }
    callback(message);
  }
}
exports.Replay = Replay;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJBdXRoRmFpbHVyZSIsImNvbnN0cnVjdG9yIiwiZmFpbHVyZUNhbGxiYWNrIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJfZmFpbHVyZUNhbGxiYWNrIiwiaW5jb21pbmciLCJtZXNzYWdlIiwiY2FsbGJhY2siLCJjaGFubmVsIiwiYWR2aWNlIiwicmVjb25uZWN0IiwiZXhwb3J0cyIsIlJFUExBWV9GUk9NX0tFWSIsIlJlcGxheSIsInJlcGxheUlkIiwiX2V4dGVuc2lvbkVuYWJsZWQiLCJfY2hhbm5lbCIsIl9yZXBsYXkiLCJzZXRFeHRlbnNpb25FbmFibGVkIiwiZXh0ZW5zaW9uRW5hYmxlZCIsInNldFJlcGxheSIsInJlcGxheSIsIl9wYXJzZUludDIiLCJzZXRDaGFubmVsIiwiZXh0IiwiZGF0YSIsImV2ZW50Iiwib3V0Z29pbmciLCJyZXBsYXlGcm9tTWFwIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2FwaS9zdHJlYW1pbmcvZXh0ZW5zaW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRmF5ZSBDbGllbnQgZXh0ZW5zaW9uczogaHR0cHM6Ly9mYXllLmpjb2dsYW4uY29tL2Jyb3dzZXIvZXh0ZW5zaW9ucy5odG1sXG4gKlxuICogRm9yIHVzZSB3aXRoIFN0cmVhbWluZy5wcm90b3R5cGUuY3JlYXRlQ2xpZW50KClcbiAqKi9cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogQ29uc3RydWN0b3IgZm9yIGFuIGF1dGggZmFpbHVyZSBkZXRlY3RvciBleHRlbnNpb25cbiAqXG4gKiBCYXNlZCBvbiBuZXcgZmVhdHVyZSByZWxlYXNlZCB3aXRoIFNhbGVzZm9yY2UgU3ByaW5nICcxODpcbiAqIGh0dHBzOi8vcmVsZWFzZW5vdGVzLmRvY3Muc2FsZXNmb3JjZS5jb20vZW4tdXMvc3ByaW5nMTgvcmVsZWFzZS1ub3Rlcy9ybl9tZXNzYWdpbmdfY29tZXRkX2F1dGhfdmFsaWRhdGlvbi5odG0/ZWRpdGlvbj0maW1wYWN0PVxuICpcbiAqIEV4YW1wbGUgdHJpZ2dlcmluZyBlcnJvciBtZXNzYWdlOlxuICpcbiAqIGBgYFxuICoge1xuICogICBcImV4dFwiOntcbiAqICAgICBcInNmZGNcIjp7XCJmYWlsdXJlUmVhc29uXCI6XCI0MDE6OkF1dGhlbnRpY2F0aW9uIGludmFsaWRcIn0sXG4gKiAgICAgXCJyZXBsYXlcIjp0cnVlfSxcbiAqICAgXCJhZHZpY2VcIjp7XCJyZWNvbm5lY3RcIjpcIm5vbmVcIn0sXG4gKiAgIFwiY2hhbm5lbFwiOlwiL21ldGEvaGFuZHNoYWtlXCIsXG4gKiAgIFwiZXJyb3JcIjpcIjQwMzo6SGFuZHNoYWtlIGRlbmllZFwiLFxuICogICBcInN1Y2Nlc3NmdWxcIjpmYWxzZVxuICogfVxuICogYGBgXG4gKlxuICogRXhhbXBsZSB1c2FnZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBqc2ZvcmNlID0gcmVxdWlyZSgnanNmb3JjZScpO1xuICogY29uc3QgeyBTdHJlYW1pbmdFeHRlbnNpb24gfSA9IHJlcXVpcmUoJ2pzZm9yY2UvYXBpL3N0cmVhbWluZycpO1xuICpcbiAqIGNvbnN0IGNvbm4gPSBuZXcganNmb3JjZS5Db25uZWN0aW9uKHsg4oCmIH0pO1xuICpcbiAqIGNvbnN0IGNoYW5uZWwgPSBcIi9ldmVudC9NeV9FdmVudF9fZVwiO1xuICpcbiAqIC8vIEV4aXQgdGhlIE5vZGUgcHJvY2VzcyB3aGVuIGF1dGggZmFpbHNcbiAqIGNvbnN0IGV4aXRDYWxsYmFjayA9ICgpID0+IHByb2Nlc3MuZXhpdCgxKTtcbiAqIGNvbnN0IGF1dGhGYWlsdXJlRXh0ID0gbmV3IFN0cmVhbWluZ0V4dGVuc2lvbi5BdXRoRmFpbHVyZShleGl0Q2FsbGJhY2spO1xuICpcbiAqIGNvbnN0IGZheWVDbGllbnQgPSBjb25uLnN0cmVhbWluZy5jcmVhdGVDbGllbnQoWyBhdXRoRmFpbHVyZUV4dCBdKTtcbiAqXG4gKiBjb25zdCBzdWJzY3JpcHRpb24gPSBmYXllQ2xpZW50LnN1YnNjcmliZShjaGFubmVsLCBkYXRhID0+IHtcbiAqICAgY29uc29sZS5sb2coJ3RvcGljIHJlY2VpdmVkIGRhdGEnLCBkYXRhKTtcbiAqIH0pO1xuICpcbiAqIHN1YnNjcmlwdGlvbi5jYW5jZWwoKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZhaWx1cmVDYWxsYmFjayAtIEludm9rZWQgd2hlbiBhdXRoZW50aWNhdGlvbiBiZWNvbWVzIGludmFsaWRcbiAqL1xuZXhwb3J0IGNsYXNzIEF1dGhGYWlsdXJlIHtcbiAgX2ZhaWx1cmVDYWxsYmFjazogRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3IoZmFpbHVyZUNhbGxiYWNrOiBGdW5jdGlvbikge1xuICAgIHRoaXMuX2ZhaWx1cmVDYWxsYmFjayA9IGZhaWx1cmVDYWxsYmFjaztcbiAgfVxuXG4gIGluY29taW5nKG1lc3NhZ2U6IGFueSwgY2FsbGJhY2s6IEZ1bmN0aW9uKSB7XG4gICAgaWYgKFxuICAgICAgKG1lc3NhZ2UuY2hhbm5lbCA9PT0gJy9tZXRhL2Nvbm5lY3QnIHx8XG4gICAgICAgIG1lc3NhZ2UuY2hhbm5lbCA9PT0gJy9tZXRhL2hhbmRzaGFrZScpICYmXG4gICAgICBtZXNzYWdlLmFkdmljZSAmJlxuICAgICAgbWVzc2FnZS5hZHZpY2UucmVjb25uZWN0ID09ICdub25lJ1xuICAgICkge1xuICAgICAgdGhpcy5fZmFpbHVyZUNhbGxiYWNrKG1lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhtZXNzYWdlKTtcbiAgICB9XG4gIH1cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmNvbnN0IFJFUExBWV9GUk9NX0tFWSA9ICdyZXBsYXknO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yIGZvciBhIGR1cmFibGUgc3RyZWFtaW5nIHJlcGxheSBleHRlbnNpb25cbiAqXG4gKiBNb2RpZmllZCBmcm9tIG9yaWdpbmFsIFNhbGVzZm9yY2UgZGVtbyBzb3VyY2UgY29kZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9kZXZlbG9wZXJmb3JjZS9TYWxlc2ZvcmNlRHVyYWJsZVN0cmVhbWluZ0RlbW8vYmxvYi8zZDRhNTZlYWM5NTZmNzQ0YWQ2YzIyZTZhODE0MWI2ZmViNTdhYmI5L3N0YXRpY3Jlc291cmNlcy9jb21ldGRSZXBsYXlFeHRlbnNpb24ucmVzb3VyY2VcbiAqXG4gKiBFeGFtcGxlIHVzYWdlOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IGpzZm9yY2UgPSByZXF1aXJlKCdqc2ZvcmNlJyk7XG4gKiBjb25zdCB7IFN0cmVhbWluZ0V4dGVuc2lvbiB9ID0gcmVxdWlyZSgnanNmb3JjZS9hcGkvc3RyZWFtaW5nJyk7XG4gXG4gKiBjb25zdCBjb25uID0gbmV3IGpzZm9yY2UuQ29ubmVjdGlvbih7IOKApiB9KTtcbiAqXG4gKiBjb25zdCBjaGFubmVsID0gXCIvZXZlbnQvTXlfRXZlbnRfX2VcIjtcbiAqIGNvbnN0IHJlcGxheUlkID0gLTI7IC8vIC0yIGlzIGFsbCByZXRhaW5lZCBldmVudHNcbiAqXG4gKiBjb25zdCByZXBsYXlFeHQgPSBuZXcgU3RyZWFtaW5nRXh0ZW5zaW9uLlJlcGxheShjaGFubmVsLCByZXBsYXlJZCk7XG4gKlxuICogY29uc3QgZmF5ZUNsaWVudCA9IGNvbm4uc3RyZWFtaW5nLmNyZWF0ZUNsaWVudChbIHJlcGxheUV4dCBdKTtcbiAqXG4gKiBjb25zdCBzdWJzY3JpcHRpb24gPSBmYXllQ2xpZW50LnN1YnNjcmliZShjaGFubmVsLCBkYXRhID0+IHtcbiAqICAgY29uc29sZS5sb2coJ3RvcGljIHJlY2VpdmVkIGRhdGEnLCBkYXRhKTtcbiAqIH0pO1xuICpcbiAqIHN1YnNjcmlwdGlvbi5jYW5jZWwoKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgUmVwbGF5IHtcbiAgX2V4dGVuc2lvbkVuYWJsZWQ6IGJvb2xlYW47XG4gIF9yZXBsYXk6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQ7XG4gIF9jaGFubmVsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoY2hhbm5lbDogc3RyaW5nLCByZXBsYXlJZD86IG51bWJlciB8IG51bGwpIHtcbiAgICB0aGlzLl9leHRlbnNpb25FbmFibGVkID0gcmVwbGF5SWQgIT0gbnVsbDtcbiAgICB0aGlzLl9jaGFubmVsID0gY2hhbm5lbDtcbiAgICB0aGlzLl9yZXBsYXkgPSByZXBsYXlJZDtcbiAgfVxuXG4gIHNldEV4dGVuc2lvbkVuYWJsZWQoZXh0ZW5zaW9uRW5hYmxlZDogYm9vbGVhbikge1xuICAgIHRoaXMuX2V4dGVuc2lvbkVuYWJsZWQgPSBleHRlbnNpb25FbmFibGVkO1xuICB9XG5cbiAgc2V0UmVwbGF5KHJlcGxheTogc3RyaW5nKSB7XG4gICAgdGhpcy5fcmVwbGF5ID0gcGFyc2VJbnQocmVwbGF5LCAxMCk7XG4gIH1cblxuICBzZXRDaGFubmVsKGNoYW5uZWw6IHN0cmluZykge1xuICAgIHRoaXMuX2NoYW5uZWwgPSBjaGFubmVsO1xuICB9XG5cbiAgaW5jb21pbmcobWVzc2FnZTogYW55LCBjYWxsYmFjazogRnVuY3Rpb24pIHtcbiAgICBpZiAobWVzc2FnZS5jaGFubmVsID09PSAnL21ldGEvaGFuZHNoYWtlJykge1xuICAgICAgaWYgKG1lc3NhZ2UuZXh0ICYmIG1lc3NhZ2UuZXh0W1JFUExBWV9GUk9NX0tFWV0gPT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLl9leHRlbnNpb25FbmFibGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgbWVzc2FnZS5jaGFubmVsID09PSB0aGlzLl9jaGFubmVsICYmXG4gICAgICBtZXNzYWdlLmRhdGEgJiZcbiAgICAgIG1lc3NhZ2UuZGF0YS5ldmVudCAmJlxuICAgICAgbWVzc2FnZS5kYXRhLmV2ZW50LnJlcGxheUlkXG4gICAgKSB7XG4gICAgICB0aGlzLl9yZXBsYXkgPSBtZXNzYWdlLmRhdGEuZXZlbnQucmVwbGF5SWQ7XG4gICAgfVxuICAgIGNhbGxiYWNrKG1lc3NhZ2UpO1xuICB9XG5cbiAgb3V0Z29pbmcobWVzc2FnZTogYW55LCBjYWxsYmFjazogRnVuY3Rpb24pIHtcbiAgICBpZiAobWVzc2FnZS5jaGFubmVsID09PSAnL21ldGEvc3Vic2NyaWJlJykge1xuICAgICAgaWYgKHRoaXMuX2V4dGVuc2lvbkVuYWJsZWQpIHtcbiAgICAgICAgaWYgKCFtZXNzYWdlLmV4dCkge1xuICAgICAgICAgIG1lc3NhZ2UuZXh0ID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVwbGF5RnJvbU1hcCA9IHtcbiAgICAgICAgICBbdGhpcy5fY2hhbm5lbF06IHRoaXMuX3JlcGxheSxcbiAgICAgICAgfTtcbiAgICAgICAgLy8gYWRkIFwiZXh0IDogeyBcInJlcGxheVwiIDogeyBDSEFOTkVMIDogUkVQTEFZX1ZBTFVFIH19XCIgdG8gc3Vic2NyaWJlIG1lc3NhZ2VcbiAgICAgICAgbWVzc2FnZS5leHRbUkVQTEFZX0ZST01fS0VZXSA9IHJlcGxheUZyb21NYXA7XG4gICAgICB9XG4gICAgfVxuICAgIGNhbGxiYWNrKG1lc3NhZ2UpO1xuICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUEsV0FBVyxDQUFDO0VBR3ZCQyxXQUFXQSxDQUFDQyxlQUF5QixFQUFFO0lBQUEsSUFBQUMsZ0JBQUEsQ0FBQUMsT0FBQTtJQUNyQyxJQUFJLENBQUNDLGdCQUFnQixHQUFHSCxlQUFlO0VB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