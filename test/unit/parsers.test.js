'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var restBuddy = require('../../lib/express-sequelize-restbuddy.js');

describe('Parsers', function () {
  describe('Relation parser', function () {
    it('successfully parses single resource', function () {
      sinon.stub(restBuddy, '_getModelForResource').returns({ name: 'user' });
      var reqMock = { route: { path: '/users' }, url: '/users' };
      var sequelizeMock = { models: { user: { name: 'user' } } };

      var queryOptions = restBuddy._parseRoute(reqMock, sequelizeMock);
      expect(queryOptions.model.name).to.equal('user');
      restBuddy._getModelForResource.restore();
    });

    it('successfully parses single resource with a single param', function () {
      sinon.stub(restBuddy, '_getModelForResource').returns({ name: 'user' });
      var reqMock = { route: { path: '/users/:id' }, url: '/users/1' };
      var sequelizeMock = { models: { user: { name: 'user' } } };

      var queryOptions = restBuddy._parseRoute(reqMock, sequelizeMock);
      expect(queryOptions.model.name).to.equal('user');
      expect(queryOptions.where).to.deep.equal({ id: '1' });

      restBuddy._getModelForResource.restore();
    });

    it('successfully parses two resources with param for the first resource', function () {
      sinon.stub(restBuddy, '_getModelForResource')
        .onFirstCall().returns({ name: 'user' })
        .onSecondCall().returns({ name: 'channel' });

      var reqMock = {
        route: { path: '/users/:id/channels' },
        url: '/users/a/channels'
      };

      var sequelizeMock = {
        models: {
          user: { name: 'user' },
          channel: { name: 'channel' }
        }
      };

      var queryOptions = restBuddy._parseRoute(reqMock, sequelizeMock);
      expect(queryOptions.model.name).to.equal('channel');
      expect(queryOptions.include.model.name).to.deep.equal('user');
      expect(queryOptions.include.where).to.deep.equal({ id: 'a' });

      restBuddy._getModelForResource.restore();
    });

    it('successfully parses two resources with one params each', function () {
      sinon.stub(restBuddy, '_getModelForResource')
        .onFirstCall().returns({ name: 'user' })
        .onSecondCall().returns({ name: 'channel' });

      var reqMock = {
        route: { path: '/users/:id/channels/:id' },
        url: '/users/a/channels/b'
      };

      var sequelizeMock = {
        models: {
          user: { name: 'user' },
          channel: { name: 'channel' }
        }
      };

      var queryOptions = restBuddy._parseRoute(reqMock, sequelizeMock);
      expect(queryOptions.model.name).to.equal('channel');
      expect(queryOptions.where).to.deep.equal({ id: 'b' });
      expect(queryOptions.include.model.name).to.deep.equal('user');
      expect(queryOptions.include.where).to.deep.equal({ id: 'a' });

      restBuddy._getModelForResource.restore();
    });
  });
});
