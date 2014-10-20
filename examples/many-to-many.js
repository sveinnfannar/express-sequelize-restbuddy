var _ = require('lodash');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var debug = require('debug')('express-sequelize-restbuddy');
var sequelize = new Sequelize('restbuddy_test', 'postgres', null, { dialect: 'postgres' });

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

User.hasMany(Channel, { through: Subscription });
Channel.hasMany(User, { through: Subscription });
Channel.hasMany(Content);
Content.belongsTo(Channel);
Content.hasOne(Video);
Video.belongsTo(Content);


/**
 * Queries
 */

sequelize.sync({ force: true })
  .then(function () {
    return Promise.all([
      User.create({ name: 'Swen', email: 'swen@swen.com' }),
      Channel.create({ name: 'Episode Channel', price: 0.9 }),
      Channel.create({ name: 'Movie Channel', price: 1.9 }),
      Content.create({ title: 'House of Cards', type: 'Episode' }),
      Content.create({ title: 'Spirited Away', type: 'Movie' }),
      Video.create({ bitrate: 1000 }),
      Video.create({ bitrate: 200 })
    ]).spread(function  (user, channel1, channel2, content1, content2, video1, video2) {
      return Promise.all([
        user.setChannels([channel1, channel2]),
        channel1.addContent(content1),
        channel2.addContent(content2),
        content1.setVideo(video1),
        content2.setVideo(video2)
      ]);
    });
  })
  .then(function () {
    return Content.findAll({
      include: [{
        model: Channel,
        where: { id: 1 },
        attributes: [],
        include: {
          model: User,
          where: { id: 1 },
          attributes: []
        }
      }]
    }).then(function (result) {
      debug('/users/1/channels/1/content');
      debug(JSON.stringify(result, null, 4));
    });
  })
  .then(function () {
    return Video.findAll({
      include: {
        model: Content,
        where: { id: 1 },
        attributes: []
      }
    }).then(function (result) {
      debug('/content/1/videos');
      debug(JSON.stringify(result, null, 4));
    });
  })
  .then(function () {
    return Subscription.findAll({
      include: [{
        model: Channel,
        where: { id: 1 }
      }]
    }).then(function (result) {
      debug('/subscriptions');
      console.log(JSON.stringify(result, null, 4));
    });
  });
