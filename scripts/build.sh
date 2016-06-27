#!/usr/bin/env bash

SCRIPTDIR=$(dirname $0)

cd $SCRIPTDIR/..

mkdir -p ./dist

./node_modules/.bin/browserify $1 --standalone AuthenticationClient \
  --no-bundle-external \
  ./src/authentication.js > ./dist/authentication-client.js
