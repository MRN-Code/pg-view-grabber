# PG View Grabber

_Grab view information from a Postgres database._

## Use

Install the module with:

```shell
npm install pg-view-grabber --save
```

### Configuration

You’ll need to pass in Postgres connection info that will be passed to [pg](https://www.npmjs.com/package/pg)’s [`Client` constructor](https://github.com/brianc/node-postgres/wiki/Client#constructors). This can either be a connection string (Ex: `postgres://username:password@localhost/database`) or an object:

```js
var myConfig = {
    database: 'postgres',
    host: 'localhost',
    password: '',
    port: 5432,
    user: 'root',
};
```

Then, pass it in like so:

```js
var pgViewGrabber = require('pg-view-grabber');

pgViewGrabber.config(myConfig);
```

You’re ready to get started!

### API

These methods hang off the main `pg-view-grabber` module:

##### `pgViewGrabber.config(clientConfig)`

* Arguments:
    * `clientConfig` (object or string): database configuration passed to [pg’s `Client`](https://github.com/brianc/node-postgres/wiki/Client#constructors)
* Returns:
    * `undefined`

##### `pgViewGrabber.fromTable(tableName)`

* Arguments:
    * `tableName` (string): name of table for which to find dependent views
* Returns:
    * `Promise` that resolves to an array of ‘view data’ objects with the following keys:
        * `viewData.definition`: the view's SQL definition
        * `viewData.permissions`: the view's owner and permissions SQL
        * `viewData.schema`: the view's schema name
        * `viewData.viewName`: the view name itself

##### `pgViewGrabber.fromView(viewName)`

* Arguments:
    * `viewName` (string): name of view for which to find dependent views
* Returns:
    * `Promise` that resolves to an array of 'view data' objects

#### Liquibase Migration Methods

All Liquibase methods have the same argument object:

* Arguments:
    * `options` (object):
        * `options.name` (string): Name of table or view
        * `options.author` (_optional_ string): “author” for the migration file
        * `options.formatFilename` (_optional_ function): a function responsible for formatting each migration file's filename. It’s passed a `filenameOptions` object with the following keys:
            * `filenameOptions.author`
            * `filenameOptions.id`
            * `filenameOptions.schema`
            * `filenameOptions.viewName`
        * `options.id` (_optional_ string or number): changeset “id” for the migration file

##### `pgViewGrabber.getTableMigration(options)`

* Returns:
    * `Promise` that resolves to an array of Liquibase migration templates

##### `pgViewGrabber.getViewMigration(options)`

* Returns:
    * `Promise` that resolves to an array of Liquibase migration templates

##### `pgViewGrabber.saveTableMigration(options)`

* Returns:
    * `Promise` that resolves to an array of empty values when all migration files are written

##### `pgViewGrabber.saveViewMigration(options)`

* Returns:
    * `Promise` that resolves to an array of empty values when all migration files are written

## Testing

Testing assumes you’re on the MRN VPN and you have a valid database map in _/coins/coins_auth/conn/dbmap.json_. Run tests with `npm test`. Run linting with `npm run lint`.

## License

MIT. See [LICENSE](./LICENSE) for details.

