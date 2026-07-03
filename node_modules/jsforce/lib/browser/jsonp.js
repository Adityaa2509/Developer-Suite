"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _setTimeout2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set-timeout"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _stream = require("stream");
/**
 *
 */

let _index = 0;
async function processJsonpRequest(params, jsonpParam, timeout) {
  if (params.method.toUpperCase() !== 'GET') {
    throw new Error('JSONP only supports GET request.');
  }
  _index += 1;
  const cbFuncName = `_jsforce_jsonpCallback_${_index}`;
  const callbacks = window;
  let url = params.url;
  url += (0, _indexOf.default)(url).call(url, '?') > 0 ? '&' : '?';
  url += `${jsonpParam}=${cbFuncName}`;
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  if (document.documentElement) {
    document.documentElement.appendChild(script);
  }
  let pid;
  try {
    const res = await new _promise.default((resolve, reject) => {
      pid = (0, _setTimeout2.default)(() => {
        reject(new Error('JSONP call time out.'));
      }, timeout);
      callbacks[cbFuncName] = resolve;
    });
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json'
      },
      body: (0, _stringify.default)(res)
    };
  } finally {
    clearTimeout(pid);
    if (document.documentElement) {
      document.documentElement.removeChild(script);
    }
    delete callbacks[cbFuncName];
  }
}
function createRequest(jsonpParam = 'callback', timeout = 10000) {
  return params => {
    const stream = new _stream.Transform({
      transform(chunk, encoding, callback) {
        callback();
      },
      flush() {
        (async () => {
          const response = await processJsonpRequest(params, jsonpParam, timeout);
          stream.emit('response', response);
          stream.emit('complete', response);
          stream.push(response.body);
          stream.push(null);
        })();
      }
    });
    stream.end();
    return stream;
  };
}
var _default = {
  supported: typeof window !== 'undefined' && typeof document !== 'undefined',
  createRequest
};
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfc3RyZWFtIiwicmVxdWlyZSIsIl9pbmRleCIsInByb2Nlc3NKc29ucFJlcXVlc3QiLCJwYXJhbXMiLCJqc29ucFBhcmFtIiwidGltZW91dCIsIm1ldGhvZCIsInRvVXBwZXJDYXNlIiwiRXJyb3IiLCJjYkZ1bmNOYW1lIiwiY2FsbGJhY2tzIiwid2luZG93IiwidXJsIiwiX2luZGV4T2YiLCJkZWZhdWx0IiwiY2FsbCIsInNjcmlwdCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInR5cGUiLCJzcmMiLCJkb2N1bWVudEVsZW1lbnQiLCJhcHBlbmRDaGlsZCIsInBpZCIsInJlcyIsIl9wcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9zZXRUaW1lb3V0MiIsInN0YXR1c0NvZGUiLCJoZWFkZXJzIiwiYm9keSIsIl9zdHJpbmdpZnkiLCJjbGVhclRpbWVvdXQiLCJyZW1vdmVDaGlsZCIsImNyZWF0ZVJlcXVlc3QiLCJzdHJlYW0iLCJUcmFuc2Zvcm0iLCJ0cmFuc2Zvcm0iLCJjaHVuayIsImVuY29kaW5nIiwiY2FsbGJhY2siLCJmbHVzaCIsInJlc3BvbnNlIiwiZW1pdCIsInB1c2giLCJlbmQiLCJfZGVmYXVsdCIsInN1cHBvcnRlZCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvYnJvd3Nlci9qc29ucC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqXG4gKi9cbmltcG9ydCB7IFRyYW5zZm9ybSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgeyBIdHRwUmVxdWVzdCB9IGZyb20gJy4uL3R5cGVzJztcblxubGV0IF9pbmRleCA9IDA7XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NKc29ucFJlcXVlc3QoXG4gIHBhcmFtczogSHR0cFJlcXVlc3QsXG4gIGpzb25wUGFyYW06IHN0cmluZyxcbiAgdGltZW91dDogbnVtYmVyLFxuKSB7XG4gIGlmIChwYXJhbXMubWV0aG9kLnRvVXBwZXJDYXNlKCkgIT09ICdHRVQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdKU09OUCBvbmx5IHN1cHBvcnRzIEdFVCByZXF1ZXN0LicpO1xuICB9XG4gIF9pbmRleCArPSAxO1xuICBjb25zdCBjYkZ1bmNOYW1lID0gYF9qc2ZvcmNlX2pzb25wQ2FsbGJhY2tfJHtfaW5kZXh9YDtcbiAgY29uc3QgY2FsbGJhY2tzOiBhbnkgPSB3aW5kb3c7XG4gIGxldCB1cmwgPSBwYXJhbXMudXJsO1xuICB1cmwgKz0gdXJsLmluZGV4T2YoJz8nKSA+IDAgPyAnJicgOiAnPyc7XG4gIHVybCArPSBgJHtqc29ucFBhcmFtfT0ke2NiRnVuY05hbWV9YDtcbiAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gIHNjcmlwdC5zcmMgPSB1cmw7XG4gIGlmIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpIHtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgfVxuICBsZXQgcGlkO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKCdKU09OUCBjYWxsIHRpbWUgb3V0LicpKTtcbiAgICAgIH0sIHRpbWVvdXQpO1xuICAgICAgY2FsbGJhY2tzW2NiRnVuY05hbWVdID0gcmVzb2x2ZTtcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXMpLFxuICAgIH07XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHBpZCk7XG4gICAgaWYgKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkge1xuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgfVxuICAgIGRlbGV0ZSBjYWxsYmFja3NbY2JGdW5jTmFtZV07XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlUmVxdWVzdChcbiAganNvbnBQYXJhbTogc3RyaW5nID0gJ2NhbGxiYWNrJyxcbiAgdGltZW91dDogbnVtYmVyID0gMTAwMDAsXG4pIHtcbiAgcmV0dXJuIChwYXJhbXM6IEh0dHBSZXF1ZXN0KSA9PiB7XG4gICAgY29uc3Qgc3RyZWFtID0gbmV3IFRyYW5zZm9ybSh7XG4gICAgICB0cmFuc2Zvcm0oY2h1bmssIGVuY29kaW5nLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSxcbiAgICAgIGZsdXNoKCkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcHJvY2Vzc0pzb25wUmVxdWVzdChcbiAgICAgICAgICAgIHBhcmFtcyxcbiAgICAgICAgICAgIGpzb25wUGFyYW0sXG4gICAgICAgICAgICB0aW1lb3V0LFxuICAgICAgICAgICk7XG4gICAgICAgICAgc3RyZWFtLmVtaXQoJ3Jlc3BvbnNlJywgcmVzcG9uc2UpO1xuICAgICAgICAgIHN0cmVhbS5lbWl0KCdjb21wbGV0ZScsIHJlc3BvbnNlKTtcbiAgICAgICAgICBzdHJlYW0ucHVzaChyZXNwb25zZS5ib2R5KTtcbiAgICAgICAgICBzdHJlYW0ucHVzaChudWxsKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc3RyZWFtLmVuZCgpO1xuICAgIHJldHVybiBzdHJlYW07XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgc3VwcG9ydGVkOiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnLFxuICBjcmVhdGVS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