'use strict';

var _ = require('lodash');
var assert = require('assert');
var Sequelize = require('sequelize');
var debug = require('debug')('express-sequelize-restbuddy');


/**
 * Inspects the incoming requests method and url to produce a sequelize query.
 * Also takes care of paginating the database results and querying with
 * the "where" correct conditions based on the requests query parameters.
 * Successfully handles
 *
 * The middleware assumes route path parameters to have the same name sas
 *
 * @param {Sequelize} sequelize - An initialized Sequelize object
 * @param {object} [options]
 * @param {number} [options.maxItems=100] - Max items per page for pagination
 * @param {object} [options.specialQueryParams] - An object containing functions to map query parameter values to sequelize condition object. Example: { paramName: function (paramValue) { }, .. }
 * @param {function} [options.queryFunction] - Function that returns an options object passed to sequelize findAll() or findOne() instead of determining the query from the route. Pagination, ordering and query params will still work as expected.
 * @returns {Function}
 */
var restBuddy = module.exports = function (sequelize, options) {
  assert(sequelize, 'Sequelize object should be provided');

  options = _.defaults(options || {}, {
    defaultItems: 25,
    maxItems: 100,
    specialQueryParams: {},
    queryFunction: null
  });

  return function (req, res, next) {
    var queryOptions = {};

    // Parse route
    var routeParsingResults = parseRoute(req, sequelize);

    // Create req.nestedParams with a nested params object to support multiple params with the same name
    req.nestedParams = routeParsingResults.requestParams;

    // Generate query from route path or use provided queryFunction
    if (!options.queryFunction) {
      queryOptions = _.merge(queryOptions, routeParsingResults.sequelizeQueryOptions);
    } else {
      queryOptions = _.merge(queryOptions, options.queryFunction(req));
    }


    // Check if the model exists
    var model = queryOptions.model; // The sequelize model for the resource being requested
    // TODO: Return HTTP error if models don't exist
    if (!model) {
      return res.status(404).json({ message: 'Resource does not exist' });
    }

    // Order
    queryOptions = _.merge(queryOptions, parseOrder(req, model));

    // Pagination
    queryOptions = _.merge(queryOptions, parsePagination(req, options));

    // Where
    var conditions = applySpecialQueryParams(
      filterUnknownConditions(req.query, model, options.specialQueryParams),
      options.specialQueryParams
    );
    queryOptions.where = _.merge(queryOptions.where, conditions);

    // Call proper request handler
    var requestHandler = requestHandlers[requestType(req)];
    debug('request type', requestType(req));
    if (_.isFunction(requestHandler)) {
      debug('Invoking %s handler with mode name: %s, queryOptions: %s, and options', requestType(req), model.name, queryOptions, options);
      requestHandler(model, queryOptions, options, req, res, next);
    } else {
      // TODO: Find an appropriate place for this check, also this implementation sucks
      return res.sendStatus(405);
    }
  };
};


/**
 * Internal Functions
 */

/**
 * Enum for possible request types
 *
 * @readonly
 * @enum {string}
 */
var RequestTypes = Object.freeze({
  List: 'list',
  Show: 'show',
  Update: 'update',
  Create: 'create',
  Destroy: 'destroy'
});

/**
 * Object/Hash of request handlers for each request type (List, Show, Update etc.)
 *
 * @readonly
 * @type {{show: show, list: list, update: update, create: create, destroy: destroy}}
 */
var requestHandlers = Object.freeze({
  show: function show (model, queryOptions, options, req, res, next) {
    // TODO: Abstract findOne logic to remove duplications in update, delete and destroy
    model.findOne(queryOptions)
      .then(function (item) {
        if (!item) {
          return res.status(404).json({ message: model.name + ' not found' });
        }
        req.data = item;
        next();
      })
      .catch(next);
  },

  list: function list (model, queryOptions, options, req, res, next) {
    model.findAll(queryOptions)
      .then(function (items) {
        req.data = items;
        next();
      })
      .catch(next);
  },

  update: function update (model, queryOptions, options, req, res, next) {
    model.findOne(queryOptions)
      .then(function (item) {
        if (!item) {
          return res.status(404).json({ message: model.name + ' not found' });
        }

        return item.updateAttributes(req.body)
          .then(function (item) {
            req.data = item;
            next();
          });
      })
      .catch(next);
  },

  create: function create (model, queryOptions, options, req, res, next) {
    // TODO: Should this check if document exists and return an error? (only if PK is specified in body)

    // Check if posted data should be related to some other data (ex. /channel/:id/videos)
    var promise = queryOptions.include ? relationalCreate(req.body) : model.create(req.body);
    promise
      .then(function (item) {
        res.status(201);
        req.data = item;
        next();
      })
      .catch(Sequelize.ValidationError, function (error) {
        res.status(400).json(error);
      })
      .catch(next);

    // Create and store the data and set appropriate foreign keys
    function relationalCreate (data) {
      return findRelatedInstance()
        .then(function (relatedInstance) {
          var addItemFuncName = 'add' + model.name;
          return relatedInstance[addItemFuncName](model.build(data));
        });
    }

    // Finds the model instance of the row the inserted data is related to
    function findRelatedInstance () {
      return queryOptions.include.model.findOne({ where: queryOptions.include.where });
    }
  },

  destroy: function destroy (model, queryOptions, options, req, res, next) {
    model.findOne(queryOptions)
      .then(function (item) {
        if (!item) {
          return res.status(404).json({ message: model.name + ' not found' });
        }

        return item.destroy()
          .then(function () {
            res.status(204);
            req.data = item;
            next();
          });
      })
      .catch(next);
  }
});

/**
 * Determine the type of this request (list, show, update ..)
 *
 * @param req
 * @returns {string}
 */
function requestType (req) {
  var pathComponents = _.compact(req.route.path.split('/'));
  if (req.method === 'GET') {
    return isParam(_.last(pathComponents)) ? RequestTypes.Show : RequestTypes.List;
  } else if (req.method === 'POST' && !isParam(_.last(pathComponents))) {
    return RequestTypes.Create;
  } else if ((req.method === 'PUT' || req.method === 'PATCH') && isParam(_.last(pathComponents))) {
    return RequestTypes.Update;
  } else if (req.method === 'DELETE' && isParam(_.last(pathComponents))) {
    return RequestTypes.Destroy;
  } else {
    return null;
  }
}

/**
 * Returns whether a string is a route parameter
 *
 * @param {string} x
 * @returns {boolean}
 */
function isParam (x) {
  return typeof x === 'string' && x.length > 0 && x[0] === ':';
}

/**
 * Filter out conditions that do no match any fields in the model
 *
 * @param {object} conditions - Object
 * @param {Model} model - A sequelize model object
 * @param {object} specialQueryParams - Object of special query params
 * @returns {object} Conditions object with unknown fields removed
 */
function filterUnknownConditions (conditions, model, specialQueryParams) {
  var modelAttributes = _.keys(model.rawAttributes);
  var specialQueryParamsNames = _.keys(specialQueryParams);
  return _.pick(conditions, _.union(specialQueryParamsNames, modelAttributes));
}

/**
 * Apply a specified functions to query parameters
 *
 * @param {object} conditions
 * @param {object} specialQueryParams
 * @returns {object} A sequelize where condition object
 */
function applySpecialQueryParams (conditions, specialQueryParams) {
  var transformedConditions = _.compact(_.map(conditions, applyMatchingQueryParamFunc));
  var nonTransformedConditions = _.omit(conditions, _.keys(specialQueryParams));
  conditions = transformedConditions.concat([nonTransformedConditions]); // A little hack since push does not return the array
  return _.merge.apply(null, conditions);

  function applyMatchingQueryParamFunc (v, k) {
    return specialQueryParams[k] ? specialQueryParams[k](v) : null;
  }
}

/**
 * Parse the order query parameter value
 *
 * @param {Express.Request} req
 * @param {Model} model
 * @returns {object} An object passed to sequelize
 */
function parseOrder (req, model) {
  var order = req.query.order;
  var desc = false;
  if (order) {
    if (order[0] === '-') {
      order = order.slice(1);
      desc = true;
    }
    if (model.rawAttributes[order]) {
      order = '"' + order + '"';
      if (desc) {
        order += ' DESC';
      }
      return { order: order };
    }
  }
  return {};
}

/**
 * Parse pagination query parameter values
 *
 * @param {Express.Request} req
 * @param {object} options
 * @returns {object} An object passed to sequelize
 */
function parsePagination (req, options) {
  var pagination = {};
  pagination.limit = Math.min(parseInt(req.query.items), options.maxItems) || options.defaultItems;
  pagination.offset = parseInt(req.query.page) * pagination.limit || null;
  return pagination;
}

/**
 * Parse request route and construct a sequelize join query in needed (ex. /repo/:owner/:repo/commits)
 *
 * @param {Express.Request} req
 * @returns {object} An object passed to sequelize
 */
function parseRoute (req, sequelize) {
  // Create a list of resource objects from the request. A resource contains the noun (ex. user, task) and the conditions to identify it (ex. id, slug)
  var resources = _parseRoute(
    _.compact(req.route.path.split('/')),
    _.compact(req.url.split('?')[0].split('/'))
  );

  return {
    sequelizeQueryOptions: createSequelizeQueryOptions(resources),
    requestParams: _.object(_.map(resources, _.values)) // Create a nested params object to avoid conflicts of params in express, ex. { users: { id: 1 }, tasks: { id: 1 } }
  };

  // Parse the route into
  function _parseRoute (pathComponents, urlComponents) {
    // Extract resource name from path
    var resourceName = _.first(pathComponents);

    // Extract parameters from resource (we must parse the url our selves because expresses router overrides parameters with the same name)
    var paramNames = _.take(pathComponents.slice(1), isParam);
    var paramIndexes = _.map(paramNames, _.partial(_.indexOf, pathComponents));
    var paramValues = _.map(paramIndexes, function (index) { return urlComponents[index]; });
    paramNames = _.map(paramNames, function (paramName) { return paramName.slice(1); });

    // Remove the parsed part from the url and path
    pathComponents = _.drop(pathComponents, paramNames.length + 1);
    urlComponents = _.drop(urlComponents, paramNames.length + 1);

    var resource = {
      name: resourceName,
      conditions: _.zipObject(paramNames, paramValues)
    };

    // Recursively parse the rest of the path
    if (pathComponents.length > 0) {
      return [resource].concat(_parseRoute(pathComponents, urlComponents));
    }

    return [resource];
  }

  function createSequelizeQueryOptions (resources) {
    var sequelizeQueryOptions = _.map(resources, createSequelizeQueryOptionsForResource);
    // Create a nested structure of sequelize query objects
    return _.reduce(sequelizeQueryOptions, function (previous, current) {
      previous.attributes = []; // Don't include data from included(joined) rows
      current.include = previous;
      return current;
    });
  }

  function createSequelizeQueryOptionsForResource (resource) {
    return {
      model: restBuddy._getModelForResource(resource, sequelize),
      where: resource.conditions
    };
  }
}
restBuddy._parseRoute = parseRoute; // Exported for testing purposes

/**
 * Look up the model for the resource name
 *
 * @param {object} resource
 * @param {Sequelize} sequelize - An initialized Sequelize object
 * @returns {Model} a sequelize model class
 */
restBuddy._getModelForResource = function getModelForResource (resource, sequelize) {
  var Utils = sequelize.Utils;
  var modelName = Utils.uppercaseFirst(Utils.camelize(Utils.singularize(resource.name))); // Ugh :/
  return sequelize.models[modelName];
};
