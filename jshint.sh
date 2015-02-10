#!/bin/sh

JSHINT="./node_modules/jshint/bin/jshint"

$JSHINT lib/*.js lib/common/*.js
