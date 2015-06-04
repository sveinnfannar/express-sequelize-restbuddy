'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var mocha = require('gulp-mocha');
var clean = require('gulp-clean');
var gutil = require('gulp-util');
var jscs = require('gulp-jscs');
var shell = require('gulp-shell');

/**
 * Test
 */

gulp.task('db-prepare', shell.task([
  'createdb restbuddy-test',
]));

gulp.task('unit-test', function () {
  return gulp.src('./test/unit/*.test.js')
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('integration-test', function () {
  return gulp.src('./test/integration/*.test.js')
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('test', ['unit-test', 'integration-test']);

/**
 * Inspect
 */

gulp.task('inspect', function () {
  return gulp.src('./{lib,test,script}/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(jscs());
});


/**
 * Super Tasks
 */

gulp.task('default', ['inspect', 'test']);
