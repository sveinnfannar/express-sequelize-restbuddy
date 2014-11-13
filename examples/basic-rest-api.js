'use strict';

/**
 * An example of a basic REST resource for a single model.
 */


var _ = require('lodash');
var Promise = require('bluebird');
var restBuddy = require('../');
var Sequelize = require('sequelize');
var express = require('express');
var bodyParser = require('body-parser');
var debug = require('debug')('express-sequelize-restbuddy');
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
  from: Sequelize.DATE
});

Channel.hasMany(ScheduleItem);
ScheduleItem.belongsTo(Channel);

sequelize.sync({ force: true })
  .then(function () {
    return Promise.all([
      Channel.create({ name: 'My Channel 1', price: 5.99 }),
      Channel.create({ name: 'My Channel 2', price: 0.99 })
    ])
  })
  .spread(function (channel1, channel2) {
    return ScheduleItem.create({ from: new Date() })
      .then(function (scheduleItem) {
        return channel1.addScheduleItem(scheduleItem);
      })
  });

/**
 * Routes
 */
app.get('/channels', restBuddy(sequelize, {
  conditionTransformers: {
    search: function (value) { return { name: { like: '%' + value + '%' } } }
  }
}), sendData);

app.get('/channels/:id', restBuddy(sequelize), sendData);
app.put('/channels/:id', restBuddy(sequelize), sendData);
app.patch('/channels/:id', restBuddy(sequelize), sendData);
app.get('/channels/:id/scheduleItems', restBuddy(sequelize), sendData);
app.get('/channels/:id/scheduleItems/:id', restBuddy(sequelize), sendData);

/**
 * Server
 */

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});

/**
 * Utility Functions
 */

// The last middleware to be called in the response chain to write the data to the response
function sendData (req, res) {
  res.send(req.data);
}
