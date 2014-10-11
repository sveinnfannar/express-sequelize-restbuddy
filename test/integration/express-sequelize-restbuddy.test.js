'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var debug = require('debug')('express-sequelize-restbuddy');
var expect = require('chai').expect;
var express = require('express');
var request = require('supertest');
var restBuddy = require('../../lib/express-sequelize-restbuddy.js');

var bodyParser = require('body-parser')
var sequelize = new Sequelize('test', 'postgres', null, { dialect: 'postgres' });

describe('Non-relational resources', function () {
  beforeEach(function () {
    var self = this;
    this.app = express();
    this.app.use(bodyParser.json());
    this.User = sequelize.define('User', {
      name: { type: Sequelize.STRING },
      age: { type: Sequelize.INTEGER, allowNull: false }
    });

    return sequelize.sync({ force: true })
      .then(function () {
        return Promise.all([
          self.User.create({ name: 'Swen', age: 25 }),
          self.User.create({ name: 'Selm', age: 22 }),
          self.User.create({ name: 'Avon', age: 16 })
        ]);
      });
  });

  describe('List', function () {
    beforeEach(function () {
      this.app.get('/users', restBuddy(sequelize, {
        conditionTransformers: {
          search: function (value) { return { name: { like: '%' + value + '%' } } }
        }
      }));
    });

    it('returns HTTP 200 (OK) with a list of all users', function (done) {
      request(this.app)
        .get('/users')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(3);
        })
        .expect(/Swen/)
        .expect(/Selm/)
        .expect(/Avon/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with a list of all 22 year old users', function (done) {
      request(this.app)
        .get('/users?age=22')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(1);
        })
        .expect(/Selm/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with a list of all users ordered by age', function (done) {
      request(this.app)
        .get('/users?order=age')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(/Avon.*Selm.*Swen/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with a paginated list of users', function (done) {
      request(this.app)
        .get('/users?order=age&perPage=1&page=1')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(1);
        })
        .expect(/Selm/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with a list of users named *wen', function (done) {
      request(this.app)
        .get('/users?search=wen')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(1);
        })
        .expect(/Swen/)
        .end(done);
    });
  });

  describe('Show', function () {
    beforeEach(function () {
      this.app.get('/users/:id', restBuddy(sequelize));
    });

    it('returns HTTP 200 (OK) with a single user', function (done) {
      request(this.app)
        .get('/users/1')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('object');
        })
        .expect(/Swen/) // TODO: This could theoretically fail because of race-conditions between inserts, too tired to deal with it now
        .end(done);
    });

    it('returns HTTP 404 (Not Found) for non-existent user', function (done) {
      request(this.app)
        .get('/users/4')
        .expect('Content-Type', /json/)
        .expect(404)
        .end(done);
    });
  });

  describe('Update', function () {
    beforeEach(function () {
      this.app.put('/users/:id', restBuddy(sequelize));
      this.app.patch('/users/:id', restBuddy(sequelize));
    });

    it('returns HTTP 200 (OK) with updated user (PUT)', function (done) {
      request(this.app)
        .put('/users/1')
        .send({ name: 'Snow' })
        .expect(200)
        .expect(/Snow/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with updated user (PATCH)', function (done) {
      request(this.app)
        .patch('/users/1')
        .send({ name: 'Snow' })
        .expect(200)
        .expect(/Snow/)
        .end(done);
    });

    it('returns HTTP 404 (Not Found) for non-existent user', function (done) {
      request(this.app)
        .patch('/users/235222')
        .send({ name: 'Snow' })
        .expect(404)
        .end(done);
    });
  });

  describe('Create', function () {
    beforeEach(function () {
      this.app.post('/users', restBuddy(sequelize));
    });

    it('returns HTTP 201 (Created) with created user', function (done) {
      request(this.app)
        .post('/users')
        .send({ name: 'John', age: 32 })
        .expect(201)
        .end(done);
    });

    it('returns HTTP 400 (Bad Request) for invalid body', function (done) {
      request(this.app)
        .post('/users')
        .send({ name: 'John' }) // Causes an error because 'age' is required
        .expect(400)
        .end(done);
    });
  });

  describe('Destroy', function () {
    it('returns HTTP 204 (No Content) with empty response');
    it('returns HTTP 404 (Not Found) for non-existent user');
  });
});
