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

describe('Authentication.webFactory', function() {

  it('should read and write to storage', function() {
    // guarantees factory does not load token from storage
    var fakeStorageKey = mocks.uniqueString('storageio');
    assert.ok(!Authentication.webFactory.readStorage(fakeStorageKey));
    Authentication.webFactory.writeStorage(fakeStorageKey, 'test');
    assert.strictEqual(Authentication.webFactory.readStorage(fakeStorageKey), 'test');
    Authentication.webFactory.writeStorage(fakeStorageKey, 'test2');
    assert.strictEqual(Authentication.webFactory.readStorage(fakeStorageKey), 'test2');
  });

  it('should create an Authentication instance', function() {
    var fakeStorageKey = mocks.uniqueString();
    var auth = Authentication.webFactory({
      identityPoolId: 'not real identity pool',
      authRoleArn: 'not real role arn',
      providerEndpoint: 'not a real provider',
    }, fakeStorageKey);
    assert.strictEqual(true, auth instanceof Authentication);
  });

  it('should overwrite storage with token passed in arguments', function() {
    var fakeToken = 'fake123';
    var anotherFakeToken = 'anotherfake987';
    var fakeEndpoint = 'not.real.example';
    var fakeStorageKey = mocks.uniqueString('overwritewithpassed');
    localStorage.setItem(fakeStorageKey, JSON.stringify(anotherFakeToken));
    var auth = Authentication.webFactory({
      identityPoolId: 'not real identity pool',
      authRoleArn: 'not real role arn',
      providerEndpoint: fakeEndpoint,
      existingAuthToken: fakeToken,
    }, fakeStorageKey);
    assert.strictEqual(JSON.parse(localStorage.getItem(fakeStorageKey)), anotherFakeToken);
    assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    assert.notEqual(auth.credentials.params.Logins[fakeEndpoint], anotherFakeToken);
  });

  it('should read token from storage', function() {
    var fakeToken = 'fake123';
    var fakeEndpoint = 'not.real.example';
    var fakeStorageKey = mocks.uniqueString('readfromstorage');
    assert.ok(!localStorage.getItem(fakeStorageKey)); // sanity check
    localStorage.setItem(fakeStorageKey, JSON.stringify(fakeToken));
    assert.strictEqual(localStorage.getItem(fakeStorageKey), JSON.stringify(fakeToken)); // sanity check
    var auth = Authentication.webFactory({
      identityPoolId: 'not real identity pool',
      authRoleArn: 'not real role arn',
      providerEndpoint: fakeEndpoint,
    }, fakeStorageKey);
    assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    assert.notEqual(auth.credentials.params.Logins['fdsafdsafasd'], fakeToken); //sanity
  });

  it('should handle malformed storage data', function() {
    var fakeEndpoint = 'not.real.example';
    var malformedData = [ '{', '_', '', '1', '0.1', '[]', '{}', '"' ];
    malformedData.forEach(function(malformed) {
      var fakeStorageKey = mocks.uniqueString('malformedstorage');
      localStorage.setItem(fakeStorageKey, malformed);
      var auth = Authentication.webFactory({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      }, fakeStorageKey);
      assert.strictEqual(true, auth instanceof Authentication);
    });
  });

  it('should write token to storage when authenticated', function(done) {
    var fakeToken = 'fake123';
    var fakeEndpoint = 'not.real.example';
    var fakeStorageKey = mocks.uniqueString('writeifauth');
    assert.ok(!localStorage.getItem(fakeStorageKey)); // sanity check
    var auth = Authentication.webFactory({
      identityPoolId: 'not real identity pool',
      authRoleArn: 'not real role arn',
      providerEndpoint: fakeEndpoint,
    }, fakeStorageKey);
    var mock = mocks.mock(auth.credentials, 'get', function(callback) {
      setTimeout(function() {
        callback();
      }, ASYNC_DELAY);
    });
    var before = function(handler) {
      return function() {
        mock.cleanup();
        handler();
      };
    };
    auth.on('authenticated', before(function() {
      assert.strictEqual(localStorage.getItem(fakeStorageKey), JSON.stringify(fakeToken));
      assert.notEqual(localStorage.getItem(fakeStorageKey), ''); // sanity
      assert.notEqual(localStorage.getItem(fakeStorageKey), '""'); // sanity
      done();
    }));
    auth.on('deauthenticated', function() {
      // spoof auth0 authentication on deauth
      auth.setAuthToken(fakeToken);
      auth._onAuth();
    });
    auth.init();
  });

  it('should clear token from storage when deauthenticated', function(done) {
    var fakeToken = 'fake123';
    var fakeEndpoint = 'not.real.example';
    var fakeStorageKey = mocks.uniqueString('clearifunauth');
    assert.ok(!localStorage.getItem(fakeStorageKey)); // sanity check
    var auth = Authentication.webFactory({
      identityPoolId: 'not real identity pool',
      authRoleArn: 'not real role arn',
      providerEndpoint: fakeEndpoint,
    }, fakeStorageKey);
    var mock = mocks.mock(auth.credentials, 'get', function(callback) {
      setTimeout(function() {
        callback(new Error());
      }, ASYNC_DELAY);
    });
    var before = function(handler) {
      return function() {
        mock.cleanup();
        handler();
      };
    };
    auth.on('authenticated', before(handlerThatThrows));
    auth.on('deauthenticated', before(function() {
      assert.notEqual(localStorage.getItem(fakeStorageKey), JSON.stringify(fakeToken));
      assert.strictEqual(localStorage.getItem(fakeStorageKey), void 0);
      done();
    }));
    auth.init();
  });
});
