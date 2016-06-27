'use strict';

// load required mocks
var mocks = require('./support/mocks.js');

var AWS = require('aws-sdk');

var assert = require('assert');
var Authentication = require('../src/authentication.js');

var ASYNC_DELAY = 50;

var handlerThatThrows = function() {
  throw new Error('Handler should not have been called');
};

describe('Authentication.resumeSession', function() {
  it('should maintain a persistant session in localStorage');
});
