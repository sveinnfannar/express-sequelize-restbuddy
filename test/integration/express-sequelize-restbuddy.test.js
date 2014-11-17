'use strict';

var Promise = require('bluebird');
var Sequelize = require('sequelize');
var expect = require('chai').expect;
var express = require('express');
var request = require('supertest');
var restBuddy = require('../../lib/express-sequelize-restbuddy.js');

var bodyParser = require('body-parser');
var sequelize = new Sequelize('restbuddy_test', 'postgres', null, { dialect: 'postgres' });

describe('Non-relational endpoints', function () {
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
          search: function (value) {
            return { name: { like: '%' + value + '%' } };
          }
        }
      }), sendData);
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
      this.app.get('/users/:id', restBuddy(sequelize), sendData);
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
      this.app.put('/users/:id', restBuddy(sequelize), sendData);
      this.app.patch('/users/:id', restBuddy(sequelize), sendData);
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
      this.app.post('/users', restBuddy(sequelize), sendData);
      this.app.post('/users/:id', restBuddy(sequelize), sendData);
    });

    it('returns HTTP 201 (Created) with created user', function (done) {
      request(this.app)
        .post('/users')
        .send({ name: 'John', age: 32 })
        .expect(201)
        .end(done);
    });

    it('returns HTTP 405 (Method Not Allowed) when a specific document is specified', function (done) {
      request(this.app)
        .post('/users/1')
        .send({ name: 'John', age: 32 })
        .expect(405)
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
    beforeEach(function () {
      this.app.delete('/users/:id', restBuddy(sequelize), sendData);
    });

    it('returns HTTP 204 (No Content) with empty response on success', function (done) {
      request(this.app)
        .delete('/users/1')
        .expect(204)
        .end(done);
    });

    it('returns HTTP 404 (Not Found) for non-existent user', function (done) {
      request(this.app)
        .delete('/users/2359834')
        .expect(404)
        .expect(/User not found/)
        .end(done);
    });
  });
});

describe('Relational endpoints', function () {
  before(function (done) {
    this.app = express();
    this.app.use(bodyParser.json());

    /**
     * Models
     */
    var User = sequelize.define('User', {
      name: Sequelize.STRING,
      email: Sequelize.STRING
    });

    var Subscription = sequelize.define('Subscription');

    var Channel = sequelize.define('Channel', {
      name: Sequelize.STRING,
      price: Sequelize.FLOAT
    });

    var Content = sequelize.define('Content', {
      title: Sequelize.STRING,
      type: Sequelize.STRING
    });

    var Video = sequelize.define('Video', {
      bitrate: Sequelize.INTEGER
    });


    /**
     * Associations
     */
    // User *-* Channel 1-* Content 1-1 Video
    User.hasMany(Channel, { through: Subscription });
    Channel.hasMany(User, { through: Subscription });
    Channel.hasMany(Content);
    Content.belongsTo(Channel);
    Content.hasOne(Video);
    Video.belongsTo(Content);


    /**
     * Test data
     */
    sequelize.sync({ force: true })
      .then(function () {
        return Promise.all([
          User.create({ name: 'Swen', email: 'swen@swen.com' }),
          User.create({ name: 'Hawk', email: 'hawk@hawk.com' }),
          Channel.create({ name: 'Episode Channel', price: 0.9 }),
          Channel.create({ name: 'Movie Channel', price: 1.9 }),
          Content.create({ title: 'House of Cards', type: 'Episode' }),
          Content.create({ title: 'Spirited Away', type: 'Movie' }),
          Video.create({ bitrate: 1000 }),
          Video.create({ bitrate: 200 })
        ]).spread(function  (user1, user2, channel1, channel2, content1, content2, video1, video2) {
          return Promise.all([
            user1.setChannels([channel1, channel2]),
            channel1.addContent(content1),
            channel2.addContent(content2),
            content1.setVideo(video1),
            content2.setVideo(video2)
          ]);
        });
      })
      .nodeify(done);
  });

  describe('List', function () {
    beforeEach(function () {
      this.app.get('/users/:id/channels', restBuddy(sequelize), sendData);
      this.app.get('/channels/:id/content', restBuddy(sequelize), sendData);
    });

    it('returns HTTP 200 (OK) with a list of all channels for user', function (done) {
      request(this.app)
        .get('/users/1/channels')
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(2);
        })
        .expect(/Episode Channel/)
        .expect(/Movie Channel/)
        .end(done);
    });

    it('returns HTTP 200 (OK) with a list of all content for channel', function (done) {
      request(this.app)
        .get('/channels/1/content')
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(1);
        })
        .expect(/House of Cards/)
        .end(done);
    });
  });

  describe('Show', function () {
    beforeEach(function () {
      this.app.get('/users/:id/channels/:id', restBuddy(sequelize), sendData);
    });

    it('returns HTTP 200 (OK) with channel 2 for to user 1', function (done) {
      request(this.app)
        .get('/users/1/channels/1')
        .expect(200)
        .expect(function (res) {
          expect(res.body).to.be.a('object');
        })
        .expect(/Episode Channel/)
        .end(done);
    });

    it('returns HTTP 404 (Not Found) for channel 2 for user 2', function (done) {
      request(this.app)
        .get('/users/2/channels/2')
        .expect(404)
        .end(done);
    });
  });

  describe('Create', function () {
    beforeEach(function () {
      this.app.post('/channels/:id/contents', restBuddy(sequelize), sendData);
      this.app.post('/channels/:id/foobars', restBuddy(sequelize), sendData);
      this.app.post('/foobars/:id/contents', restBuddy(sequelize), sendData);
    });

    it('returns HTTP 201 (Created) with created content related to channel', function (done) {
      request(this.app)
        .post('/channels/1/contents')
        .send({ title: 'The Simpsons', type: 'Episode' })
        .expect(201)
        .expect(/"ChannelId":1/)
        .end(done);
    });

    it('returns HTTP 404 (Not Found) when model does not exist', function (done) {
      request(this.app)
        .post('/channels/1/foobars')
        .send({ title: 'The Simpsons', type: 'Episode' })
        .expect(404)
        .end(done);
    });

    //it('returns HTTP 404 (Not Found) when related model does not exist', function (done) {
    //  request(this.app)
    //    .post('/foobars/1/contents')
    //    .send({ title: 'The Simpsons', type: 'Episode' })
    //    .expect(404)
    //    .end(done);
    //});
  });
});

/**
 * Utility Functions
 */

// The last middleware to be called in the response chain to write the data to the response
function sendData (req, res) {
  res.send(req.data);
}
