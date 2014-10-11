# Express Sequelize RestBuddy [![Build Status](https://travis-ci.org/sveinnfannar/express-sequelize-restbuddy.svg?branch=master)](https://travis-ci.org/sveinnfannar/express-sequelize-restbuddy)
> RestBuddy provides a simple, yet powerful abstraction to help reduce the amount of boilerplate code in REST APIs

## Getting Started
Install the module with: `npm install express-sequelize-restbuddy`

## Documentation
TODO: Insert JSDoc markdown here

## Examples
See [/examples](https://github.com/sveinnfannar/express-sequelize-restbuddy/tree/master/examples)

## Support
If you have any problem or suggestion please open an issue [here](https://github.com/ozinc/express-sequelize-restbuddy/issues).# express sequelize rest Unit Tests

## Tests
To run all tests:
`gulp test`

### Unit Test
Tests with no external dependencies

`gulp unit-test`

### Integration Tests
Tests that have external dependencies like a database, message queue etc.

`gulp integration-test`

External dependencies:
- PostgreSQL

## Todo
- Much more experimenting and playing around
- Handle include query param to embed documents
- Handle fields query param to filter fields selected from sequelize
- Link header pagination (next, previous, first, last)
- Write some unit tests
- ~~Write some integration tests~~
- Support for relational routes (/repos/:owner/:repo/pulls/:number/commits)
- Support not operator in query params ?field=!value
- Support more, less operators in query params ?field=>value and ?field=<value
- Find a new term for "condition transformers" cause they sound weird
- Add simple examples to README.md
- Return "405 Method Not Allowed" when trying to POST to a specific id
- Allow sorting by multiple fields
- Support + sign when sorting ascending (default)
- Send the total entries back to the user use the custom HTTP header: X-Total-Count (Optional)