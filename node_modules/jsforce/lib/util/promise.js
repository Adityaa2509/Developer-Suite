"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.StreamPromise = void 0;
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _stream = require("stream");
/**
 *
 */

/**
 *
 */

/**
 *
 */
class StreamPromise extends _promise.default {
  stream() {
    // dummy
    return new _stream.Duplex();
  }
  static create(builder) {
    const {
      stream,
      promise
    } = builder();
    const streamPromise = new StreamPromise((resolve, reject) => {
      promise.then(resolve, reject);
    });
    streamPromise.stream = () => stream;
    return streamPromise;
  }
}
exports.StreamPromise = StreamPromise;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfc3RyZWFtIiwicmVxdWlyZSIsIlN0cmVhbVByb21pc2UiLCJfcHJvbWlzZSIsImRlZmF1bHQiLCJzdHJlYW0iLCJEdXBsZXgiLCJjcmVhdGUiLCJidWlsZGVyIiwicHJvbWlzZSIsInN0cmVhbVByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwidGhlbiIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbC9wcm9taXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICpcbiAqL1xuaW1wb3J0IHsgRHVwbGV4IH0gZnJvbSAnc3RyZWFtJztcblxuLyoqXG4gKlxuICovXG5leHBvcnQgdHlwZSBTdHJlYW1Qcm9taXNlQnVpbGRlcjxUPiA9ICgpID0+IHtcbiAgc3RyZWFtOiBEdXBsZXg7XG4gIHByb21pc2U6IFByb21pc2U8VD47XG59O1xuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJlYW1Qcm9taXNlPFQ+IGV4dGVuZHMgUHJvbWlzZTxUPiB7XG4gIHN0cmVhbSgpIHtcbiAgICAvLyBkdW1teVxuICAgIHJldHVybiBuZXcgRHVwbGV4KCk7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlPFQ+KGJ1aWxkZXI6IFN0cmVhbVByb21pc2VCdWlsZGVyPFQ+KSB7XG4gICAgY29uc3QgeyBzdHJlYW0sIHByb21pc2UgfSA9IGJ1aWxkZXIoKTtcbiAgICBjb25zdCBzdHJlYW1Qcm9taXNlID0gbmV3IFN0cmVhbVByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfSk7XG4gICAgc3RyZWFtUHJvbWlzZS5zdHJlYW0gPSAoKSA9PiBzdHJlYW07XG4gICAgcmV0dXJuIHN0cmVhbVByb21pc2U7XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBR0EsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBSEE7QUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFNQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLFNBQUFDLFFBQUEsQ0FBQUMsT0FBQSxDQUF1QjtFQUMvQ0MsTUFBTUEsQ0FBQSxFQUFHO0lBQ1A7SUFDQSxPQUFPLElBQUlDLGNBQU0sQ0FBQyxDQUFDO0VBQ3JCO0VBRUEsT0FBT0MsTUFBTUEsQ0FBSUMsT0FBZ0MsRUFBRTtJQUNqRCxNQUFNO01BQUVILE1BQU07TUFBRUk7SUFBUSxDQUFDLEdBQUdELE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLE1BQU1FLGFBQWEsR0FBRyxJQUFJUixhQUFhLENBQUksQ0FBQ1MsT0FBTyxFQUFFQyxNQUFNLEtBQUs7TUFDOURILE9BQU8sQ0FBQ0ksSUFBSSxDQUFDRixPQUFPLEVBQUVDLE1BQU0sQ0FBQztJQUMvQixDQUFDLENBQUM7SUFDRkYsYUFBYSxDQUFDTCxNQUFNLEdBQUcsTUFBTUEsTUFBTTtJQUNuQyxPQUFPSyxhQUFhO0VBQ3RCO0FBQ0Y7QUFBQ0ksT0FBQSxDQUFBWixhQUFBLEdBQUFBLGFBQUEifQ==