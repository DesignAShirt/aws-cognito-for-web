'use strict';

var MockLocalStorage = require('mock-localstorage');
global.localStorage = new MockLocalStorage();

var uniqueStrings = [];

module.exports = {
  mock: function(object, method, handler, context) {
    context = context || object;
    var _unmocked = object[method];
    var mocked = function() {
      return handler.apply(context, arguments);
    };
    mocked.cleanup = function() {
      object[method] = _unmocked.bind(context);
    };
    object[method] = mocked.bind(context);
    return mocked;
  },

  // generate a unique-per-run string
  uniqueString: function(prefix) {
    prefix = prefix || '';
    var str;
    while(uniqueStrings.indexOf(str = prefix + 'unique_string_' + Math.random()) > -1);
    uniqueStrings.push(str);
    return str;
  },
};
