# AWS Cognito for Web 

A browserified clientside library for authenticating users with [AWS Cognito](https://aws.amazon.com/cognito/).  It was designed and tested to be used with [auth0](https://auth0.com/) but other authentication providers should work just fine.

When combined with the auth0 lock widget, you can set up an entire secure, serverless backend with nearly no effort on your part.


## Getting Started

Prerequisties: AWS account, auth0 account; rudimentary knowledge of both

### Config

1. Ignore SAML auth0 + Cognito.  I've never been able to get it to work.
1. Follow this tutorial for setting up auth0 + cognito: https://auth0.com/docs/scenarios/amazon-cognito
1. (Optional) Edit the generated Cognito auth identity and add the ability to put objects to an S3 bucket


### Setting up aws-cognito-for-web (AuthenticationClient)

Set up a browserfied project.  (Details on how to do that are outside scope here.)

`npm install auth0-lock aws-cognito-for-web --save`


```js
// main.js

var joy = function() { s3.putObject({}, console.log.bind(console)); };

var Auth0Lock = require('auth0-lock');
var AuthenticationClient = require('authentication-client');

var identityPoolId = 'your cognito identity pool id';
// this was (probably) automatically created when you created your identity pool
var authRoleArn = 'your cognito authenticated role arn';

// this is your auth0 account.  it will match what you set up in the auth0 + cognito tutorial mentioned above
var auth0Endpoint = '[your host].auth0.com';

var lock = new Auth0Lock('the auth0 app client id', auth0Endpoint);

// AuthenticationClient.resumeSession is sugar that handles serializing/unserialzing the user
// session and all the required bits to make everything work.
var auth = AuthenticationClient.resumeSession({
  identityPoolId: identityPoolId,
  authRoleArn: authRoleArn,
  providerEndpoint: auth0Endpoint,
});

auth.on('authenticated', function() {
  console.info('yay. your user was successfully authenticated and now has a cognito identity');
  joy();
});

auth.on('deauthenticated', function(err) {
  console.info('user signed out or error occurred', err);
  lock.show({
    sso: true,
  }, function (err, profile, token) {
    if (err) {
      auth.close();
      alert('Error:\n\n' + err.message);
      return;
    }
    auth.session.profile = profile; // stores the user profile in session
    auth.open(token); // sends token to cognito; leads to emit authenticated if successful
  });
});
```

## Setting up env for tests

Some tests have been built to run against a live auth0 and AWS account.  ***If you run tests yourself without doing some configuration you will see failed tests.***


### Setting up test env

In order to set up your local env to run the tests:

1. Copy `.env-template` to `.env`
1. Enter all the required info
1. run `npm test` 

If you entered valid info and your live environment has been properly configured all tests should pass.

### `.env` example

```sh
TEST_COGNITO_POOL=us-east-1:c52axxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_COGNITO_POOL_REGION=us-east-1
TEST_COGNITO_ROLE=arn:aws:iam::170xxxxxxxxx:role/Cognito_pool_for_auth_testsAuth_Role
TEST_AUTH0_DOMAIN=example.auth0.com
TEST_AUTH0_CLIENT=Hnc4yxxxxxxxxxxxxxxxxxxxx
# in your auth0 app, create a user and enter the info here
TEST_AUTH0_USER=auth_tests@example.com
TEST_AUTH0_PASS=password1234
# the auth0 connection to use for auth (probably just the auth0 users database)
TEST_AUTH0_CONN=for-auth-tests
```

