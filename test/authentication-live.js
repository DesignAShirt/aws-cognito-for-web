'use strict';

require('dotenv').load();

// load required mocks
var mocks = require('./support/mocks.js');

var AWS = require('aws-sdk');
var async = require('async');

var assert = require('assert');
var Authentication = require('../src/authentication.js');

// cognito pool specifically for these tests
var TEST_COGNITO_POOL = process.env.TEST_COGNITO_POOL;
var TEST_COGNITO_POOL_REGION = process.env.TEST_COGNITO_POOL_REGION;
var TEST_COGNITO_ROLE = process.env.TEST_COGNITO_ROLE;

var TEST_AUTH0_DOMAIN = process.env.TEST_AUTH0_DOMAIN;
var TEST_AUTH0_CLIENT = process.env.TEST_AUTH0_CLIENT;
var TEST_AUTH0_USER = process.env.TEST_AUTH0_USER;
var TEST_AUTH0_PASS = process.env.TEST_AUTH0_PASS;
var TEST_AUTH0_CONN = process.env.TEST_AUTH0_CONN;

var request = require('request');

var ASYNC_DELAY = 50;

var handlerThatThrows = function() {
  throw new Error('Handler should not have been called');
};

describe('Live tests may take many minutes to run...', function() {

  it('should authenticate against live cognito', function(done) {
    this.timeout(10000);
    var auth = new Authentication({
      identityPoolId: TEST_COGNITO_POOL,
      authRoleArn: TEST_COGNITO_ROLE,
      providerEndpoint: TEST_AUTH0_DOMAIN,
    });
    assert.strictEqual(false, auth.isAuthenticated());
    auth.on('authenticated', function() {
      assert.ok(auth.credentials.accessKeyId);
      assert.ok(auth.credentials.sessionToken);
      assert.ok(auth.credentials.data.Credentials.SecretAccessKey);
      assert.strictEqual(true, auth.isAuthenticated());
      done();
    });
    auth.on('deauthenticated', function(err) {
      assert.ifError(err);
    });
    auth.once('deauthenticated', function() {
      // should not deauth again since we're logging in here
      auth.once('deauthenticated', handlerThatThrows);
      request({
        method: 'POST',
        url: 'https://' + TEST_AUTH0_DOMAIN + '/oauth/ro',
        json: {
          client_id: TEST_AUTH0_CLIENT,
          username: TEST_AUTH0_USER,
          password: TEST_AUTH0_PASS,
          connection: TEST_AUTH0_CONN,
          grant_type: 'password',
          scope: 'openid',
          device: 'mocha_tests',
        },
      }, function(err, res, body) {
        // console.log('auth0 returned', body.id_token);
        assert.ifError(err);
        auth.open(body.id_token);
      });
    });
    auth.init();
  });

  it('should get a new cognito session token every auth', function(done) {
    this.timeout(25000);
    async.waterfall([
      function auth(next) {
        request({
          method: 'POST',
          url: 'https://' + TEST_AUTH0_DOMAIN + '/oauth/ro',
          json: {
            client_id: TEST_AUTH0_CLIENT,
            username: TEST_AUTH0_USER,
            password: TEST_AUTH0_PASS,
            connection: TEST_AUTH0_CONN,
            grant_type: 'password',
            scope: 'openid',
            device: 'mocha_tests',
          },
        }, function(err, res, body) {
          // console.log('auth0 returned', body.id_token);
          assert.ifError(err);
          next(null, body.id_token);
        });
      },
      function once(id_token, next) {
        var auth = new Authentication({
          identityPoolId: TEST_COGNITO_POOL,
          authRoleArn: TEST_COGNITO_ROLE,
          providerEndpoint: TEST_AUTH0_DOMAIN,
          existingAuthToken: id_token,
        });
        auth.once('authenticated', function() {
          assert.ok(auth.credentials.sessionToken); // sanity check
          next(null, id_token, auth.credentials.sessionToken);
        });
        auth.once('deauthenticated', handlerThatThrows);
        auth.init();
      },
      function twice(id_token, session_token, next) {
        var auth = new Authentication({
          identityPoolId: TEST_COGNITO_POOL,
          authRoleArn: TEST_COGNITO_ROLE,
          providerEndpoint: TEST_AUTH0_DOMAIN,
          existingAuthToken: id_token,
        });
        auth.once('authenticated', function() {
          assert.ok(auth.credentials.sessionToken); // sanity check
          assert.notEqual(session_token, auth.credentials.sessionToken);
          next(null, id_token, auth.credentials.sessionToken, auth);
        });
        auth.once('deauthenticated', handlerThatThrows);
        auth.init();
      },
      function three(id_token, session_token, auth, next) {
        var prevToken = auth.credentials.sessionToken;
        auth.once('deauthenticated', handlerThatThrows);
        auth.once('authenticated', function() {
          assert.ok(auth.credentials.sessionToken); // sanity check
          assert.notEqual(prevToken, auth.credentials.sessionToken);
          next();
        });
        auth.open(id_token);
      },
    ], done);
  });

  it('should get a deauthenticate against live cognito endpoint and allow reconnect', function(done) {
    this.timeout(10000);
    request({
      method: 'POST',
      url: 'https://' + TEST_AUTH0_DOMAIN + '/oauth/ro',
      json: {
        client_id: TEST_AUTH0_CLIENT,
        username: TEST_AUTH0_USER,
        password: TEST_AUTH0_PASS,
        connection: TEST_AUTH0_CONN,
        grant_type: 'password',
        scope: 'openid',
        device: 'mocha_tests',
      },
    }, function(err, res, body) {
      assert.ifError(err);
      var auth = new Authentication({
        identityPoolId: TEST_COGNITO_POOL,
        authRoleArn: TEST_COGNITO_ROLE,
        providerEndpoint: TEST_AUTH0_DOMAIN,
        existingAuthToken: body.id_token,
      });
      auth.once('authenticated', function() {
        assert.ok(auth.credentials.sessionToken); // sanity check
        auth.once('deauthenticated', function() {
          assert.strictEqual(auth.getAuthToken(), null);
          assert.strictEqual(auth.credentials.identityId, null);
          auth.once('deauthenticated', handlerThatThrows);
          auth.once('authenticated', function() {
            assert.strictEqual(auth.getAuthToken(), body.id_token); // sanity
            assert.ok(auth.credentials.accessKeyId);
            assert.ok(auth.credentials.sessionToken);
            done();
          });
          auth.open(body.id_token);
        });
        auth.close();
      });
      auth.init();
    });
  });
});
