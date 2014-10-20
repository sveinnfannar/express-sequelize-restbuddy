'use strict';

/**
 * An example of a basic REST resource for a single model.
 */


var _ = require('lodash');
var Promise = require('bluebird');
var restBuddy = require('../');
var Sequelize = require('sequelize');
var express = require('express');
var bodyParser = require('body-parser')
var debug = require('debug')('examples/basic-rest-api');
var app = express();
app.use(bodyParser.json());

/**
 * Sequelize
 */
var sequelize = new Sequelize('test', 'postgres', null, { dialect: 'postgres' });

/**
 * Models
 */
var Channel = sequelize.define('Channel', {
  name: Sequelize.STRING,
  price: Sequelize.FLOAT
});

var ScheduleItem = sequelize.define('ScheduleItem', {
  title: Sequelize.STRING
});

Channel.hasMany(ScheduleItem);
ScheduleItem.belongsTo(Channel);

sequelize.sync({ force: true })
  .then(function () {
    return Promise.all([
      Channel.create({ name: 'My Channel 1', price: 5.99 }),
      Channel.create({ name: 'My Channel 2', price: 0.99 })
    ])
  });

/**
 * Routes
 */
app.get('/channels', restBuddy(sequelize, {
  conditionTransformers: {
    search: function (value) { return { name: { like: '%' + value + '%' } } }
  }
}));

app.get('/channels/:id', restBuddy(sequelize));
app.patch('/channels/:id', restBuddy(sequelize));
app.put('/channels/:id', restBuddy(sequelize));

//app.get('/channels', restBuddy(sequelize));
app.get('/users/:id/channels', restBuddy(sequelize));

app.get('/users/:id/channels/:id', function (req, res, next) {
  console.log(typeof req.params.id);
  res.json(req);
});

/**
 * Server
 */

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
