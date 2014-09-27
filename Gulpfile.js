'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var mocha = require('gulp-mocha');
var clean = require('gulp-clean');
var gutil = require('gulp-util');
var jscs = require('gulp-jscs');
var runSequence = require('run-sequence');

var isTest = process.env.NODE_ENV === 'test';

var handleError = function (err) {
  if (isTest) {
    this.removeAllListeners();
    this.emit('error', err);
  }
  else {
    gutil.beep();
    this.emit('end');
  }
};

/**
 * Test
 */

gulp.task('unit-test', function () {
  return gulp.src('./test/unit/*.test.js')
    .pipe(mocha({reporter: 'spec'}))
    .on('error', handleError);
});

gulp.task('integration-test', function () {
  return gulp.src('./test/integration/*.test.js')
    .pipe(mocha({reporter: 'spec'}))
    .on('error', handleError);
});

gulp.task('test', function (done) {
  runSequence('unit-test', 'integration-test', done)
});

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
